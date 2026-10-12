from datetime import timedelta
from uuid import uuid4
from django.db import transaction, IntegrityError
from django.db.models import Count, Q, ProtectedError
from django.http import FileResponse
from django.utils import timezone
from rest_framework import serializers as drf
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from .access import CapabilityPermission, profile, role, visible_applications
from .models import (Organization, Application, ApplicationAssignment, AccessProfile, RequiredDocument, Audit, NonConformity,
                     Certificate, RequirementTemplate, DOMAINS, ACTIVITIES, LEVELS, CERTIFICATE_VALIDITY, level_for)
from .serializers import (OrganizationSerializer, ApplicationSerializer, ApplicationListSerializer, RequiredDocumentSerializer, CertificateSerializer,
                          AuditSerializer, NonConformitySerializer, RequirementTemplateSerializer, MemberSerializer)
from .services import (event, require_status, lock_application, validate_domains, validate_activity, sync_checklist, checklist,
                       next_reference, validate_upload, remove_file, mail, enterprise_users)

S = Application.Status
OPEN_STATUSES = [S.SUBMITTED, S.UNDER_REVIEW, S.CORRECTION_REQUIRED]
REVIEW_STATUSES = [S.UNDER_REVIEW, S.CORRECTION_REQUIRED]

def text(request, field, label, required=True):
    value = request.data.get(field, '')
    if not isinstance(value, str) or (required and not value.strip()):
        raise ValidationError({field: f'{label} est requis.'})
    return value.strip()

def parse_datetime(value, field):
    try:
        return drf.DateTimeField().to_internal_value(value)
    except drf.ValidationError:
        raise ValidationError({field: 'Date et heure invalides (format attendu : AAAA-MM-JJTHH:MM).'})

def parse_date(value, field):
    try:
        return drf.DateField().to_internal_value(value)
    except drf.ValidationError:
        raise ValidationError({field: 'Date invalide (format attendu : AAAA-MM-JJ).'})


class OrganizationViewSet(ModelViewSet):
    queryset = Organization.objects.all().order_by('legal_name')
    serializer_class = OrganizationSerializer
    permission_classes = [CapabilityPermission]
    action_capabilities = {'list': 'organizations.read', 'retrieve': 'organizations.read', 'create': 'organizations.create', 'update': 'organizations.update',
                           'partial_update': 'organizations.update', 'destroy': 'organizations.delete', 'verify': 'organizations.verify', 'members': 'members.read'}
    def get_queryset(self):
        if role(self.request.user) in ('ADMIN', 'MANAGER'):
            return self.queryset.all()
        access = profile(self.request.user)
        return self.queryset.filter(pk=access.organization_id) if access and role(self.request.user) == 'ENTERPRISE' else self.queryset.none()
    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            raise ValidationError({'detail': 'Cette organisation a des dossiers ou des comptes rattachés : elle ne peut pas être supprimée.'})
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        org = self.get_object()
        if org.is_verified:
            raise ValidationError({'detail': 'Cette organisation est déjà vérifiée.'})
        org.verified_at = timezone.now(); org.verified_by = request.user
        org.save(update_fields=['verified_at', 'verified_by'])
        users = [p.user for p in org.members.select_related('user') if p.user.is_active and p.user.email]
        mail(users, f'{org.legal_name} — organisation vérifiée', f'Bonjour,\n\nL’INPG a vérifié votre organisation « {org.legal_name} » (NINEA {org.ninea}). Vous pouvez désormais soumettre vos dossiers.\n\nPlateforme Label INPG')
        return Response(self.get_serializer(org).data)
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        org = self.get_object()
        return Response(MemberSerializer(org.members.select_related('user').order_by('-is_owner', 'user__username'), many=True).data)


class ApplicationViewSet(ModelViewSet):
    queryset = Application.objects.select_related('organization', 'certificate').prefetch_related('documents', 'events__actor', 'audits__auditor', 'non_conformities', 'assignments__user__access_profile')
    serializer_class = ApplicationSerializer
    permission_classes = [CapabilityPermission]
    action_capabilities = {'list': 'applications.read', 'retrieve': 'applications.read', 'create': 'applications.create', 'update': 'applications.update',
                           'partial_update': 'applications.update', 'destroy': 'applications.delete', 'submit': 'applications.submit', 'assign': 'applications.assign',
                           'unassign': 'applications.assign', 'start_review': 'applications.review', 'schedule_audit': 'audits.schedule', 'complete_audit': 'audits.perform',
                           'request_correction': 'corrections.request', 'respond_correction': 'corrections.respond', 'validate_correction': 'corrections.request',
                           'reject_correction': 'corrections.request', 'complete_evaluation': 'evaluations.perform', 'decide': 'decisions.make'}

    def get_queryset(self):
        qs = self.queryset.filter(pk__in=visible_applications(self.request.user).values('pk'))
        if self.action == 'list':
            statuses = [s for s in self.request.query_params.get('status', '').split(',') if s]
            if statuses:
                qs = qs.filter(status__in=statuses)
            search = self.request.query_params.get('search', '').strip()
            if search:
                qs = qs.filter(Q(reference__icontains=search) | Q(organization__legal_name__icontains=search))
            qs = qs.annotate(open_non_conformities=Count('non_conformities', filter=~Q(non_conformities__status=NonConformity.Status.VALIDATED)))
        return qs.order_by('-created_at')

    def get_serializer_class(self):
        return ApplicationListSerializer if self.action == 'list' else ApplicationSerializer

    # ------------------------------------------------------------ brouillon
    def _validated_links(self, data, organization):
        renewal, previous = data.get('renewal_of'), data.get('previous_application')
        if data.get('kind') == Application.Kind.RENEWAL:
            if not renewal or renewal.application.organization_id != organization.pk or renewal.status == Certificate.Status.REVOKED:
                raise ValidationError({'renewal_of': 'Un renouvellement doit viser un certificat non révoqué de votre organisation.'})
        elif renewal:
            raise ValidationError({'renewal_of': 'Seul un renouvellement peut viser un certificat.'})
        if previous and (previous.organization_id != organization.pk or previous.status != S.REJECTED):
            raise ValidationError({'previous_application': 'La demande précédente doit être un dossier refusé de votre organisation.'})

    def perform_create(self, serializer):
        organization = serializer.validated_data['organization']
        if role(self.request.user) == 'ENTERPRISE' and organization.pk != profile(self.request.user).organization_id:
            raise PermissionDenied('Entreprise non autorisée.')
        domains = validate_domains(serializer.validated_data.get('domains'))
        activity = validate_activity(serializer.validated_data.get('activity') or organization.activity)
        self._validated_links(serializer.validated_data, organization)
        for attempt in range(5):
            try:
                with transaction.atomic():
                    application = serializer.save(reference=next_reference(), domains=domains, activity=activity, level=level_for(domains))
                    sync_checklist(application)
                    event(application, self.request.user, 'DRAFT_CREATED', 'Brouillon créé par l’entreprise.')
                return
            except IntegrityError:
                # Deux créations simultanées ont obtenu la même référence (PostgreSQL) : on recommence avec la suivante.
                serializer.instance = None
                if attempt == 4:
                    raise

    @transaction.atomic
    def perform_update(self, serializer):
        item = Application.objects.select_for_update().get(pk=serializer.instance.pk)
        require_status(item, S.DRAFT, action='La modification')
        if serializer.validated_data.get('organization', item.organization).pk != item.organization_id:
            raise PermissionDenied('Le transfert de dossier est interdit.')
        extra = {}
        if 'domains' in serializer.validated_data:
            extra['domains'] = validate_domains(serializer.validated_data['domains']); extra['level'] = level_for(extra['domains'])
        if 'activity' in serializer.validated_data:
            extra['activity'] = validate_activity(serializer.validated_data['activity'])
        self._validated_links({**{'kind': item.kind, 'renewal_of': item.renewal_of, 'previous_application': item.previous_application}, **serializer.validated_data}, item.organization)
        updated = serializer.save(**extra)
        if extra.get('domains') is not None or 'activity' in extra:
            sync_checklist(updated)
            event(updated, self.request.user, 'CHECKLIST_UPDATED', 'Volets ou activité modifiés : checklist mise à jour.')
        event(updated, self.request.user, 'DRAFT_UPDATED', 'Brouillon mis à jour.')

    @transaction.atomic
    def perform_destroy(self, instance):
        item = Application.objects.select_for_update().get(pk=instance.pk)
        require_status(item, S.DRAFT, action='La suppression')
        for doc in item.documents.all():
            remove_file(doc.file)
        item.delete()

    # ------------------------------------------------------------ soumission et revue
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def submit(self, request, pk=None):
        item = lock_application(self)
        require_status(item, S.DRAFT, action='La soumission')
        if not item.organization.is_verified:
            raise ValidationError({'detail': 'Votre organisation doit d’abord être vérifiée par l’INPG (raison sociale et NINEA).'})
        mandatory = item.documents.filter(mandatory=True)
        if not mandatory.exists() or mandatory.exclude(status=RequiredDocument.Status.VALIDATED).exists():
            raise ValidationError({'detail': 'Les pièces obligatoires doivent être définies et validées.'})
        item.status = S.SUBMITTED; item.save(update_fields=['status', 'updated_at'])
        event(item, request.user, 'SUBMITTED', 'Dossier soumis pour revue administrative.')
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'], url_path='start-review')
    @transaction.atomic
    def start_review(self, request, pk=None):
        item = lock_application(self)
        require_status(item, S.SUBMITTED, action='Le démarrage de l’évaluation')
        item.status = S.UNDER_REVIEW; item.save(update_fields=['status', 'updated_at'])
        event(item, request.user, 'REVIEW_STARTED', str(request.data.get('note', '')))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def assign(self, request, pk=None):
        item = lock_application(self)
        require_status(item, *OPEN_STATUSES, action='L’affectation')
        user_id = request.data.get('user_id')
        if not isinstance(user_id, int) or isinstance(user_id, bool):
            raise ValidationError({'user_id': 'Un identifiant entier est requis.'})
        assignee = AccessProfile.objects.filter(user_id=user_id, user__is_active=True, role__in=['EVALUATOR', 'AUDITOR']).select_related('user').first()
        if not assignee:
            raise ValidationError({'user_id': 'Évaluateur ou auditeur actif requis.'})
        _, created = ApplicationAssignment.objects.get_or_create(application=item, user=assignee.user)
        if not created:
            raise ValidationError({'user_id': f'{assignee.user.username} est déjà affecté à ce dossier.'})
        event(item, request.user, 'ASSIGNED', f'{assignee.user.username} affecté au dossier.', notify_users=[assignee.user])
        return Response({'application': item.pk, 'user_id': assignee.user_id})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def unassign(self, request, pk=None):
        item = lock_application(self)
        require_status(item, *OPEN_STATUSES, S.DECISION_PENDING, action='Le retrait d’affectation')
        assignment = ApplicationAssignment.objects.filter(application=item, user_id=request.data.get('user_id')).select_related('user').first()
        if not assignment:
            raise ValidationError({'user_id': 'Cette personne n’est pas affectée au dossier.'})
        if item.audits.filter(auditor_id=assignment.user_id, status=Audit.Status.SCHEDULED).exists():
            raise ValidationError({'user_id': 'Cet auditeur a un audit planifié non réalisé sur ce dossier.'})
        assignment.delete()
        event(item, request.user, 'UNASSIGNED', f'{assignment.user.username} retiré du dossier.')
        return Response({'application': item.pk, 'user_id': assignment.user_id})

    # ------------------------------------------------------------ audit
    @action(detail=True, methods=['post'], url_path='schedule-audit')
    @transaction.atomic
    def schedule_audit(self, request, pk=None):
        item = lock_application(self)
        require_status(item, *REVIEW_STATUSES, action='La planification d’un audit')
        auditor_id = request.data.get('auditor_id')
        if not isinstance(auditor_id, int) or isinstance(auditor_id, bool):
            raise ValidationError({'auditor_id': 'Un identifiant entier est requis.'})
        auditor = AccessProfile.objects.filter(user_id=auditor_id, role='AUDITOR', user__is_active=True).select_related('user').first()
        if not auditor:
            raise ValidationError({'auditor_id': 'Auditeur actif requis.'})
        when = parse_datetime(request.data.get('scheduled_for'), 'scheduled_for')
        ApplicationAssignment.objects.get_or_create(application=item, user=auditor.user)
        audit = Audit.objects.create(application=item, auditor=auditor.user, scheduled_for=when)
        event(item, request.user, 'AUDIT_SCHEDULED', f'Audit planifié le {timezone.localtime(when):%d/%m/%Y à %H:%M} avec {auditor.user.username}.', notify_users=[auditor.user])
        return Response(AuditSerializer(audit).data, status=201)

    @action(detail=True, methods=['post'], url_path='complete-audit')
    @transaction.atomic
    def complete_audit(self, request, pk=None):
        item = lock_application(self)
        require_status(item, *REVIEW_STATUSES, action='La clôture de l’audit')
        audit = Audit.objects.filter(pk=request.data.get('audit_id'), application=item).first()
        if not audit:
            raise ValidationError({'audit_id': 'Audit introuvable.'})
        if role(request.user) != 'ADMIN' and audit.auditor_id != request.user.id:
            raise PermissionDenied('Seul l’auditeur affecté peut compléter cet audit.')
        if audit.status != Audit.Status.SCHEDULED:
            raise ValidationError({'audit_id': 'Cet audit est déjà réalisé.'})
        audit.summary = text(request, 'summary', 'Le compte rendu de l’audit')
        audit.status = Audit.Status.COMPLETED; audit.performed_at = timezone.now()
        audit.save(update_fields=['status', 'performed_at', 'summary'])
        item.save(update_fields=['updated_at'])
        event(item, request.user, 'AUDIT_COMPLETED', audit.summary)
        return Response(AuditSerializer(audit).data)

    # ------------------------------------------------------------ non-conformités
    @action(detail=True, methods=['post'], url_path='request-correction')
    @transaction.atomic
    def request_correction(self, request, pk=None):
        item = lock_application(self)
        require_status(item, *REVIEW_STATUSES, action='La demande de correction')
        domain = request.data.get('domain')
        if domain not in item.domains:
            raise ValidationError({'domain': 'Choisissez un volet du dossier.'})
        description = text(request, 'description', 'La description de l’écart')
        severity = request.data.get('severity', NonConformity.Severity.MAJOR)
        if severity not in NonConformity.Severity.values:
            raise ValidationError({'severity': 'Gravité : MINEURE, MAJEURE ou CRITIQUE.'})
        due = parse_date(request.data['due_date'], 'due_date') if request.data.get('due_date') else timezone.localdate() + timedelta(days=30)
        if due < timezone.localdate():
            raise ValidationError({'due_date': 'L’échéance ne peut pas être dans le passé.'})
        reference = f'NC-{item.pk}-{item.non_conformities.count() + 1:03d}'
        nc = NonConformity.objects.create(application=item, reference=reference, domain=domain, description=description, severity=severity, due_date=due)
        item.status = S.CORRECTION_REQUIRED; item.save(update_fields=['status', 'updated_at'])
        event(item, request.user, 'CORRECTION_REQUESTED', f'{reference} ({nc.get_severity_display()}, échéance {due:%d/%m/%Y}) : {description}')
        return Response(NonConformitySerializer(nc).data, status=201)

    def _nc(self, item, status):
        nc = NonConformity.objects.filter(pk=self.request.data.get('non_conformity_id'), application=item).first()
        if not nc:
            raise ValidationError({'non_conformity_id': 'Non-conformité introuvable.'})
        if nc.status != status:
            raise ValidationError({'non_conformity_id': f'Cette non-conformité est « {nc.get_status_display()} » : action impossible. Actualisez la page.'})
        return nc

    @action(detail=True, methods=['post'], url_path='respond-correction')
    @transaction.atomic
    def respond_correction(self, request, pk=None):
        item = lock_application(self)
        require_status(item, S.CORRECTION_REQUIRED, action='La réponse à une correction')
        nc = self._nc(item, NonConformity.Status.OPEN)
        nc.response = text(request, 'response', 'Une réponse'); nc.status = NonConformity.Status.CORRECTED
        nc.save(update_fields=['status', 'response'])
        item.save(update_fields=['updated_at'])
        event(item, request.user, 'CORRECTION_RESPONDED', f'{nc.reference} : réponse transmise.')
        return Response(NonConformitySerializer(nc).data)

    @action(detail=True, methods=['post'], url_path='validate-correction')
    @transaction.atomic
    def validate_correction(self, request, pk=None):
        item = lock_application(self)
        require_status(item, S.CORRECTION_REQUIRED, action='La clôture d’une correction')
        nc = self._nc(item, NonConformity.Status.CORRECTED)
        nc.status = NonConformity.Status.VALIDATED; nc.save(update_fields=['status'])
        if not item.non_conformities.exclude(status=NonConformity.Status.VALIDATED).exists():
            item.status = S.UNDER_REVIEW
        item.save(update_fields=['status', 'updated_at'])
        event(item, request.user, 'CORRECTION_VALIDATED', f'{nc.reference} clôturée.')
        return Response({**NonConformitySerializer(nc).data, 'application_status': item.status})

    @action(detail=True, methods=['post'], url_path='reject-correction')
    @transaction.atomic
    def reject_correction(self, request, pk=None):
        item = lock_application(self)
        require_status(item, S.CORRECTION_REQUIRED, action='Le renvoi d’une correction')
        nc = self._nc(item, NonConformity.Status.CORRECTED)
        nc.rejection_reason = text(request, 'reason', 'Le motif du renvoi')
        if request.data.get('due_date'):
            nc.due_date = parse_date(request.data['due_date'], 'due_date')
        nc.status = NonConformity.Status.OPEN; nc.save(update_fields=['status', 'rejection_reason', 'due_date'])
        item.save(update_fields=['updated_at'])
        event(item, request.user, 'CORRECTION_REJECTED', f'{nc.reference} : {nc.rejection_reason}')
        return Response(NonConformitySerializer(nc).data)

    # ------------------------------------------------------------ évaluation et décision
    @action(detail=True, methods=['post'], url_path='complete-evaluation')
    @transaction.atomic
    def complete_evaluation(self, request, pk=None):
        item = lock_application(self)
        require_status(item, S.UNDER_REVIEW, action='La clôture de l’évaluation')
        if item.non_conformities.exclude(status=NonConformity.Status.VALIDATED).exists():
            raise ValidationError({'detail': 'Toutes les non-conformités doivent être clôturées avant la décision.'})
        if item.audits.filter(status=Audit.Status.SCHEDULED).exists():
            raise ValidationError({'detail': 'Un audit planifié n’est pas encore réalisé.'})
        if item.documents.filter(mandatory=True).exclude(status=RequiredDocument.Status.VALIDATED).exists():
            raise ValidationError({'detail': 'Des pièces obligatoires ne sont pas validées.'})
        item.status = S.DECISION_PENDING; item.save(update_fields=['status', 'updated_at'])
        event(item, request.user, 'EVALUATION_COMPLETED', str(request.data.get('note', '')))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def decide(self, request, pk=None):
        item = lock_application(self)
        require_status(item, S.DECISION_PENDING, action='La décision')
        decision = request.data.get('decision')
        if decision not in [S.CERTIFIED, S.REJECTED]:
            raise ValidationError({'decision': 'CERTIFIED ou REJECTED est requis.'})
        note = request.data.get('note', '')
        note = note.strip() if isinstance(note, str) else ''
        payload = {}
        if decision == S.CERTIFIED:
            granted = request.data.get('domains', item.domains)
            if not isinstance(granted, list) or not granted or any(d not in item.domains for d in granted) or len(set(granted)) != len(granted):
                raise ValidationError({'domains': 'Cochez au moins un volet parmi ceux du dossier.'})
            granted = [d for d in DOMAINS if d in granted]
            item.level = level_for(granted)
            certificate = Certificate.objects.create(application=item, number='CERT-INPG-' + uuid4().hex[:16].upper(), level=item.level, domains=granted,
                                                     expires_at=timezone.now() + CERTIFICATE_VALIDITY)
            payload['certificate'] = certificate.number
            note = note or f'Label {item.level} accordé pour : {", ".join(granted)}.'
        elif not note:
            raise ValidationError({'note': 'Le motif du refus est obligatoire : il est communiqué à l’entreprise.'})
        item.status = decision; item.decision_note = note
        item.save(update_fields=['status', 'level', 'decision_note', 'updated_at'])
        event(item, request.user, 'DECISION_' + decision, note)
        return Response({**payload, 'status': item.status, 'level': item.level})


class CertificateViewSet(ReadOnlyModelViewSet):
    queryset = Certificate.objects.select_related('application', 'application__organization').order_by('-issued_at')
    serializer_class = CertificateSerializer
    permission_classes = [CapabilityPermission]
    action_capabilities = {'list': 'certificates.read', 'retrieve': 'certificates.read', 'update_status': 'certificates.manage'}
    TRANSITIONS = {'VALID': {'SUSPENDED', 'REVOKED'}, 'SUSPENDED': {'VALID', 'REVOKED'}, 'REVOKED': set()}
    def get_queryset(self):
        if role(self.request.user) == 'ENTERPRISE':
            return self.queryset.filter(application__organization_id=profile(self.request.user).organization_id)
        return self.queryset
    @action(detail=True, methods=['post'], url_path='update-status')
    @transaction.atomic
    def update_status(self, request, pk=None):
        certificate = Certificate.objects.select_for_update().get(pk=self.get_object().pk)
        status = request.data.get('status')
        if status not in Certificate.Status.values:
            raise ValidationError({'status': 'VALID, SUSPENDED ou REVOKED est requis.'})
        if status not in self.TRANSITIONS[certificate.status]:
            raise ValidationError({'status': 'Un certificat révoqué ne peut plus changer de statut.' if certificate.status == 'REVOKED' else f'Le certificat est déjà « {certificate.get_status_display()} ».'})
        if status == 'VALID' and certificate.expires_at and certificate.expires_at <= timezone.now():
            raise ValidationError({'status': 'Ce certificat est expiré : un renouvellement est nécessaire.'})
        note = request.data.get('note', '')
        certificate.status = status; certificate.save(update_fields=['status'])
        certificate.application.save(update_fields=['updated_at'])
        event(certificate.application, request.user, 'CERTIFICATE_' + status, f'Certificat {certificate.number} : {certificate.get_status_display().lower()}.' + (f' {note}' if isinstance(note, str) and note else ''))
        return Response(self.get_serializer(certificate).data)


class RequiredDocumentViewSet(ReadOnlyModelViewSet):
    queryset = RequiredDocument.objects.select_related('application', 'application__organization').all()
    serializer_class = RequiredDocumentSerializer
    permission_classes = [CapabilityPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    action_capabilities = {'list': 'applications.read', 'retrieve': 'applications.read', 'upload': 'documents.upload', 'review': 'documents.review', 'download': 'documents.download'}
    def get_queryset(self):
        return self.queryset.filter(application__in=visible_applications(self.request.user))

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def upload(self, request, pk=None):
        document = self.get_object()
        application = Application.objects.select_for_update().get(pk=document.application_id)
        require_status(application, S.DRAFT, S.CORRECTION_REQUIRED, action='Le dépôt de pièce')
        document.refresh_from_db()
        if application.status == S.DRAFT and document.status == RequiredDocument.Status.VALIDATED:
            raise ValidationError({'file': 'Cette pièce est déjà validée.'})
        uploaded = request.FILES.get('file')
        validate_upload(uploaded)
        previous = document.file.name if document.file else None
        storage = document.file.storage
        document.file = uploaded; document.status = RequiredDocument.Status.SUBMITTED; document.submitted_at = timezone.now(); document.review_comment = ''
        try:
            document.save(update_fields=['file', 'status', 'submitted_at', 'review_comment'])
        except Exception:
            if document.file and document.file.name != previous:
                storage.delete(document.file.name)
            raise
        if previous and previous != document.file.name:
            transaction.on_commit(lambda: storage.exists(previous) and storage.delete(previous))
        application.save(update_fields=['updated_at'])
        event(application, request.user, 'DOCUMENT_UPLOADED', document.name)
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def review(self, request, pk=None):
        document = self.get_object()
        application = Application.objects.select_for_update().get(pk=document.application_id)
        require_status(application, S.DRAFT, *OPEN_STATUSES, action='La revue de pièce')
        document.refresh_from_db()
        outcome = request.data.get('status')
        if outcome not in [RequiredDocument.Status.VALIDATED, RequiredDocument.Status.REJECTED]:
            raise ValidationError({'status': 'VALIDATED ou REJECTED est requis.'})
        if document.status != RequiredDocument.Status.SUBMITTED:
            raise ValidationError({'detail': f'Cette pièce est « {document.get_status_display()} » : seule une pièce déposée peut être revue. Actualisez la page.'})
        comment = request.data.get('comment', '')
        comment = comment.strip() if isinstance(comment, str) else ''
        if outcome == RequiredDocument.Status.REJECTED and not comment:
            raise ValidationError({'comment': 'Expliquez ce qui doit être corrigé : le motif est communiqué à l’entreprise.'})
        document.status = outcome; document.review_comment = comment or 'Pièce validée.'; document.reviewed_at = timezone.now()
        document.save(update_fields=['status', 'review_comment', 'reviewed_at'])
        application.save(update_fields=['updated_at'])
        event(application, request.user, 'DOCUMENT_' + outcome, f'{document.name} : {document.review_comment}')
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.file or not document.file.storage.exists(document.file.name):
            raise NotFound('Aucun fichier déposé pour cette pièce.')
        name = document.file.name.rsplit('/', 1)[-1]
        response = FileResponse(document.file.open('rb'), as_attachment=True, filename=name)
        response['Cache-Control'] = 'private, no-store'
        return response


class AuditViewSet(ReadOnlyModelViewSet):
    queryset = Audit.objects.select_related('application', 'application__organization', 'auditor').order_by('-scheduled_for', '-id')
    serializer_class = AuditSerializer
    permission_classes = [CapabilityPermission]
    action_capabilities = {'list': 'audits.read', 'retrieve': 'audits.read'}
    def get_queryset(self):
        qs = self.queryset.filter(application__in=visible_applications(self.request.user))
        return qs.filter(auditor=self.request.user) if role(self.request.user) == 'AUDITOR' else qs


class NonConformityViewSet(ReadOnlyModelViewSet):
    queryset = NonConformity.objects.select_related('application', 'application__organization').order_by('status', 'due_date', '-created_at')
    serializer_class = NonConformitySerializer
    permission_classes = [CapabilityPermission]
    action_capabilities = {'list': 'nonconformities.read', 'retrieve': 'nonconformities.read'}
    def get_queryset(self):
        qs = self.queryset.filter(application__in=visible_applications(self.request.user))
        statuses = [s for s in self.request.query_params.get('status', '').split(',') if s]
        return qs.filter(status__in=statuses) if statuses else qs


class RequirementTemplateViewSet(ModelViewSet):
    queryset = RequirementTemplate.objects.all()
    serializer_class = RequirementTemplateSerializer
    permission_classes = [CapabilityPermission]
    action_capabilities = {'list': 'referentials.manage', 'retrieve': 'referentials.manage', 'create': 'referentials.manage', 'update': 'referentials.manage',
                           'partial_update': 'referentials.manage', 'destroy': 'referentials.manage', 'preview': 'applications.read'}
    def perform_create(self, serializer):
        self._check(serializer.validated_data); serializer.save()
    def perform_update(self, serializer):
        self._check({**RequirementTemplateSerializer(serializer.instance).data, **serializer.validated_data}); serializer.save()
    def _check(self, data):
        if data.get('domain') not in DOMAINS:
            raise ValidationError({'domain': 'Volet inconnu.'})
        if data.get('activity') and data['activity'] not in ACTIVITIES:
            raise ValidationError({'activity': 'Activité inconnue.'})
    @action(detail=False, methods=['get'])
    def preview(self, request):
        """Checklist officielle avant création : la même règle que celle appliquée par l'API au dossier."""
        domains = [d for d in request.query_params.get('domains', '').split(',') if d in DOMAINS]
        activity = request.query_params.get('activity', '')
        items = checklist(activity, domains) if domains else []
        return Response({'level': level_for(domains), 'documents': RequirementTemplateSerializer(items, many=True).data})

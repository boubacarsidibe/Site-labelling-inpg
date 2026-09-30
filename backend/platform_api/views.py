from uuid import uuid4
from django.db import transaction
from django.utils import timezone
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from .access import CapabilityPermission, profile, role
from .models import Organization, Application, ApplicationAssignment, AccessProfile, RequiredDocument, WorkflowEvent, Audit, NonConformity, Certificate
from .serializers import OrganizationSerializer, ApplicationSerializer, RequiredDocumentSerializer, CertificateSerializer

LABEL_LEVELS={'Standard','Gold','Platinum'}

REQUIRED_DOCUMENTS={
    'Sécurité':['Politique HSE signée','Plan de prévention des risques','Rapport d’audit interne'],
    'Qualité':['Politique qualité','Procédure de contrôle','Registre des non-conformités'],
    'Environnement':['Plan de gestion environnementale','Suivi des déchets','Plan d’urgence environnemental'],
}

def event(application,user,event_type,note=''):
    return WorkflowEvent.objects.create(application=application,actor=user,event_type=event,note=note)

def can_access_application(user,application):
    current=role(user)
    if current in ('ADMIN','MANAGER','DECISION_MAKER'):
        return True
    if current=='ENTERPRISE':
        access=profile(user)
        return bool(access and access.organization_id==application.organization_id)
    return current in ('EVALUATOR','AUDITOR') and ApplicationAssignment.objects.filter(application=application,user=user).exists()

class OrganizationViewSet(ModelViewSet):
    queryset=Organization.objects.all()
    serializer_class=OrganizationSerializer
    permission_classes=[CapabilityPermission]
    action_capabilities={'list':'organizations.read','retrieve':'organizations.read','create':'organizations.create','update':'organizations.update','partial_update':'organizations.update','destroy':'organizations.delete'}
    def get_queryset(self):
        if role(self.request.user) in ('ADMIN','MANAGER'):
            return self.queryset.all()
        access=profile(self.request.user)
        return self.queryset.filter(pk=access.organization_id) if access and role(self.request.user)=='ENTERPRISE' else self.queryset.none()

class ApplicationViewSet(ModelViewSet):
    queryset=Application.objects.prefetch_related('documents','events__actor','audits__auditor','non_conformities').all()
    serializer_class=ApplicationSerializer
    permission_classes=[CapabilityPermission]
    action_capabilities={'list':'applications.read','retrieve':'applications.read','create':'applications.create','update':'applications.update','partial_update':'applications.update','destroy':'applications.delete','submit':'applications.submit','assign':'applications.assign','start_review':'applications.review','schedule_audit':'audits.schedule','complete_audit':'audits.perform','request_correction':'corrections.request','respond_correction':'corrections.respond','validate_correction':'corrections.request','complete_evaluation':'evaluations.perform','decide':'decisions.make'}
    def get_queryset(self):
        current=role(self.request.user)
        if current in ('ADMIN','MANAGER','DECISION_MAKER'):
            return self.queryset.all()
        if current=='ENTERPRISE':
            return self.queryset.filter(organization_id=profile(self.request.user).organization_id)
        if current in ('AUDITOR','EVALUATOR'):
            return self.queryset.filter(assignments__user=self.request.user).distinct()
        return self.queryset.none()
    def perform_create(self, serializer):
        organization=serializer.validated_data['organization']
        if role(self.request.user)=='ENTERPRISE' and organization.pk!=profile(self.request.user).organization_id:
            raise PermissionDenied('Entreprise non autorisée.')
        with transaction.atomic():
            application=serializer.save(reference='INPG-'+uuid4().hex[:20].upper())
            for domain in application.domains:
                for name in REQUIRED_DOCUMENTS.get(domain,[]):
                    RequiredDocument.objects.create(application=application,domain=domain,name=name)
            event(application,self.request.user,'DRAFT_CREATED','Brouillon créé par l’entreprise.')
    def perform_update(self, serializer):
        if serializer.instance.status!=Application.Status.DRAFT:
            raise ValidationError('Seuls les brouillons peuvent être modifiés.')
        if serializer.validated_data.get('organization',serializer.instance.organization).pk!=serializer.instance.organization_id:
            raise PermissionDenied('Le transfert de dossier est interdit.')
        item=serializer.save()
        event(item,self.request.user,'DRAFT_UPDATED','Brouillon mis à jour.')
    @action(detail=True,methods=['post'])
    def submit(self,request,pk=None):
        with transaction.atomic():
            item=self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if item.status not in [Application.Status.DRAFT,Application.Status.CORRECTION_REQUIRED]:
                raise ValidationError('Ce dossier ne peut pas être soumis à cette étape.')
            if not item.documents.filter(mandatory=True).exists() or item.documents.filter(mandatory=True).exclude(status='VALIDATED').exists():
                raise ValidationError('Les pièces obligatoires doivent être définies et validées.')
            item.status=Application.Status.SUBMITTED
            item.save(update_fields=['status'])
            event(item,request.user,'SUBMITTED','Dossier soumis pour revue administrative.')
        return Response(self.get_serializer(item).data)
    @action(detail=True,methods=['post'])
    def assign(self,request,pk=None):
        item=self.get_object()
        user_id=request.data.get('user_id')
        if not isinstance(user_id,int) or isinstance(user_id,bool):
            raise ValidationError({'user_id':'Un identifiant entier est requis.'})
        assignee=AccessProfile.objects.filter(user_id=user_id,user__is_active=True,role__in=['EVALUATOR','AUDITOR']).first()
        if not assignee:
            raise ValidationError({'user_id':'Évaluateur ou auditeur actif requis.'})
        ApplicationAssignment.objects.get_or_create(application=item,user=assignee.user)
        event(item,request.user,'ASSIGNED',f'{assignee.user.username} affecté au dossier.')
        return Response({'application':item.pk,'user_id':assignee.user_id})
    @action(detail=True,methods=['post'],url_path='start-review')
    def start_review(self,request,pk=None):
        item=self.get_object()
        if item.status!=Application.Status.SUBMITTED:
            raise ValidationError('Seul un dossier soumis peut entrer en évaluation.')
        item.status=Application.Status.UNDER_REVIEW
        item.save(update_fields=['status'])
        event(item,request.user,'REVIEW_STARTED',str(request.data.get('note','')))
        return Response(self.get_serializer(item).data)
    @action(detail=True,methods=['post'],url_path='schedule-audit')
    def schedule_audit(self,request,pk=None):
        item=self.get_object()
        if item.status!=Application.Status.UNDER_REVIEW:
            raise ValidationError('Un audit ne peut être planifié que pendant l’évaluation.')
        auditor_id=request.data.get('auditor_id')
        if not isinstance(auditor_id,int) or isinstance(auditor_id,bool):
            raise ValidationError({'auditor_id':'Un identifiant entier est requis.'})
        auditor=AccessProfile.objects.filter(user_id=auditor_id,role='AUDITOR',user__is_active=True).first()
        if not auditor:
            raise ValidationError({'auditor_id':'Auditeur actif requis.'})
        ApplicationAssignment.objects.get_or_create(application=item,user=auditor.user)
        audit=Audit.objects.create(application=item,auditor=auditor.user,scheduled_for=request.data.get('scheduled_for') or None)
        event(item,request.user,'AUDIT_SCHEDULED',f'Audit {audit.pk} planifié pour {auditor.user.username}.')
        return Response({'id':audit.pk,'status':audit.status},status=201)
    @action(detail=True,methods=['post'],url_path='complete-audit')
    def complete_audit(self,request,pk=None):
        item=self.get_object()
        audit_id=request.data.get('audit_id')
        audit=Audit.objects.filter(pk=audit_id,application=item).first()
        if not audit:
            raise ValidationError({'audit_id':'Audit introuvable.'})
        if role(request.user)!='ADMIN' and audit.auditor_id!=request.user.id:
            raise PermissionDenied('Seul l’auditeur affecté peut compléter cet audit.')
        audit.status=Audit.Status.COMPLETED; audit.performed_at=timezone.now(); audit.summary=str(request.data.get('summary',''))
        audit.save(update_fields=['status','performed_at','summary'])
        event(item,request.user,'AUDIT_COMPLETED',audit.summary)
        return Response({'id':audit.pk,'status':audit.status})
    @action(detail=True,methods=['post'],url_path='request-correction')
    def request_correction(self,request,pk=None):
        item=self.get_object()
        if item.status!=Application.Status.UNDER_REVIEW:
            raise ValidationError('Les corrections ne peuvent être demandées que pendant l’évaluation.')
        domain=request.data.get('domain'); description=request.data.get('description'); severity=request.data.get('severity','MAJEURE')
        if not isinstance(domain,str) or domain not in item.domains or not isinstance(description,str) or not description.strip():
            raise ValidationError({'detail':'Volet concerné et description sont requis.'})
        reference=f'NC-{item.pk}-{item.non_conformities.count()+1:03d}'
        non_conformity=NonConformity.objects.create(application=item,reference=reference,domain=domain,description=description.strip(),severity=severity)
        item.status=Application.Status.CORRECTION_REQUIRED; item.save(update_fields=['status'])
        event(item,request.user,'CORRECTION_REQUESTED',f'{reference} : {description.strip()}')
        return Response({'id':non_conformity.pk,'reference':reference,'status':non_conformity.status},status=201)
    @action(detail=True,methods=['post'],url_path='respond-correction')
    def respond_correction(self,request,pk=None):
        item=self.get_object()
        if item.status!=Application.Status.CORRECTION_REQUIRED:
            raise ValidationError('Aucune correction n’est attendue à cette étape.')
        non_conformity_id=request.data.get('non_conformity_id'); response=request.data.get('response')
        if not isinstance(response,str) or not response.strip():
            raise ValidationError({'response':'Une réponse est requise.'})
        non_conformity=NonConformity.objects.filter(pk=non_conformity_id,application=item,status=NonConformity.Status.OPEN).first()
        if not non_conformity:
            raise ValidationError({'non_conformity_id':'Non-conformité ouverte introuvable.'})
        non_conformity.status=NonConformity.Status.CORRECTED; non_conformity.response=response.strip(); non_conformity.save(update_fields=['status','response'])
        event(item,request.user,'CORRECTION_RESPONDED',f'{non_conformity.reference} : réponse transmise.')
        return Response({'id':non_conformity.pk,'status':non_conformity.status})
    @action(detail=True,methods=['post'],url_path='validate-correction')
    def validate_correction(self,request,pk=None):
        item=self.get_object(); non_conformity_id=request.data.get('non_conformity_id')
        non_conformity=NonConformity.objects.filter(pk=non_conformity_id,application=item,status=NonConformity.Status.CORRECTED).first()
        if not non_conformity:
            raise ValidationError({'non_conformity_id':'Non-conformité corrigée introuvable.'})
        non_conformity.status=NonConformity.Status.VALIDATED; non_conformity.save(update_fields=['status'])
        if not item.non_conformities.exclude(status=NonConformity.Status.VALIDATED).exists():
            item.status=Application.Status.UNDER_REVIEW; item.save(update_fields=['status'])
        event(item,request.user,'CORRECTION_VALIDATED',f'{non_conformity.reference} clôturée.')
        return Response({'id':non_conformity.pk,'status':non_conformity.status,'application_status':item.status})
    @action(detail=True,methods=['post'],url_path='complete-evaluation')
    def complete_evaluation(self,request,pk=None):
        item=self.get_object()
        if item.status!=Application.Status.UNDER_REVIEW:
            raise ValidationError('L’évaluation doit être en cours.')
        if item.non_conformities.exclude(status=NonConformity.Status.VALIDATED).exists():
            raise ValidationError('Toutes les non-conformités doivent être clôturées avant la décision.')
        item.status=Application.Status.DECISION_PENDING; item.save(update_fields=['status'])
        event(item,request.user,'EVALUATION_COMPLETED',str(request.data.get('note','')))
        return Response(self.get_serializer(item).data)
    @action(detail=True,methods=['post'])
    def decide(self,request,pk=None):
        item=self.get_object()
        if item.status!=Application.Status.DECISION_PENDING:
            raise ValidationError('Le dossier doit être en décision avant validation.')
        decision=request.data.get('decision'); note=str(request.data.get('note',''))
        if decision not in ['CERTIFIED','REJECTED']:
            raise ValidationError({'decision':'CERTIFIED ou REJECTED est requis.'})
        selected_level=request.data.get('level',item.level)
        if decision=='CERTIFIED' and selected_level not in LABEL_LEVELS:
            raise ValidationError({'level':'Standard, Gold ou Platinum est requis pour délivrer un Label.'})
        item.status=decision
        if decision=='CERTIFIED': item.level=selected_level
        item.save(update_fields=['status','level'] if decision=='CERTIFIED' else ['status'])
        payload={'status':item.status}
        if decision=='CERTIFIED':
            certificate=Certificate.objects.create(application=item,number='CERT-INPG-'+uuid4().hex[:16].upper())
            payload['certificate']=certificate.number
        event(item,request.user,'DECISION_'+decision,note)
        return Response(payload)

class CertificateViewSet(ModelViewSet):
    queryset=Certificate.objects.select_related('application','application__organization').all().order_by('-issued_at')
    serializer_class=CertificateSerializer
    permission_classes=[CapabilityPermission]
    http_method_names=['get','post','head','options']
    action_capabilities={'list':'certificates.read','retrieve':'certificates.read','update_status':'certificates.manage'}
    @action(detail=True,methods=['post'],url_path='update-status')
    def update_status(self,request,pk=None):
        certificate=self.get_object(); status=request.data.get('status')
        if status not in ['VALID','SUSPENDED','REVOKED']:
            raise ValidationError({'status':'VALID, SUSPENDED ou REVOKED est requis.'})
        certificate.status=status; certificate.save(update_fields=['status'])
        event(certificate.application,request.user,'CERTIFICATE_'+status,f'Certificat {certificate.number} : statut {status}.')
        return Response(self.get_serializer(certificate).data)

class RequiredDocumentViewSet(ModelViewSet):
    queryset=RequiredDocument.objects.select_related('application','application__organization').all()
    serializer_class=RequiredDocumentSerializer
    permission_classes=[CapabilityPermission]
    parser_classes=[MultiPartParser,FormParser,JSONParser]
    action_capabilities={'list':'applications.read','retrieve':'applications.read','upload':'documents.upload','review':'documents.review'}
    http_method_names=['get','post','head','options']
    def get_queryset(self):
        current=role(self.request.user)
        if current in ('ADMIN','MANAGER','DECISION_MAKER'):
            return self.queryset
        if current=='ENTERPRISE':
            access=profile(self.request.user)
            return self.queryset.filter(application__organization_id=access.organization_id) if access else self.queryset.none()
        if current in ('EVALUATOR','AUDITOR'):
            return self.queryset.filter(application__assignments__user=self.request.user).distinct()
        return self.queryset.none()
    @action(detail=True,methods=['post'])
    def upload(self,request,pk=None):
        document=self.get_object(); application=document.application
        if application.status not in [Application.Status.DRAFT,Application.Status.CORRECTION_REQUIRED]:
            raise ValidationError('Le dépôt est fermé pour ce dossier.')
        uploaded=request.FILES.get('file')
        if not uploaded or uploaded.size>10*1024*1024:
            raise ValidationError({'file':'Un fichier de 10 Mo maximum est requis.'})
        document.file=uploaded; document.status=RequiredDocument.Status.SUBMITTED; document.submitted_at=timezone.now(); document.review_comment=''
        document.save(update_fields=['file','status','submitted_at','review_comment'])
        event(application,request.user,'DOCUMENT_UPLOADED',document.name)
        return Response(self.get_serializer(document).data)
    @action(detail=True,methods=['post'])
    def review(self,request,pk=None):
        document=self.get_object(); outcome=request.data.get('status'); comment=str(request.data.get('comment',''))
        if outcome not in [RequiredDocument.Status.VALIDATED,RequiredDocument.Status.REJECTED]:
            raise ValidationError({'status':'VALIDATED ou REJECTED est requis.'})
        if document.status!=RequiredDocument.Status.SUBMITTED:
            raise ValidationError('Seul un document déposé peut être revu.')
        document.status=outcome; document.review_comment=comment; document.reviewed_at=timezone.now(); document.save(update_fields=['status','review_comment','reviewed_at'])
        event(document.application,request.user,'DOCUMENT_'+outcome,f'{document.name} : {comment}')
        return Response(self.get_serializer(document).data)

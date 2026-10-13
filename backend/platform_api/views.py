from uuid import uuid4
from calendar import monthrange
from io import BytesIO
from textwrap import wrap
import mimetypes
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction, models
from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.http import FileResponse, HttpResponse
from django.core.files.storage import default_storage
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import qrcode
from PIL import Image, UnidentifiedImageError
from .access import CapabilityPermission, profile, role
from .catalog import ACTIVITY_DOCUMENTS, LABEL_LEVELS, NON_CONFORMITY_SEVERITIES, REQUIRED_DOCUMENTS
from .models import Organization, Application, ApplicationAssignment, AccessProfile, RequiredDocument, WorkflowEvent, Audit, NonConformity, Certificate, Training, TrainingEnrollment, RequirementTemplate, ApplicationMessage, Notification
from .serializers import OrganizationSerializer, ApplicationSerializer, RequiredDocumentSerializer, CertificateSerializer, TrainingSerializer, TrainingEnrollmentSerializer, AuditSerializer, NonConformitySerializer, RequirementTemplateSerializer, ApplicationMessageSerializer, NotificationSerializer

ALLOWED_UPLOAD_TYPES={'application/pdf':b'%PDF-','image/png':b'\x89PNG\r\n\x1a\n','image/jpeg':b'\xff\xd8\xff'}

def add_years(value,years):
    day=min(value.day,monthrange(value.year+years,value.month)[1])
    return value.replace(year=value.year+years,day=day)

def certificate_pdf(certificate):
    app=certificate.application
    verification_url=settings.PUBLIC_CERTIFICATE_VERIFICATION_URL.format(number=certificate.number)
    output=BytesIO(); pdf=canvas.Canvas(output,pagesize=A4,title=f'Certificat {certificate.number}')
    width,height=A4
    pdf.setFillColorRGB(.04,.18,.36); pdf.rect(0,height-135,width,135,fill=1,stroke=0)
    pdf.setFillColorRGB(1,1,1); pdf.setFont('Helvetica-Bold',24); pdf.drawString(54,height-68,'CERTIFICAT LABEL INPG')
    pdf.setFont('Helvetica',11); pdf.drawString(54,height-96,certificate.number)
    pdf.setFillColorRGB(.06,.17,.3); pdf.setFont('Helvetica-Bold',18); pdf.drawString(54,height-180,app.organization.legal_name)
    details=[('Niveau',app.level),('Volets',', '.join(app.domains)),('Périmètre',app.scope or 'Non précisé'),('Délivré le',certificate.issued_at.strftime('%d/%m/%Y')),('Valide jusqu’au',certificate.expires_at.strftime('%d/%m/%Y') if certificate.expires_at else 'Non définie'),('Statut',certificate.effective_status)]
    y=height-225
    for label,value in details:
        pdf.setFont('Helvetica-Bold',10); pdf.setFillColorRGB(.25,.35,.46); pdf.drawString(54,y,label.upper())
        pdf.setFont('Helvetica',12); pdf.setFillColorRGB(.05,.12,.2)
        lines=wrap(str(value),72) or ['']
        for line in lines: pdf.drawString(170,y,line); y-=16
        y-=12
    qr_image=qrcode.make(verification_url)
    qr_buffer=BytesIO(); qr_image.save(qr_buffer,format='PNG'); qr_buffer.seek(0)
    pdf.drawImage(ImageReader(qr_buffer),width-180,70,110,110,preserveAspectRatio=True,mask='auto')
    pdf.setFont('Helvetica',8); pdf.setFillColorRGB(.25,.35,.46)
    pdf.drawString(54,118,'Vérification publique :')
    for index,line in enumerate(wrap(verification_url,76)): pdf.drawString(54,102-index*11,line)
    pdf.showPage(); pdf.save(); output.seek(0)
    return output

@api_view(['GET'])
@permission_classes([AllowAny])
def verify_certificate(request):
    number=request.query_params.get('number','').strip()
    if not number:
        raise ValidationError({'number':'Le numéro du certificat est requis.'})
    certificate=Certificate.objects.select_related('application','application__organization').filter(number__iexact=number).first()
    if not certificate:
        return Response({'found':False})
    app=certificate.application
    verification_url=settings.PUBLIC_CERTIFICATE_VERIFICATION_URL.format(number=certificate.number)
    return Response({'found':True,'number':certificate.number,'status':certificate.effective_status,'organization_name':app.organization.legal_name,'label_level':app.level,'domains':app.domains,'scope':app.scope,'issued_at':certificate.issued_at,'expires_at':certificate.expires_at,'verification_url':verification_url})

def requirement_rows(application):
    rows=[]
    for domain in application.domains:
        templates=list(RequirementTemplate.objects.filter(active=True,domain=domain).filter(models.Q(activity='')|models.Q(activity=application.activity)).order_by('name'))
        if templates:
            rows.extend((domain,item.name,item.mandatory) for item in templates)
        else:
            names=REQUIRED_DOCUMENTS.get(domain,[])+ACTIVITY_DOCUMENTS.get(application.activity,{}).get(domain,[])
            rows.extend((domain,name,True) for name in names)
    return rows

def synchronize_documents(application):
    desired={(domain,name):(mandatory) for domain,name,mandatory in requirement_rows(application)}
    current={(item.domain,item.name):item for item in application.documents.all()}
    for key,item in current.items():
        if key not in desired:
            item.delete()
    for (domain,name),mandatory in desired.items():
        RequiredDocument.objects.update_or_create(application=application,domain=domain,name=name,defaults={'mandatory':mandatory})

def event(application,user,event_type,note=''):
    record=WorkflowEvent.objects.create(application=application,actor=user,event_type=event_type,note=note)
    titles={'DOCUMENT_REJECTED':'Document à corriger','AUDIT_SCHEDULED':'Audit planifié','CORRECTION_REQUESTED':'Correction demandée','CORRECTION_RESPONDED':'Réponse corrective reçue','EVALUATION_COMPLETED':'Dossier prêt pour décision','DECISION_CERTIFIED':'Certification délivrée','DECISION_REJECTED':'Décision défavorable','CERTIFICATE_SUSPENDED':'Certification suspendue','CERTIFICATE_VALID':'Certification réactivée','CERTIFICATE_REVOKED':'Certification révoquée'}
    title=titles.get(event_type)
    if title:
        users=set(ApplicationAssignment.objects.filter(application=application).values_list('user_id',flat=True))
        users.update(AccessProfile.objects.filter(organization=application.organization,role='ENTERPRISE').values_list('user_id',flat=True))
        users.update(get_user_model().objects.filter(is_superuser=True,is_active=True).values_list('id',flat=True))
        Notification.objects.bulk_create([Notification(user_id=user_id,title=title,body=note,url=f'/espace/dossiers/{application.id}') for user_id in users if user_id!=getattr(user,'id',None)])
    return record

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
            synchronize_documents(application)
            event(application,self.request.user,'DRAFT_CREATED','Brouillon créé par l’entreprise.')
    def perform_update(self, serializer):
        if serializer.instance.status!=Application.Status.DRAFT:
            raise ValidationError('Seuls les brouillons peuvent être modifiés.')
        if serializer.validated_data.get('organization',serializer.instance.organization).pk!=serializer.instance.organization_id:
            raise PermissionDenied('Le transfert de dossier est interdit.')
        changed_requirements=any(field in serializer.validated_data and serializer.validated_data[field]!=getattr(serializer.instance,field) for field in ('activity','domains'))
        if changed_requirements and serializer.instance.documents.exclude(status=RequiredDocument.Status.MISSING).exists():
            raise ValidationError('L’activité et les volets ne peuvent plus être modifiés après le premier dépôt de document.')
        with transaction.atomic():
            item=serializer.save()
            if changed_requirements:
                synchronize_documents(item)
            event(item,self.request.user,'DRAFT_UPDATED','Brouillon mis à jour.')
    @action(detail=True,methods=['post'])
    def submit(self,request,pk=None):
        with transaction.atomic():
            item=self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if item.status not in [Application.Status.DRAFT,Application.Status.CORRECTION_REQUIRED]:
                raise ValidationError('Ce dossier ne peut pas être soumis à cette étape.')
            if item.status==Application.Status.CORRECTION_REQUIRED and item.non_conformities.exclude(status=NonConformity.Status.VALIDATED).exists():
                raise ValidationError('Toutes les non-conformités doivent être corrigées et validées avant la reprise du dossier.')
            if not item.documents.filter(mandatory=True).exists() or item.documents.filter(mandatory=True).exclude(status__in=['SUBMITTED','VALIDATED']).exists():
                raise ValidationError('Toutes les pièces obligatoires doivent être déposées avant la soumission.')
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
        assignee=AccessProfile.objects.filter(user_id=user_id,user__is_active=True,role='EVALUATOR').first()
        if not assignee:
            raise ValidationError({'user_id':'Évaluateur actif requis.'})
        ApplicationAssignment.objects.get_or_create(application=item,user=assignee.user)
        event(item,request.user,'ASSIGNED',f'{assignee.user.username} affecté au dossier.')
        return Response({'application':item.pk,'user_id':assignee.user_id})
    @action(detail=True,methods=['post'],url_path='start-review')
    def start_review(self,request,pk=None):
        item=self.get_object()
        if item.status!=Application.Status.SUBMITTED:
            raise ValidationError('Seul un dossier soumis peut entrer en évaluation.')
        if item.documents.filter(mandatory=True).exclude(status=RequiredDocument.Status.VALIDATED).exists():
            raise ValidationError('Toutes les pièces obligatoires doivent être validées avant de démarrer l’évaluation.')
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
        scheduled_for=parse_datetime(str(request.data.get('scheduled_for','')))
        if not scheduled_for:
            raise ValidationError({'scheduled_for':'Une date et une heure valides sont requises.'})
        if timezone.is_naive(scheduled_for):
            scheduled_for=timezone.make_aware(scheduled_for,timezone.get_current_timezone())
        if scheduled_for<=timezone.now():
            raise ValidationError({'scheduled_for':'La date de l’audit doit être dans le futur.'})
        ApplicationAssignment.objects.get_or_create(application=item,user=auditor.user)
        audit=Audit.objects.create(application=item,auditor=auditor.user,scheduled_for=scheduled_for)
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
        if severity not in NON_CONFORMITY_SEVERITIES:
            raise ValidationError({'severity':'Gravité inconnue.'})
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
        if item.documents.filter(mandatory=True).exclude(status='VALIDATED').exists():
            raise ValidationError('Toutes les pièces obligatoires doivent être validées avant la décision.')
        item.status=Application.Status.DECISION_PENDING; item.save(update_fields=['status'])
        event(item,request.user,'EVALUATION_COMPLETED',str(request.data.get('note','')))
        return Response(self.get_serializer(item).data)
    @action(detail=True,methods=['post'])
    def decide(self,request,pk=None):
        with transaction.atomic():
            item=self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            if item.status!=Application.Status.DECISION_PENDING:
                raise ValidationError('Le dossier doit être en décision avant validation.')
            decision=request.data.get('decision'); note=str(request.data.get('note',''))
            if decision not in ['CERTIFIED','REJECTED']:
                raise ValidationError({'decision':'CERTIFIED ou REJECTED est requis.'})
            selected_level=request.data.get('level',item.level)
            if decision=='CERTIFIED' and selected_level not in LABEL_LEVELS:
                raise ValidationError({'level':'Standard, Gold ou Platinum est requis pour délivrer un Label.'})
            required_domains={'Standard':1,'Gold':2,'Platinum':3}.get(selected_level)
            if decision=='CERTIFIED' and len(item.domains)!=required_domains:
                raise ValidationError({'level':f'Le niveau {selected_level} ne correspond pas au nombre de volets validés.'})
            item.status=decision
            if decision=='CERTIFIED': item.level=selected_level
            item.save(update_fields=['status','level'] if decision=='CERTIFIED' else ['status'])
            payload={'status':item.status}
            if decision=='CERTIFIED':
                issued_at=timezone.now()
                certificate=Certificate.objects.create(application=item,number='CERT-INPG-'+uuid4().hex[:16].upper(),expires_at=add_years(issued_at,3))
                payload['certificate']=certificate.number
            event(item,request.user,'DECISION_'+decision,note)
        return Response(payload)

class CertificateViewSet(ModelViewSet):
    queryset=Certificate.objects.select_related('application','application__organization').all().order_by('-issued_at')
    serializer_class=CertificateSerializer
    permission_classes=[CapabilityPermission]
    http_method_names=['get','post','head','options']
    action_capabilities={'list':'certificates.read','retrieve':'certificates.read','update_status':'certificates.manage','download':'certificates.read'}
    def get_queryset(self):
        current=role(self.request.user)
        queryset=super().get_queryset()
        if current in ('ADMIN','MANAGER','DECISION_MAKER'):
            return queryset
        if current=='ENTERPRISE':
            access=profile(self.request.user)
            return queryset.filter(application__organization_id=access.organization_id) if access else queryset.none()
        if current in ('EVALUATOR','AUDITOR'):
            return queryset.filter(application__assignments__user=self.request.user).distinct()
        return queryset.none()
    @action(detail=True,methods=['post'],url_path='update-status')
    def update_status(self,request,pk=None):
        requested=request.data.get('status')
        if requested not in Certificate.Status.values:
            raise ValidationError({'status':'VALID, SUSPENDED ou REVOKED est requis.'})
        with transaction.atomic():
            certificate=self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            current=certificate.status
            allowed={
                Certificate.Status.VALID:{Certificate.Status.SUSPENDED,Certificate.Status.REVOKED},
                Certificate.Status.SUSPENDED:{Certificate.Status.VALID,Certificate.Status.REVOKED},
                Certificate.Status.REVOKED:set(),
            }
            if certificate.effective_status=='EXPIRED' and requested!=Certificate.Status.REVOKED:
                raise ValidationError({'status':'Un certificat expiré ne peut pas être réactivé. Un renouvellement est requis.'})
            if requested not in allowed[current]:
                raise ValidationError({'status':'Cette transition de statut n’est pas autorisée.'})
            labels={Certificate.Status.VALID:'réactivé',Certificate.Status.SUSPENDED:'suspendu',Certificate.Status.REVOKED:'révoqué'}
            certificate.status=requested; certificate.save(update_fields=['status'])
            event(certificate.application,request.user,'CERTIFICATE_'+requested,f'Le certificat {certificate.number} a été {labels[requested]}.')
        return Response(self.get_serializer(certificate).data)
    @action(detail=True,methods=['get'])
    def download(self,request,pk=None):
        certificate=self.get_object()
        return FileResponse(certificate_pdf(certificate),as_attachment=True,filename=f'{certificate.number}.pdf',content_type='application/pdf')

class TrainingViewSet(ModelViewSet):
    queryset=Training.objects.all().order_by('starts_at','title')
    serializer_class=TrainingSerializer
    permission_classes=[CapabilityPermission]
    action_capabilities={'list':'trainings.read','retrieve':'trainings.read','create':'trainings.manage','update':'trainings.manage','partial_update':'trainings.manage','destroy':'trainings.manage','enroll':'trainings.enroll'}
    def get_queryset(self):
        queryset=self.queryset
        if role(self.request.user)!='ADMIN':
            queryset=queryset.filter(active=True)
        return queryset.annotate(enrolled_count=Count('enrollments')).prefetch_related('enrollments')
    def get_serializer_context(self):
        return {**super().get_serializer_context()}
    @action(detail=True,methods=['post'])
    def enroll(self,request,pk=None):
        with transaction.atomic():
            training=Training.objects.select_for_update().get(pk=self.get_object().pk)
            if training.enrollments.filter(status__in=['REQUESTED','CONFIRMED','COMPLETED']).count() >= training.capacity:
                raise ValidationError('Cette session est complète.')
            access=profile(request.user)
            organization=access.organization if access and role(request.user)=='ENTERPRISE' else None
            enrollment,created=TrainingEnrollment.objects.get_or_create(training=training,user=request.user,defaults={'organization':organization})
            if not created and enrollment.status==TrainingEnrollment.Status.CANCELLED:
                enrollment.status=TrainingEnrollment.Status.REQUESTED; enrollment.organization=organization; enrollment.save(update_fields=['status','organization'])
            elif not created:
                raise ValidationError('Vous êtes déjà inscrit à cette formation.')
        return Response(TrainingEnrollmentSerializer(enrollment).data,status=201 if created else 200)

class TrainingEnrollmentViewSet(ModelViewSet):
    queryset=TrainingEnrollment.objects.select_related('training','organization','user').order_by('-enrolled_at')
    serializer_class=TrainingEnrollmentSerializer
    permission_classes=[CapabilityPermission]
    http_method_names=['get','post','head','options']
    action_capabilities={'list':'trainings.enroll','retrieve':'trainings.enroll','update_status':'trainings.manage'}
    def get_queryset(self):
        if role(self.request.user)=='ADMIN':
            return self.queryset
        return self.queryset.filter(user=self.request.user)
    @action(detail=True,methods=['post'],url_path='update-status')
    def update_status(self,request,pk=None):
        enrollment=self.get_object(); requested=request.data.get('status')
        allowed={
            TrainingEnrollment.Status.REQUESTED:{TrainingEnrollment.Status.CONFIRMED,TrainingEnrollment.Status.CANCELLED},
            TrainingEnrollment.Status.CONFIRMED:{TrainingEnrollment.Status.COMPLETED,TrainingEnrollment.Status.CANCELLED},
            TrainingEnrollment.Status.CANCELLED:{TrainingEnrollment.Status.REQUESTED},
            TrainingEnrollment.Status.COMPLETED:set(),
        }
        if requested not in allowed.get(enrollment.status,set()):
            raise ValidationError({'status':'Transition de statut non autorisée.'})
        enrollment.status=requested; enrollment.save(update_fields=['status'])
        return Response(self.get_serializer(enrollment).data)

class AuditViewSet(ModelViewSet):
    queryset=Audit.objects.select_related('application','application__organization','auditor').order_by('-scheduled_for','-id')
    serializer_class=AuditSerializer
    permission_classes=[CapabilityPermission]
    http_method_names=['get','head','options']
    action_capabilities={'list':'audits.read','retrieve':'audits.read'}
    def get_queryset(self):
        current=role(self.request.user)
        if current in ('ADMIN','MANAGER','DECISION_MAKER'):
            return self.queryset
        if current in ('AUDITOR','EVALUATOR'):
            return self.queryset.filter(auditor=self.request.user)
        return self.queryset.none()

class NonConformityViewSet(ModelViewSet):
    queryset=NonConformity.objects.select_related('application','application__organization').order_by('-created_at','-id')
    serializer_class=NonConformitySerializer
    permission_classes=[CapabilityPermission]
    http_method_names=['get','head','options']
    action_capabilities={'list':'evaluations.read','retrieve':'evaluations.read'}
    def get_queryset(self):
        current=role(self.request.user)
        if current in ('ADMIN','MANAGER','DECISION_MAKER'):
            return self.queryset
        if current in ('EVALUATOR','AUDITOR'):
            return self.queryset.filter(application__assignments__user=self.request.user).distinct()
        return self.queryset.none()

class RequirementTemplateViewSet(ModelViewSet):
    queryset=RequirementTemplate.objects.all().order_by('domain','activity','name')
    serializer_class=RequirementTemplateSerializer
    permission_classes=[CapabilityPermission]
    action_capabilities={'list':'referentials.manage','retrieve':'referentials.manage','create':'referentials.manage','update':'referentials.manage','partial_update':'referentials.manage','destroy':'referentials.manage'}

class ApplicationMessageViewSet(ModelViewSet):
    queryset=ApplicationMessage.objects.select_related('application','author').all()
    serializer_class=ApplicationMessageSerializer
    permission_classes=[CapabilityPermission]
    http_method_names=['get','post','head','options']
    action_capabilities={'list':'applications.read','retrieve':'applications.read','create':'applications.read'}
    def get_queryset(self):
        base=super().get_queryset()
        application_id=self.request.query_params.get('application')
        if not application_id:
            return base.none()
        try:
            application=Application.objects.get(pk=application_id)
        except Application.DoesNotExist:
            return base.none()
        return base.filter(application=application) if can_access_application(self.request.user,application) else base.none()
    def perform_create(self,serializer):
        application_id=self.request.data.get('application')
        application=Application.objects.filter(pk=application_id).first()
        if not application or not can_access_application(self.request.user,application):
            raise PermissionDenied('Dossier introuvable ou non autorisé.')
        body=str(self.request.data.get('body','')).strip()
        if not body:
            raise ValidationError({'body':'Un message est requis.'})
        serializer.save(application=application,author=self.request.user,body=body)

class NotificationViewSet(ModelViewSet):
    queryset=Notification.objects.all()
    serializer_class=NotificationSerializer
    permission_classes=[CapabilityPermission]
    http_method_names=['get','post','head','options']
    action_capabilities={'list':'applications.read','retrieve':'applications.read','mark_read':'applications.read'}
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)
    @action(detail=True,methods=['post'],url_path='mark-read')
    def mark_read(self,request,pk=None):
        item=self.get_object(); item.read_at=timezone.now(); item.save(update_fields=['read_at'])
        return Response(self.get_serializer(item).data)

class RequiredDocumentViewSet(ModelViewSet):
    queryset=RequiredDocument.objects.select_related('application','application__organization').all()
    serializer_class=RequiredDocumentSerializer
    permission_classes=[CapabilityPermission]
    parser_classes=[MultiPartParser,FormParser,JSONParser]
    action_capabilities={'list':'applications.read','retrieve':'applications.read','upload':'documents.upload','review':'documents.review','download':'applications.read'}
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
        expected_header=ALLOWED_UPLOAD_TYPES.get(uploaded.content_type)
        if not expected_header or not uploaded.name.lower().endswith({ 'application/pdf':'.pdf','image/png':'.png','image/jpeg':('.jpg','.jpeg') }[uploaded.content_type]):
            raise ValidationError({'file':'Seuls les fichiers PDF, PNG et JPEG sont acceptés.'})
        header=uploaded.read(8); uploaded.seek(0)
        if not header.startswith(expected_header):
            raise ValidationError({'file':'Le contenu du fichier ne correspond pas à son type déclaré.'})
        if uploaded.content_type=='application/pdf':
            uploaded.seek(max(0,uploaded.size-2048)); tail=uploaded.read(); uploaded.seek(0)
            if b'%%EOF' not in tail:
                raise ValidationError({'file':'Le fichier PDF est incomplet ou invalide.'})
        else:
            try:
                Image.open(uploaded).verify(); uploaded.seek(0)
            except (UnidentifiedImageError,OSError,ValueError):
                raise ValidationError({'file':'L’image est incomplète ou invalide.'})
        used=0
        other_files=RequiredDocument.objects.filter(application__organization_id=application.organization_id).exclude(pk=document.pk).exclude(file='')
        for item in other_files:
            if item.file:
                try: used+=item.file.size
                except OSError: pass
        if used+uploaded.size>settings.MAX_APPLICATION_UPLOAD_BYTES:
            raise ValidationError({'file':'Le quota de stockage de l’entreprise est dépassé.'})
        old_name=document.file.name if document.file else ''
        document.file=uploaded; document.status=RequiredDocument.Status.SUBMITTED; document.submitted_at=timezone.now(); document.review_comment=''
        document.save(update_fields=['file','status','submitted_at','review_comment'])
        if old_name and old_name!=document.file.name:
            default_storage.delete(old_name)
        event(application,request.user,'DOCUMENT_UPLOADED',document.name)
        return Response(self.get_serializer(document).data)
    @action(detail=True,methods=['get'])
    def download(self,request,pk=None):
        document=self.get_object()
        if not document.file:
            raise ValidationError('Aucun fichier n’est associé à cette pièce.')
        content_type=mimetypes.guess_type(document.file.name)[0] or 'application/octet-stream'
        return FileResponse(document.file.open('rb'),as_attachment=True,filename=document.file.name.rsplit('/',1)[-1],content_type=content_type)
    @action(detail=True,methods=['post'])
    def review(self,request,pk=None):
        document=self.get_object(); outcome=request.data.get('status'); comment=str(request.data.get('comment',''))
        if outcome not in [RequiredDocument.Status.VALIDATED,RequiredDocument.Status.REJECTED]:
            raise ValidationError({'status':'VALIDATED ou REJECTED est requis.'})
        if document.status!=RequiredDocument.Status.SUBMITTED:
            raise ValidationError('Seul un document déposé peut être revu.')
        document.status=outcome; document.review_comment=comment; document.reviewed_at=timezone.now(); document.save(update_fields=['status','review_comment','reviewed_at'])
        if outcome==RequiredDocument.Status.REJECTED and document.application.status in [Application.Status.SUBMITTED,Application.Status.UNDER_REVIEW]:
            document.application.status=Application.Status.CORRECTION_REQUIRED
            document.application.save(update_fields=['status'])
        event(document.application,request.user,'DOCUMENT_'+outcome,f'{document.name} : {comment}')
        return Response(self.get_serializer(document).data)

from urllib.parse import quote
from django.conf import settings
from rest_framework import serializers
from .catalog import ACTIVITIES, DOMAINS, LABEL_LEVELS, NON_CONFORMITY_SEVERITIES
from .models import Organization, Application, RequiredDocument, WorkflowEvent, Audit, NonConformity, Certificate, Training, TrainingEnrollment, RequirementTemplate, ApplicationMessage, Notification
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model=Organization
        fields='__all__'
        read_only_fields=['ninea']
    def validate_activity(self,value):
        if value not in ACTIVITIES:
            raise serializers.ValidationError('Activité inconnue.')
        return value
class RequiredDocumentSerializer(serializers.ModelSerializer):
    file=serializers.SerializerMethodField()
    class Meta:
        model=RequiredDocument
        fields=['id','application','domain','name','mandatory','status','file','review_comment','submitted_at','reviewed_at']
        read_only_fields=['application','domain','name','mandatory','status','file','review_comment','submitted_at','reviewed_at']
    def get_file(self,obj):
        if not obj.file:
            return None
        path=f'/api/v1/documents/{obj.pk}/download/'
        request=self.context.get('request')
        return request.build_absolute_uri(path) if request else path
class WorkflowEventSerializer(serializers.ModelSerializer):
    actor_name=serializers.CharField(source='actor.username',read_only=True)
    class Meta: model=WorkflowEvent; fields=['id','event_type','note','created_at','actor_name']
class AuditSerializer(serializers.ModelSerializer):
    auditor_name=serializers.CharField(source='auditor.username',read_only=True)
    class Meta: model=Audit; fields=['id','application','auditor','auditor_name','scheduled_for','performed_at','status','summary']
class NonConformitySerializer(serializers.ModelSerializer):
    class Meta: model=NonConformity; fields=['id','application','reference','domain','description','severity','status','response','created_at']
class CertificateSerializer(serializers.ModelSerializer):
    status=serializers.SerializerMethodField()
    stored_status=serializers.CharField(source='status',read_only=True)
    is_active=serializers.BooleanField(read_only=True)
    application_id=serializers.IntegerField(source='application.id',read_only=True)
    application_reference=serializers.CharField(source='application.reference',read_only=True)
    organization_name=serializers.CharField(source='application.organization.legal_name',read_only=True)
    label_level=serializers.CharField(source='application.level',read_only=True)
    domains=serializers.ListField(source='application.domains',read_only=True)
    verification_url=serializers.SerializerMethodField()
    class Meta: model=Certificate; fields=['id','number','issued_at','expires_at','status','stored_status','is_active','application_id','application_reference','organization_name','label_level','domains','verification_url']
    def get_status(self,obj):
        return obj.effective_status
    def get_verification_url(self,obj):
        template=settings.PUBLIC_CERTIFICATE_VERIFICATION_URL
        return template.format(number=quote(obj.number,safe=''))
class TrainingSerializer(serializers.ModelSerializer):
    enrollment_status=serializers.SerializerMethodField()
    enrolled_count=serializers.IntegerField(read_only=True)
    class Meta:
        model=Training
        fields=['id','title','description','duration_days','format','starts_at','capacity','active','created_at','enrollment_status','enrolled_count']
        read_only_fields=['created_at','enrollment_status','enrolled_count']
    def get_enrollment_status(self,obj):
        user=self.context['request'].user
        enrollment=obj.enrollments.filter(user=user).first() if user.is_authenticated else None
        return enrollment.status if enrollment else None
class TrainingEnrollmentSerializer(serializers.ModelSerializer):
    training_title=serializers.CharField(source='training.title',read_only=True)
    user=serializers.IntegerField(source='user_id',read_only=True)
    user_name=serializers.CharField(source='user.username',read_only=True)
    organization_name=serializers.CharField(source='organization.legal_name',read_only=True)
    class Meta:
        model=TrainingEnrollment
        fields=['id','training','training_title','user','user_name','organization','organization_name','status','enrolled_at']
        read_only_fields=['organization','organization_name','status','enrolled_at','user','user_name']
class RequirementTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model=RequirementTemplate
        fields='__all__'
        read_only_fields=['created_at']
    def validate_domain(self,value):
        if value not in DOMAINS:
            raise serializers.ValidationError('Volet inconnu.')
        return value
    def validate_activity(self,value):
        if value and value not in ACTIVITIES:
            raise serializers.ValidationError('Activité inconnue.')
        return value
class ApplicationMessageSerializer(serializers.ModelSerializer):
    author_name=serializers.CharField(source='author.username',read_only=True)
    class Meta:
        model=ApplicationMessage
        fields=['id','application','author_name','body','created_at']
        read_only_fields=['author_name','created_at']
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model=Notification
        fields=['id','title','body','url','read_at','created_at']
        read_only_fields=['title','body','url','created_at']
class ApplicationSerializer(serializers.ModelSerializer):
    documents=RequiredDocumentSerializer(many=True,read_only=True)
    events=WorkflowEventSerializer(many=True,read_only=True)
    audits=AuditSerializer(many=True,read_only=True)
    non_conformities=NonConformitySerializer(many=True,read_only=True)
    certificate=CertificateSerializer(read_only=True)
    certification_status=serializers.SerializerMethodField()
    has_active_certificate=serializers.SerializerMethodField()
    messages=ApplicationMessageSerializer(many=True,read_only=True)
    class Meta: model=Application; fields='__all__'; read_only_fields=['reference','status','created_at']
    def get_certification_status(self,obj):
        try:
            return obj.certificate.effective_status
        except Certificate.DoesNotExist:
            return None
    def get_has_active_certificate(self,obj):
        try:
            return obj.certificate.is_active
        except Certificate.DoesNotExist:
            return False
    def validate_level(self,value):
        if value not in LABEL_LEVELS:
            raise serializers.ValidationError('Niveau inconnu.')
        return value
    def validate_activity(self,value):
        if value not in ACTIVITIES:
            raise serializers.ValidationError('Activité inconnue.')
        return value
    def validate_domains(self,value):
        if not isinstance(value,list) or not value:
            raise serializers.ValidationError('Sélectionnez au moins un volet.')
        if any(not isinstance(domain,str) or domain not in DOMAINS for domain in value):
            raise serializers.ValidationError('Un ou plusieurs volets sont inconnus.')
        if len(value)!=len(set(value)):
            raise serializers.ValidationError('Un volet ne peut pas être sélectionné plusieurs fois.')
        return value
    def validate(self,attrs):
        attrs=super().validate(attrs)
        level=attrs.get('level',getattr(self.instance,'level',None))
        domains=attrs.get('domains',getattr(self.instance,'domains',None))
        expected={'Standard':1,'Gold':2,'Platinum':3}.get(level)
        if expected and domains is not None and len(domains)!=expected:
            raise serializers.ValidationError({'domains':f'Le niveau {level} exige exactement {expected} volet(s).'})
        return attrs

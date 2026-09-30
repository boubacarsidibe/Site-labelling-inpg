from rest_framework import serializers
from .models import Organization, Application, RequiredDocument, WorkflowEvent, Audit, NonConformity, Certificate
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta: model=Organization; fields='__all__'
class RequiredDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model=RequiredDocument
        fields=['id','application','domain','name','mandatory','status','file','review_comment','submitted_at','reviewed_at']
        read_only_fields=['application','domain','name','mandatory','status','file','review_comment','submitted_at','reviewed_at']
class WorkflowEventSerializer(serializers.ModelSerializer):
    actor_name=serializers.CharField(source='actor.username',read_only=True)
    class Meta: model=WorkflowEvent; fields=['id','event_type','note','created_at','actor_name']
class AuditSerializer(serializers.ModelSerializer):
    auditor_name=serializers.CharField(source='auditor.username',read_only=True)
    class Meta: model=Audit; fields=['id','application','auditor','auditor_name','scheduled_for','performed_at','status','summary']
class NonConformitySerializer(serializers.ModelSerializer):
    class Meta: model=NonConformity; fields=['id','application','reference','domain','description','severity','status','response','created_at']
class CertificateSerializer(serializers.ModelSerializer):
    application_id=serializers.IntegerField(source='application.id',read_only=True)
    application_reference=serializers.CharField(source='application.reference',read_only=True)
    organization_name=serializers.CharField(source='application.organization.legal_name',read_only=True)
    label_level=serializers.CharField(source='application.level',read_only=True)
    domains=serializers.ListField(source='application.domains',read_only=True)
    class Meta: model=Certificate; fields=['id','number','issued_at','status','application_id','application_reference','organization_name','label_level','domains']
class ApplicationSerializer(serializers.ModelSerializer):
    documents=RequiredDocumentSerializer(many=True,read_only=True)
    events=WorkflowEventSerializer(many=True,read_only=True)
    audits=AuditSerializer(many=True,read_only=True)
    non_conformities=NonConformitySerializer(many=True,read_only=True)
    certificate=CertificateSerializer(read_only=True)
    class Meta: model=Application; fields='__all__'; read_only_fields=['reference','status','created_at']

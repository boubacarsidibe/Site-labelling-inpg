from rest_framework import serializers
from .access import role
from .models import Organization, Application, RequiredDocument, WorkflowEvent, Audit, NonConformity, Certificate, RequirementTemplate, Invitation, AccessProfile
from .services import EVENT_LABELS

CERT_LABELS = {'VALID': 'Valide', 'SUSPENDED': 'Suspendu', 'REVOKED': 'Révoqué', 'EXPIRED': 'Expiré'}

class OrganizationSerializer(serializers.ModelSerializer):
    is_verified = serializers.BooleanField(read_only=True)
    class Meta:
        model = Organization
        fields = ['id', 'legal_name', 'ninea', 'activity', 'address', 'is_verified', 'verified_at']
        read_only_fields = ['verified_at']
    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        # Raison sociale et NINEA sont figés pour l'entreprise : seule l'administration les corrige.
        if request and role(request.user) == 'ENTERPRISE' and self.instance is not None:
            fields['legal_name'].read_only = True
            fields['ninea'].read_only = True
        return fields

class RequiredDocumentSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    file_name = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    class Meta:
        model = RequiredDocument
        fields = ['id', 'application', 'domain', 'name', 'mandatory', 'status', 'status_label', 'file_name', 'download_url', 'review_comment', 'submitted_at', 'reviewed_at']
        read_only_fields = fields
    def get_file_name(self, obj):
        return obj.file.name.rsplit('/', 1)[-1] if obj.file else None
    def get_download_url(self, obj):
        # URL relative : passe par le proxy de l'interface et par le contrôle des droits de l'API.
        return f'/api/v1/documents/{obj.pk}/download/' if obj.file else None

class WorkflowEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True, default=None)
    event_label = serializers.SerializerMethodField()
    class Meta:
        model = WorkflowEvent
        fields = ['id', 'event_type', 'event_label', 'note', 'created_at', 'actor_name']
    def get_event_label(self, obj):
        return EVENT_LABELS.get(obj.event_type, obj.event_type)

class AuditSerializer(serializers.ModelSerializer):
    auditor_name = serializers.CharField(source='auditor.username', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    application_reference = serializers.CharField(source='application.reference', read_only=True)
    organization_name = serializers.CharField(source='application.organization.legal_name', read_only=True)
    class Meta:
        model = Audit
        fields = ['id', 'application', 'application_reference', 'organization_name', 'auditor', 'auditor_name', 'scheduled_for', 'performed_at', 'status', 'status_label', 'summary']

class NonConformitySerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    severity_label = serializers.CharField(source='get_severity_display', read_only=True)
    application_reference = serializers.CharField(source='application.reference', read_only=True)
    organization_name = serializers.CharField(source='application.organization.legal_name', read_only=True)
    class Meta:
        model = NonConformity
        fields = ['id', 'application', 'application_reference', 'organization_name', 'reference', 'domain', 'description', 'severity', 'severity_label', 'status', 'status_label', 'response', 'rejection_reason', 'due_date', 'created_at']

class CertificateSerializer(serializers.ModelSerializer):
    application_id = serializers.IntegerField(source='application.id', read_only=True)
    application_reference = serializers.CharField(source='application.reference', read_only=True)
    organization_name = serializers.CharField(source='application.organization.legal_name', read_only=True)
    label_level = serializers.CharField(source='level', read_only=True)
    effective_status = serializers.CharField(read_only=True)
    status_label = serializers.SerializerMethodField()
    class Meta:
        model = Certificate
        fields = ['id', 'number', 'issued_at', 'expires_at', 'status', 'effective_status', 'status_label', 'application_id', 'application_reference', 'organization_name', 'level', 'label_level', 'domains']
    def get_status_label(self, obj):
        return CERT_LABELS.get(obj.effective_status, obj.effective_status)

class AssignmentSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(source='user.id')
    username = serializers.CharField(source='user.username')
    role = serializers.CharField(source='user.access_profile.role', default='')

class ApplicationSerializer(serializers.ModelSerializer):
    documents = RequiredDocumentSerializer(many=True, read_only=True)
    events = WorkflowEventSerializer(many=True, read_only=True)
    audits = AuditSerializer(many=True, read_only=True)
    non_conformities = NonConformitySerializer(many=True, read_only=True)
    certificate = CertificateSerializer(read_only=True)
    assignments = AssignmentSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    organization_name = serializers.CharField(source='organization.legal_name', read_only=True)
    organization_verified = serializers.BooleanField(source='organization.is_verified', read_only=True)
    class Meta:
        model = Application
        fields = '__all__'
        read_only_fields = ['reference', 'status', 'created_at', 'updated_at', 'level', 'decision_note']

class ApplicationListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    organization_name = serializers.CharField(source='organization.legal_name', read_only=True)
    certificate = CertificateSerializer(read_only=True)
    open_non_conformities = serializers.IntegerField(read_only=True, default=0)
    class Meta:
        model = Application
        fields = ['id', 'reference', 'organization', 'organization_name', 'level', 'status', 'status_label', 'kind', 'domains', 'created_at', 'updated_at', 'certificate', 'open_non_conformities']

class RequirementTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequirementTemplate
        fields = ['id', 'domain', 'activity', 'name', 'mandatory', 'active', 'order']

class MemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    email = serializers.CharField(source='user.email')
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    is_active = serializers.BooleanField(source='user.is_active')
    class Meta:
        model = AccessProfile
        fields = ['username', 'email', 'first_name', 'last_name', 'is_owner', 'is_active']

class InvitationSerializer(serializers.ModelSerializer):
    invited_by_name = serializers.CharField(source='invited_by.username', read_only=True)
    class Meta:
        model = Invitation
        fields = ['id', 'email', 'created_at', 'expires_at', 'accepted_at', 'invited_by_name']
        read_only_fields = ['created_at', 'expires_at', 'accepted_at']

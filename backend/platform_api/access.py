from rest_framework.permissions import BasePermission
from .models import AccessProfile

CAPABILITIES = {
    'PROFESSIONAL': ['portal.professional'],
    'ENTERPRISE': ['portal.enterprise', 'organizations.read', 'organizations.update', 'applications.read', 'applications.create', 'applications.update', 'applications.submit', 'documents.upload', 'corrections.respond'],
    'MANAGER': ['portal.admin', 'organizations.read', 'applications.read', 'applications.assign', 'applications.review', 'documents.review', 'audits.schedule'],
    'EVALUATOR': ['portal.admin', 'applications.read', 'evaluations.read', 'evaluations.perform', 'corrections.request'],
    'AUDITOR': ['portal.admin', 'applications.read', 'audits.read', 'audits.perform', 'corrections.request'],
    'DECISION_MAKER': ['portal.admin', 'applications.read', 'decisions.read', 'decisions.make', 'certificates.read'],
    'ADMIN': ['portal.admin', 'organizations.read', 'organizations.create', 'organizations.update', 'organizations.delete', 'applications.read', 'applications.create', 'applications.update', 'applications.delete', 'applications.submit', 'applications.assign', 'applications.review', 'documents.review', 'documents.upload', 'evaluations.read', 'evaluations.perform', 'audits.read', 'audits.schedule', 'audits.perform', 'corrections.request', 'corrections.respond', 'decisions.read', 'decisions.make', 'certificates.read', 'certificates.manage', 'users.manage', 'referentials.manage'],
}

def profile(user):
    if not user.is_authenticated or not user.is_active:
        return None
    return AccessProfile.objects.filter(user=user).first()

def role(user):
    if not user.is_authenticated or not user.is_active:
        return None
    if user.is_superuser:
        return 'ADMIN'
    access=profile(user)
    if not access or (access.role=='ENTERPRISE' and not access.organization_id):
        return None
    return access.role

def capabilities(user):
    result=list(CAPABILITIES.get(role(user), []))
    if user.is_authenticated and user.is_active and user.is_superuser:
        result.append('administrators.create')
    return result

class CapabilityPermission(BasePermission):
    message='Vous ne disposez pas des droits nécessaires.'
    def has_permission(self, request, view):
        required=view.action_capabilities.get(view.action)
        return bool(required and required in capabilities(request.user))

from rest_framework.permissions import BasePermission
from .models import AccessProfile, Application

# Capacités par rôle : source unique des droits. L'interface les lit via /auth/me/ et n'a pas sa propre copie.
_STAFF_READ = ['portal.admin', 'applications.read', 'documents.download', 'nonconformities.read']
CAPABILITIES = {
    'PROFESSIONAL': ['portal.professional'],
    'ENTERPRISE': ['portal.enterprise', 'organizations.read', 'organizations.update', 'applications.read', 'applications.create', 'applications.update', 'applications.delete', 'applications.submit', 'documents.upload', 'documents.download', 'corrections.respond', 'certificates.read', 'nonconformities.read', 'members.read'],
    'MANAGER': _STAFF_READ + ['organizations.read', 'organizations.verify', 'applications.assign', 'applications.review', 'documents.review', 'audits.read', 'audits.schedule', 'evaluations.read', 'certificates.read'],
    'EVALUATOR': _STAFF_READ + ['documents.review', 'evaluations.read', 'evaluations.perform', 'corrections.request', 'audits.read'],
    'AUDITOR': _STAFF_READ + ['audits.read', 'audits.perform', 'corrections.request'],
    'DECISION_MAKER': _STAFF_READ + ['evaluations.read', 'audits.read', 'decisions.read', 'decisions.make', 'certificates.read'],
    'ADMIN': _STAFF_READ + ['organizations.read', 'organizations.create', 'organizations.update', 'organizations.delete', 'organizations.verify', 'applications.create', 'applications.update', 'applications.delete', 'applications.submit', 'applications.assign', 'applications.review', 'documents.review', 'documents.upload', 'evaluations.read', 'evaluations.perform', 'audits.read', 'audits.schedule', 'audits.perform', 'corrections.request', 'corrections.respond', 'decisions.read', 'decisions.make', 'certificates.read', 'certificates.manage', 'users.manage', 'referentials.manage', 'members.read'],
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
        result += ['administrators.create', 'accounts.manage']
    access=profile(user)
    if access and access.role=='ENTERPRISE' and access.is_owner and role(user)=='ENTERPRISE':
        result.append('members.invite')
    return result

def visible_applications(user):
    """Dossiers visibles selon le rôle. Le décideur ne voit pas les brouillons ; évaluateurs et auditeurs ne voient que leurs dossiers affectés."""
    current=role(user)
    qs=Application.objects.all()
    if current in ('ADMIN','MANAGER'):
        return qs
    if current=='DECISION_MAKER':
        return qs.exclude(status=Application.Status.DRAFT)
    if current=='ENTERPRISE':
        return qs.filter(organization_id=profile(user).organization_id)
    if current in ('AUDITOR','EVALUATOR'):
        return qs.filter(assignments__user=user).distinct()
    return qs.none()

class CapabilityPermission(BasePermission):
    message='Vous ne disposez pas des droits nécessaires.'
    def has_permission(self, request, view):
        required=view.action_capabilities.get(view.action)
        return bool(required and required in capabilities(request.user))

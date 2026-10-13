from rest_framework.routers import DefaultRouter
from django.urls import path
from . import auth_views
from .registration import register, invitations, invitation_detail, invitation_accept
from .admin_accounts import accounts, set_account_active
from .public_views import verify_certificate
from .workflow_views import assignable_users
from .views import OrganizationViewSet, ApplicationViewSet, RequiredDocumentViewSet, CertificateViewSet, AuditViewSet, NonConformityViewSet, RequirementTemplateViewSet
router=DefaultRouter()
router.register('organizations',OrganizationViewSet); router.register('applications',ApplicationViewSet); router.register('documents',RequiredDocumentViewSet)
router.register('certificates',CertificateViewSet); router.register('audits',AuditViewSet); router.register('non-conformities',NonConformityViewSet)
router.register('requirements',RequirementTemplateViewSet)
urlpatterns=[
    path('auth/register/',register),path('auth/csrf/',auth_views.csrf),path('auth/login/',auth_views.sign_in),path('auth/logout/',auth_views.sign_out),path('auth/me/',auth_views.me),
    path('auth/password-reset/',auth_views.password_reset),path('auth/password-reset/confirm/',auth_views.password_reset_confirm),path('auth/password-change/',auth_views.password_change),
    path('meta/',auth_views.meta),
    path('invitations/',invitations),path('invitations/<str:token>/',invitation_detail),path('invitations/<str:token>/accept/',invitation_accept),
    path('public/certificates/<str:number>/',verify_certificate),
    path('admin/accounts/',accounts),
    path('admin/accounts/<int:user_id>/set-active/',set_account_active),
    path('workflow/assignable-users/',assignable_users),
]+router.urls

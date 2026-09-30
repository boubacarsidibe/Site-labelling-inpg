from rest_framework.routers import DefaultRouter
from django.urls import path
from . import auth_views
from .registration import register
from .admin_accounts import create_internal_account
from .workflow_views import assignable_users
from .views import OrganizationViewSet, ApplicationViewSet, RequiredDocumentViewSet, CertificateViewSet
router=DefaultRouter(); router.register('organizations',OrganizationViewSet); router.register('applications',ApplicationViewSet); router.register('documents',RequiredDocumentViewSet); router.register('certificates',CertificateViewSet)
router_urls=router.urls
router_urls += [path('admin/accounts/',create_internal_account),path('workflow/assignable-users/',assignable_users)]
urlpatterns=[path('auth/register/',register),path('auth/csrf/',auth_views.csrf),path('auth/login/',auth_views.sign_in),path('auth/logout/',auth_views.sign_out),path('auth/me/',auth_views.me)]+router_urls

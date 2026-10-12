from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from .models import AccessProfile, Organization

class RegistrationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client=APIClient()
        self.payload={'kind':'PROFESSIONAL','username':'apprenant','email':'person@example.test','first_name':'Awa','last_name':'Diop','password':'Robust-example-592!'}
    def test_professional_has_no_enterprise_access(self):
        result=self.client.post('/api/v1/auth/register/',self.payload,format='json')
        self.assertEqual(result.status_code,201)
        user=get_user_model().objects.get(username='apprenant')
        self.assertFalse(user.is_staff or user.is_superuser)
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get('/api/v1/applications/').status_code,403)
    def test_no_public_internal_role(self):
        for role in ['ADMIN','MANAGER','EVALUATOR','AUDITOR','DECISION_MAKER']:
            self.assertEqual(self.client.post('/api/v1/auth/register/',{**self.payload,'kind':role},format='json').status_code,400)
        self.assertEqual(get_user_model().objects.count(),0)
    def test_extra_privileges_ignored(self):
        self.assertEqual(self.client.post('/api/v1/auth/register/',{**self.payload,'role':'ADMIN','is_superuser':True,'is_staff':True},format='json').status_code,201)
        user=get_user_model().objects.get()
        self.assertFalse(user.is_superuser or user.is_staff)
        self.assertEqual(user.access_profile.role,'PROFESSIONAL')
    def test_existing_organization_never_claimed(self):
        Organization.objects.create(ninea='123',legal_name='Existing',activity='',address='')
        result=self.client.post('/api/v1/auth/register/',{**self.payload,'kind':'ENTERPRISE','legal_name':'Other','ninea':'123'},format='json')
        self.assertEqual(result.status_code,400)
        self.assertEqual(get_user_model().objects.count(),0)
    def test_enterprise_own_new_organization(self):
        self.assertEqual(self.client.post('/api/v1/auth/register/',{**self.payload,'kind':'ENTERPRISE','legal_name':'New','ninea':'456'},format='json').status_code,201)
        self.assertEqual(AccessProfile.objects.get().organization.ninea,'456')
    def test_registration_csrf_and_password(self):
        client=APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/v1/auth/register/',self.payload,format='json').status_code,403)
        self.assertEqual(self.client.post('/api/v1/auth/register/',{**self.payload,'password':'123'},format='json').status_code,400)
    def test_admin_creation_superuser_only(self):
        payload={'username':'gestionnaire','email':'internal@example.test','password':'Strong-internal-852!','role':'ADMIN','is_superuser':True}
        self.assertEqual(self.client.post('/api/v1/admin/accounts/',payload,format='json').status_code,401)
        admin=get_user_model().objects.create_user(username='admin')
        AccessProfile.objects.create(user=admin,role='ADMIN')
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post('/api/v1/admin/accounts/',payload,format='json').status_code,403)
        root=get_user_model().objects.create_superuser(username='root',password='Strong-root-852!')
        self.client.force_authenticate(root)
        self.assertEqual(self.client.post('/api/v1/admin/accounts/',payload,format='json').status_code,201)
        created=get_user_model().objects.get(username='gestionnaire')
        self.assertFalse(created.is_superuser)
        self.assertEqual(created.access_profile.role,'ADMIN')

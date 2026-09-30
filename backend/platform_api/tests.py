from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Organization, Application, RequiredDocument, AccessProfile, ApplicationAssignment

class RBACTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.a=Organization.objects.create(legal_name='A',ninea='A',activity='Distribution',address='Dakar')
        cls.b=Organization.objects.create(legal_name='B',ninea='B',activity='Stockage',address='Dakar')
        cls.dossier=Application.objects.create(organization=cls.a,reference='A-1',level='Gold',domains=['Sécurité','Qualité'])
        cls.other=Application.objects.create(organization=cls.b,reference='B-1',level='Standard',domains=['Sécurité'])
        cls.users={}
        for role in AccessProfile.Role.values:
            user=get_user_model().objects.create_user(username=role,password='Test-password-123!')
            AccessProfile.objects.create(user=user,role=role,organization=cls.a if role=='ENTERPRISE' else None)
            cls.users[role]=user
        cls.unassigned=get_user_model().objects.create_user(username='no-role',password='Test-password-123!')
    def setUp(self):
        self.client=APIClient()
        cache.clear()
    def as_role(self,role):
        self.client.force_authenticate(self.users[role])
    def test_anonymous_denied(self):
        for endpoint in ['organizations','applications']:
            self.assertEqual(self.client.get('/api/v1/'+endpoint+'/').status_code,403)
    def test_no_role_denied(self):
        self.client.force_authenticate(self.unassigned)
        self.assertEqual(self.client.get('/api/v1/applications/').status_code,403)
    def test_enterprise_list_scoped(self):
        self.as_role('ENTERPRISE')
        self.assertEqual([d['id'] for d in self.client.get('/api/v1/applications/').json()],[self.dossier.pk])
        self.assertEqual([d['id'] for d in self.client.get('/api/v1/organizations/').json()],[self.a.pk])
    def test_cross_company_object_actions_denied(self):
        self.as_role('ENTERPRISE')
        url=f'/api/v1/applications/{self.other.pk}/'
        for method,data in [('get',{}),('patch',{'level':'Platinum'}),('put',{})]:
            self.assertEqual(getattr(self.client,method)(url,data,format='json').status_code,404)
        self.assertEqual(self.client.post(url+'submit/').status_code,404)
        self.assertEqual(self.client.delete(url).status_code,403)
    def test_cross_company_organization_denied(self):
        self.as_role('ENTERPRISE')
        self.assertEqual(self.client.patch(f'/api/v1/organizations/{self.b.pk}/',{'legal_name':'stolen'},format='json').status_code,404)
    def test_create_scope_and_readonly_fields(self):
        self.as_role('ENTERPRISE')
        data={'organization':self.b.pk,'level':'Gold','domains':['Sécurité','Qualité']}
        self.assertEqual(self.client.post('/api/v1/applications/',data,format='json').status_code,403)
        data.update(organization=self.a.pk,status='SUBMITTED',reference='HACK',role='ADMIN')
        result=self.client.post('/api/v1/applications/',data,format='json')
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json()['status'],'DRAFT')
        self.assertNotEqual(result.json()['reference'],'HACK')
        self.assertEqual(AccessProfile.objects.get(user=self.users['ENTERPRISE']).role,'ENTERPRISE')
    def test_cannot_transfer_own_dossier(self):
        self.as_role('ENTERPRISE')
        self.assertEqual(self.client.patch(f'/api/v1/applications/{self.dossier.pk}/',{'organization':self.b.pk},format='json').status_code,403)
    def test_enterprise_cannot_create_organization(self):
        self.as_role('ENTERPRISE')
        self.assertEqual(self.client.post('/api/v1/organizations/',{},format='json').status_code,403)
    def test_staff_readonly_matrix(self):
        for role in ['MANAGER','EVALUATOR','AUDITOR','DECISION_MAKER']:
            self.as_role(role)
            self.assertEqual(self.client.post('/api/v1/applications/',{},format='json').status_code,403)
            self.assertEqual(self.client.patch(f'/api/v1/applications/{self.dossier.pk}/',{},format='json').status_code,403)
            self.assertEqual(self.client.post(f'/api/v1/applications/{self.dossier.pk}/submit/').status_code,403)
    def test_assigned_readers_only(self):
        for role in ['EVALUATOR','AUDITOR']:
            self.as_role(role)
            self.assertEqual(self.client.get('/api/v1/applications/').json(),[])
            self.assertEqual(self.client.get(f'/api/v1/applications/{self.dossier.pk}/').status_code,404)
            assignment=ApplicationAssignment.objects.create(user=self.users[role],application=self.dossier)
            self.assertEqual(self.client.get(f'/api/v1/applications/{self.dossier.pk}/').status_code,200)
            assignment.delete()
            self.assertEqual(self.client.get(f'/api/v1/applications/{self.dossier.pk}/').status_code,404)
    def test_manager_assignment_and_denial(self):
        url=f'/api/v1/applications/{self.dossier.pk}/assign/'
        self.as_role('ENTERPRISE')
        self.assertEqual(self.client.post(url,{'user_id':self.users['AUDITOR'].pk},format='json').status_code,403)
        self.as_role('MANAGER')
        self.assertEqual(self.client.post(url,{'user_id':self.users['ENTERPRISE'].pk},format='json').status_code,400)
        self.assertEqual(self.client.post(url,{'user_id':self.users['AUDITOR'].pk},format='json').status_code,200)
    def test_admin_access(self):
        self.as_role('ADMIN')
        self.assertEqual(len(self.client.get('/api/v1/applications/').json()),2)
        self.assertEqual(self.client.post('/api/v1/organizations/',{'legal_name':'C','ninea':'C','activity':'Transport','address':'Dakar'},format='json').status_code,201)
    def test_submission_requires_documents_and_locks_edits(self):
        self.as_role('ENTERPRISE')
        url=f'/api/v1/applications/{self.dossier.pk}/'
        self.assertEqual(self.client.post(url+'submit/').status_code,400)
        RequiredDocument.objects.create(application=self.dossier,domain='Sécurité',name='Proof',status='VALIDATED')
        self.assertEqual(self.client.post(url+'submit/').status_code,200)
        self.assertEqual(self.client.post(url+'submit/').status_code,400)
        self.assertEqual(self.client.patch(url,{'level':'Platinum'},format='json').status_code,400)
    def test_role_revocation_is_immediate(self):
        self.as_role('ENTERPRISE')
        AccessProfile.objects.filter(user=self.users['ENTERPRISE']).delete()
        self.assertEqual(self.client.get('/api/v1/applications/').status_code,403)
    def test_session_csrf_and_logout(self):
        client=APIClient(enforce_csrf_checks=True)
        url='/api/v1/auth/login/'
        data={'username':'ENTERPRISE','password':'Test-password-123!'}
        self.assertEqual(client.post(url,data,format='json').status_code,403)
        client.get('/api/v1/auth/csrf/')
        token=client.cookies['csrftoken'].value
        self.assertEqual(client.post(url,data,format='json',HTTP_X_CSRFTOKEN=token).status_code,200)
        identity=client.get('/api/v1/auth/me/').json()
        self.assertEqual(identity['role'],'ENTERPRISE')
        self.assertNotIn('users.manage',identity['capabilities'])
        self.assertEqual(client.patch(f'/api/v1/organizations/{self.a.pk}/',{'address':'X'},format='json').status_code,403)
        self.assertEqual(client.post('/api/v1/auth/logout/',{},format='json').status_code,403)
        self.assertEqual(client.post('/api/v1/auth/logout/',{},format='json',HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value).status_code,200)
        self.assertEqual(client.get('/api/v1/auth/me/').status_code,401)
    def test_inactive_login_denied(self):
        self.users['ENTERPRISE'].is_active=False
        self.users['ENTERPRISE'].save()
        self.assertEqual(self.client.post('/api/v1/auth/login/',{'username':'ENTERPRISE','password':'Test-password-123!'},format='json').status_code,401)
    def test_login_throttle(self):
        for _ in range(10):
            self.client.post('/api/v1/auth/login/',{},format='json')
        self.assertEqual(self.client.post('/api/v1/auth/login/',{},format='json').status_code,429)

from django.contrib.auth import get_user_model
from django.core.cache import cache
from .test_support import TemporaryMediaTestCase
from rest_framework.test import APIClient
from .models import Organization, Application, RequiredDocument, AccessProfile, ApplicationAssignment, Certificate, Training

class RBACTests(TemporaryMediaTestCase):
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

    def test_enterprise_certificates_are_scoped(self):
        own=Certificate.objects.create(application=self.dossier,number='CERT-A')
        Certificate.objects.create(application=self.other,number='CERT-B')
        self.as_role('ENTERPRISE')
        result=self.client.get('/api/v1/certificates/')
        self.assertEqual(result.status_code,200)
        self.assertEqual([item['id'] for item in result.json()],[own.pk])
    def test_training_catalog_and_enrollment(self):
        training=Training.objects.create(title='Sécurité opérationnelle',description='Formation terrain',capacity=1)
        hidden=Training.objects.create(title='Session archivée',description='Inactive',active=False)
        self.as_role('ENTERPRISE')
        result=self.client.get('/api/v1/trainings/')
        self.assertEqual(result.status_code,200)
        self.assertEqual([item['id'] for item in result.json()],[training.pk])
        enrollment=self.client.post(f'/api/v1/trainings/{training.pk}/enroll/',{},format='json')
        self.assertEqual(enrollment.status_code,201)
        self.assertEqual(enrollment.json()['status'],'REQUESTED')
        self.assertEqual(self.client.get('/api/v1/training-enrollments/').json()[0]['training'],training.pk)
        self.assertEqual(self.client.post(f'/api/v1/trainings/{training.pk}/enroll/',{},format='json').status_code,400)
        self.as_role('PROFESSIONAL')
        self.assertEqual(self.client.get(f'/api/v1/trainings/{hidden.pk}/').status_code,404)
        self.assertEqual(self.client.post(f'/api/v1/trainings/{training.pk}/enroll/',{},format='json').status_code,400)
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
        self.assertEqual(self.client.post(url,{'user_id':self.users['EVALUATOR'].pk},format='json').status_code,403)
        self.as_role('MANAGER')
        self.assertEqual(self.client.post(url,{'user_id':self.users['ENTERPRISE'].pk},format='json').status_code,400)
        self.assertEqual(self.client.post(url,{'user_id':self.users['EVALUATOR'].pk},format='json').status_code,200)
    def test_admin_access(self):
        self.as_role('ADMIN')
        self.assertEqual(len(self.client.get('/api/v1/applications/').json()),2)
        self.assertEqual(self.client.post('/api/v1/organizations/',{'legal_name':'C','ninea':'C','activity':'Transport','address':'Dakar'},format='json').status_code,201)
    def test_decision_maker_can_decide_and_manage_certificate(self):
        self.dossier.status=Application.Status.DECISION_PENDING; self.dossier.save(update_fields=['status'])
        certificate=Certificate.objects.create(application=self.other,number='CERT-LOCKED')
        self.as_role('ADMIN')
        self.assertEqual(self.client.post(f'/api/v1/applications/{self.dossier.pk}/decide/',{'decision':'CERTIFIED','level':'Gold'},format='json').status_code,403)
        self.assertEqual(self.client.post(f'/api/v1/certificates/{certificate.pk}/update-status/',{'status':'SUSPENDED'},format='json').status_code,403)
        self.as_role('DECISION_MAKER')
        self.assertEqual(self.client.post(f'/api/v1/applications/{self.dossier.pk}/decide/',{'decision':'CERTIFIED','level':'Gold'},format='json').status_code,200)
        issued=Certificate.objects.get(application=self.dossier)
        certificates_url='/api/v1/certificates/'
        listed={item['id']:item for item in self.client.get(certificates_url).json()}
        self.assertEqual(listed[issued.pk]['stored_status'],'VALID')
        self.assertTrue(listed[issued.pk]['is_active'])
        self.assertEqual(self.client.post(f'/api/v1/certificates/{issued.pk}/update-status/',{'status':'SUSPENDED'},format='json').status_code,200)
        listed={item['id']:item for item in self.client.get(certificates_url).json()}
        self.assertEqual(listed[issued.pk]['stored_status'],'SUSPENDED')
        self.assertFalse(listed[issued.pk]['is_active'])
        self.as_role('ENTERPRISE')
        application=self.client.get(f'/api/v1/applications/{self.dossier.pk}/').json()
        self.assertEqual(application['certification_status'],'SUSPENDED')
        self.assertFalse(application['has_active_certificate'])
        self.assertIn('Certification suspendue',[item['title'] for item in self.client.get('/api/v1/notifications/').json()])
        self.as_role('DECISION_MAKER')
        self.assertEqual(self.client.post(f'/api/v1/certificates/{issued.pk}/update-status/',{'status':'VALID'},format='json').status_code,200)
        listed={item['id']:item for item in self.client.get(certificates_url).json()}
        self.assertEqual(listed[issued.pk]['stored_status'],'VALID')
        self.assertTrue(listed[issued.pk]['is_active'])
        self.assertEqual(self.client.post(f'/api/v1/certificates/{certificate.pk}/update-status/',{'status':'REVOKED'},format='json').status_code,200)
        self.assertEqual(self.client.post(f'/api/v1/certificates/{certificate.pk}/update-status/',{'status':'VALID'},format='json').status_code,400)
    def test_submission_requires_documents_and_locks_edits(self):
        self.as_role('ENTERPRISE')
        url=f'/api/v1/applications/{self.dossier.pk}/'
        self.assertEqual(self.client.post(url+'submit/').status_code,400)
        RequiredDocument.objects.create(application=self.dossier,domain='Sécurité',name='Proof',status='SUBMITTED')
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

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import AccessProfile, Organization
from .test_support import TemporaryMediaTestCase

class RegistrationTests(TemporaryMediaTestCase):
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
        payload={'username':'evaluateur','email':'internal@example.test','password':'Strong-internal-852!','role':'EVALUATOR','is_superuser':True}
        self.assertEqual(self.client.post('/api/v1/admin/accounts/',payload,format='json').status_code,403)
        admin=get_user_model().objects.create_user(username='admin')
        AccessProfile.objects.create(user=admin,role='ADMIN')
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post('/api/v1/admin/accounts/',payload,format='json').status_code,403)
        root=get_user_model().objects.create_superuser(username='root',password='Strong-root-852!')
        self.client.force_authenticate(root)
        self.assertEqual(self.client.post('/api/v1/admin/accounts/',payload,format='json').status_code,201)
        created=get_user_model().objects.get(username='evaluateur')
        self.assertFalse(created.is_superuser)
        self.assertEqual(created.access_profile.role,'EVALUATOR')

    def test_enterprise_workflow_from_registration_to_certificate(self):
        registration={
            'kind':'ENTERPRISE','username':'senegal-energie','email':'contact@energie.test',
            'first_name':'Awa','last_name':'Ndiaye','password':'Robust-example-592!',
            'legal_name':'Sénégal Énergie SA','ninea':'SN-2026-WORKFLOW'
        }
        self.assertEqual(self.client.post('/api/v1/auth/register/',registration,format='json').status_code,201)
        enterprise=get_user_model().objects.get(username='senegal-energie')
        organization=enterprise.access_profile.organization
        self.client.force_authenticate(enterprise)

        created=self.client.post('/api/v1/applications/',{
            'organization':organization.pk,'activity':'Distribution','level':'Gold',
            'domains':['Sécurité','Qualité'],'scope':'Dépôt de Dakar','description':'Demande de test.'
        },format='json')
        self.assertEqual(created.status_code,201)
        application_id=created.json()['id']
        documents=self.client.get(f'/api/v1/applications/{application_id}/').json()['documents']
        self.assertGreater(len(documents),0)
        for document in documents:
            upload=SimpleUploadedFile('preuve.pdf',b'%PDF-1.4\ntest\n%%EOF',content_type='application/pdf')
            self.assertEqual(self.client.post(f"/api/v1/documents/{document['id']}/upload/",{'file':upload},format='multipart').status_code,200)
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/submit/').status_code,200)

        manager=get_user_model().objects.create_user(username='manager-flow',password='Strong-manager-852!')
        AccessProfile.objects.create(user=manager,role='MANAGER')
        evaluator=get_user_model().objects.create_user(username='evaluator-flow',password='Strong-evaluator-852!')
        AccessProfile.objects.create(user=evaluator,role='EVALUATOR')
        decision_maker=get_user_model().objects.create_user(username='decision-flow',password='Strong-decision-852!')
        AccessProfile.objects.create(user=decision_maker,role='DECISION_MAKER')

        self.client.force_authenticate(manager)
        for document in documents:
            self.assertEqual(self.client.post(f"/api/v1/documents/{document['id']}/review/",{'status':'VALIDATED','comment':'Pièce conforme.'},format='json').status_code,200)
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/assign/',{'user_id':evaluator.pk},format='json').status_code,200)
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/start-review/',{},format='json').status_code,200)
        self.client.force_authenticate(evaluator)
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/complete-evaluation/',{},format='json').status_code,200)
        self.client.force_authenticate(decision_maker)
        decision=self.client.post(f'/api/v1/applications/{application_id}/decide/',{'decision':'CERTIFIED','level':'Gold'},format='json')
        self.assertEqual(decision.status_code,200)

        self.client.force_authenticate(enterprise)
        tracked=self.client.get(f'/api/v1/applications/{application_id}/').json()
        self.assertEqual(tracked['status'],'CERTIFIED')
        self.assertEqual(tracked['certificate']['status'],'VALID')

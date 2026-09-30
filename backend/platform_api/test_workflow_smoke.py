from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from .models import AccessProfile, Application, ApplicationAssignment, Audit, Certificate, Organization, RequiredDocument

class CurrentWorkflowSmokeTest(TestCase):
    """Verifies the complete workflow that the API exposes today, without production data."""
    def setUp(self):
        self.org=Organization.objects.create(legal_name='Entreprise test',ninea='WF-TEST',activity='Distribution',address='Dakar')
        self.users={}
        for role in ['ENTERPRISE','MANAGER','EVALUATOR','AUDITOR','DECISION_MAKER']:
            user=get_user_model().objects.create_user(username=f'wf-{role.lower()}',password='Workflow-test-2026!')
            AccessProfile.objects.create(user=user,role=role,organization=self.org if role=='ENTERPRISE' else None)
            self.users[role]=user
        self.client=APIClient()
    def as_role(self,role):
        self.client.force_authenticate(self.users[role])
    def test_request_reaches_certificate_with_all_roles(self):
        self.as_role('ENTERPRISE')
        created=self.client.post('/api/v1/applications/',{'organization':self.org.pk,'level':'Gold','domains':['Sécurité','Qualité']},format='json')
        self.assertEqual(created.status_code,201)
        application_id=created.json()['id']
        application=Application.objects.get(pk=application_id)
        self.assertEqual(application.status,Application.Status.DRAFT)

        self.assertGreater(application.documents.count(),0)
        for document in application.documents.all():
            uploaded=self.client.post(f'/api/v1/documents/{document.pk}/upload/',{'file':SimpleUploadedFile(f'{document.pk}.pdf',b'proof',content_type='application/pdf')},format='multipart')
            self.assertEqual(uploaded.status_code,200)

        self.as_role('MANAGER')
        for document in application.documents.all():
            reviewed=self.client.post(f'/api/v1/documents/{document.pk}/review/',{'status':'VALIDATED','comment':'Pièce conforme.'},format='json')
            self.assertEqual(reviewed.status_code,200)

        self.as_role('ENTERPRISE')
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/submit/').status_code,200)
        application.refresh_from_db()
        self.assertEqual(application.status,Application.Status.SUBMITTED)

        self.as_role('MANAGER')
        for role in ['EVALUATOR','AUDITOR']:
            result=self.client.post(f'/api/v1/applications/{application_id}/assign/',{'user_id':self.users[role].pk},format='json')
            self.assertEqual(result.status_code,200)
        self.assertEqual(ApplicationAssignment.objects.filter(application=application).count(),2)
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/start-review/',{'note':'Dossier complet.'},format='json').status_code,200)
        application.refresh_from_db()
        self.assertEqual(application.status,Application.Status.UNDER_REVIEW)
        planned=self.client.post(f'/api/v1/applications/{application_id}/schedule-audit/',{'auditor_id':self.users['AUDITOR'].pk},format='json')
        self.assertEqual(planned.status_code,201)

        self.as_role('AUDITOR')
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/complete-audit/',{'audit_id':planned.json()['id'],'summary':'Audit réalisé.'},format='json').status_code,200)
        self.assertEqual(Audit.objects.get(pk=planned.json()['id']).status,Audit.Status.COMPLETED)

        self.as_role('EVALUATOR')
        correction=self.client.post(f'/api/v1/applications/{application_id}/request-correction/',{'domain':'Sécurité','description':'Corriger le plan de prévention.'},format='json')
        self.assertEqual(correction.status_code,201)
        application.refresh_from_db()
        self.assertEqual(application.status,Application.Status.CORRECTION_REQUIRED)

        self.as_role('ENTERPRISE')
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/respond-correction/',{'non_conformity_id':correction.json()['id'],'response':'Plan corrigé et diffusé.'},format='json').status_code,200)

        self.as_role('EVALUATOR')
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/validate-correction/',{'non_conformity_id':correction.json()['id']},format='json').status_code,200)
        application.refresh_from_db()
        self.assertEqual(application.status,Application.Status.UNDER_REVIEW)
        self.assertEqual(self.client.post(f'/api/v1/applications/{application_id}/complete-evaluation/',{'note':'Évaluation favorable.'},format='json').status_code,200)
        application.refresh_from_db()
        self.assertEqual(application.status,Application.Status.DECISION_PENDING)

        self.as_role('DECISION_MAKER')
        decision=self.client.post(f'/api/v1/applications/{application_id}/decide/',{'decision':'CERTIFIED','note':'Décision favorable.'},format='json')
        self.assertEqual(decision.status_code,200)
        application.refresh_from_db()
        self.assertEqual(application.status,Application.Status.CERTIFIED)
        self.assertTrue(Certificate.objects.filter(application=application,number=decision.json()['certificate']).exists())
        self.assertGreater(application.events.count(),8)

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    AccessProfile,
    Application,
    Certificate,
    NonConformity,
    Organization,
    RequiredDocument,
    Training,
)
from .test_support import TemporaryMediaTestCase


class WorkflowIntegrityTests(TemporaryMediaTestCase):
    def setUp(self):
        self.client = APIClient()
        self.organization = Organization.objects.create(
            legal_name='Entreprise protégée',
            ninea='INTEGRITY-001',
            activity='Distribution',
            address='Dakar',
        )
        self.enterprise = get_user_model().objects.create_user(
            username='enterprise-integrity', password='Integrity-test-2026!'
        )
        AccessProfile.objects.create(
            user=self.enterprise, role='ENTERPRISE', organization=self.organization
        )

    def authenticate_enterprise(self):
        self.client.force_authenticate(self.enterprise)

    def application(self, reference='INPG-INTEGRITY-001', **overrides):
        values = {
            'organization': self.organization,
            'reference': reference,
            'activity': 'Distribution',
            'level': 'Gold',
            'domains': ['Sécurité'],
        }
        values.update(overrides)
        return Application.objects.create(**values)

    def test_documents_are_only_available_through_the_protected_endpoint(self):
        application = self.application()
        document = RequiredDocument.objects.create(
            application=application,
            domain='Sécurité',
            name='Pièce confidentielle',
            file=SimpleUploadedFile(
                'preuve.pdf', b'%PDF-1.4\nproof\n%%EOF', content_type='application/pdf'
            ),
            status=RequiredDocument.Status.SUBMITTED,
        )

        anonymous = self.client.get(f'/api/v1/documents/{document.pk}/download/')
        self.assertEqual(anonymous.status_code, 403)
        self.assertEqual(self.client.get(document.file.url).status_code, 404)

        other_organization = Organization.objects.create(
            legal_name='Autre entreprise', ninea='INTEGRITY-002', activity='Transport', address='Thiès'
        )
        outsider = get_user_model().objects.create_user(username='outsider-integrity')
        AccessProfile.objects.create(user=outsider, role='ENTERPRISE', organization=other_organization)
        self.client.force_authenticate(outsider)
        self.assertEqual(
            self.client.get(f'/api/v1/documents/{document.pk}/download/').status_code,
            404,
        )

        self.authenticate_enterprise()
        response = self.client.get(f'/api/v1/documents/{document.pk}/download/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment;', response['Content-Disposition'])

    def test_document_upload_checks_content_and_removes_replaced_file(self):
        application = self.application()
        document = RequiredDocument.objects.create(
            application=application, domain='Sécurité', name='Preuve'
        )
        self.authenticate_enterprise()
        url = f'/api/v1/documents/{document.pk}/upload/'

        spoofed = SimpleUploadedFile('preuve.pdf', b'not-a-pdf', content_type='application/pdf')
        self.assertEqual(self.client.post(url, {'file': spoofed}, format='multipart').status_code, 400)
        truncated = SimpleUploadedFile('preuve.pdf', b'%PDF-1.4\ntruncated', content_type='application/pdf')
        self.assertEqual(self.client.post(url, {'file': truncated}, format='multipart').status_code, 400)

        valid = SimpleUploadedFile(
            'preuve.pdf', b'%PDF-1.4\nfirst\n%%EOF', content_type='application/pdf'
        )
        self.assertEqual(self.client.post(url, {'file': valid}, format='multipart').status_code, 200)
        document.refresh_from_db()
        first_name = document.file.name
        self.assertTrue(default_storage.exists(first_name))

        replacement = SimpleUploadedFile(
            'preuve.pdf', b'%PDF-1.4\nreplacement\n%%EOF', content_type='application/pdf'
        )
        self.assertEqual(
            self.client.post(url, {'file': replacement}, format='multipart').status_code,
            200,
        )
        document.refresh_from_db()
        self.assertNotEqual(document.file.name, first_name)
        self.assertFalse(default_storage.exists(first_name))

    def test_draft_requirements_resynchronize_before_the_first_upload(self):
        self.authenticate_enterprise()
        created = self.client.post(
            '/api/v1/applications/',
            {
                'organization': self.organization.pk,
                'activity': 'Distribution',
                'level': 'Standard',
                'domains': ['Sécurité'],
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        application_id = created.json()['id']
        self.assertTrue(RequiredDocument.objects.filter(application_id=application_id, domain='Sécurité').exists())

        changed = self.client.patch(
            f'/api/v1/applications/{application_id}/',
            {'domains': ['Qualité']},
            format='json',
        )
        self.assertEqual(changed.status_code, 200)
        self.assertFalse(RequiredDocument.objects.filter(application_id=application_id, domain='Sécurité').exists())
        document = RequiredDocument.objects.filter(application_id=application_id, domain='Qualité').first()
        self.assertIsNotNone(document)

        uploaded = SimpleUploadedFile(
            'preuve.pdf', b'%PDF-1.4\nproof\n%%EOF', content_type='application/pdf'
        )
        self.assertEqual(
            self.client.post(
                f'/api/v1/documents/{document.pk}/upload/', {'file': uploaded}, format='multipart'
            ).status_code,
            200,
        )
        refused = self.client.patch(
            f'/api/v1/applications/{application_id}/',
            {'domains': ['Environnement']},
            format='json',
        )
        self.assertEqual(refused.status_code, 400)

    def test_open_correction_cannot_be_bypassed_by_resubmission(self):
        application = self.application(status=Application.Status.CORRECTION_REQUIRED)
        NonConformity.objects.create(
            application=application,
            reference='NC-INTEGRITY-001',
            domain='Sécurité',
            description='Action corrective attendue.',
        )
        self.authenticate_enterprise()
        response = self.client.post(f'/api/v1/applications/{application.pk}/submit/')
        self.assertEqual(response.status_code, 400)
        application.refresh_from_db()
        self.assertEqual(application.status, Application.Status.CORRECTION_REQUIRED)

    def test_expired_certificate_is_publicly_reported_and_pdf_is_generated(self):
        application = self.application(status=Application.Status.CERTIFIED)
        certificate = Certificate.objects.create(
            application=application,
            number='CERT-INPG-EXPIRED-001',
            expires_at=timezone.now() - timedelta(days=1),
        )

        verification = self.client.get(
            '/api/v1/certificates/verify/', {'number': certificate.number}
        )
        self.assertEqual(verification.status_code, 200)
        self.assertEqual(verification.json()['status'], 'EXPIRED')

        self.authenticate_enterprise()
        detail = self.client.get(f'/api/v1/certificates/{certificate.pk}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['status'], 'EXPIRED')
        self.assertEqual(detail.json()['stored_status'], 'VALID')
        self.assertFalse(detail.json()['is_active'])

        pdf_response = self.client.get(f'/api/v1/certificates/{certificate.pk}/download/')
        self.assertEqual(pdf_response.status_code, 200)
        content = b''.join(pdf_response.streaming_content)
        self.assertTrue(content.startswith(b'%PDF'))
        self.assertGreater(len(content), 2000)

    def test_training_enrollment_has_controlled_status_transitions(self):
        training = Training.objects.create(
            title='Sécurité opérationnelle', description='Formation test', capacity=2
        )
        self.authenticate_enterprise()
        enrollment = self.client.post(f'/api/v1/trainings/{training.pk}/enroll/')
        self.assertEqual(enrollment.status_code, 201)

        admin = get_user_model().objects.create_user(username='admin-integrity')
        AccessProfile.objects.create(user=admin, role='ADMIN')
        self.client.force_authenticate(admin)
        url = f"/api/v1/training-enrollments/{enrollment.json()['id']}/update-status/"
        self.assertEqual(
            self.client.post(url, {'status': 'CONFIRMED'}, format='json').status_code,
            200,
        )
        self.assertEqual(
            self.client.post(url, {'status': 'COMPLETED'}, format='json').status_code,
            200,
        )
        self.assertEqual(
            self.client.post(url, {'status': 'CANCELLED'}, format='json').status_code,
            400,
        )

"""Tests des corrections issues de l'audit (voir docs/corrections/SUIVI.md : S = sécurité, W = workflow, C = synchronisation, F = fonctionnel)."""
import shutil
import tempfile
import threading
import unittest
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import AccessProfile, Application, ApplicationAssignment, Audit, Certificate, Invitation, NonConformity, Organization, RequiredDocument, RequirementTemplate

PDF = b'%PDF-1.4 preuve'
PASSWORD = 'Correction-test-2026!'
MEDIA = tempfile.mkdtemp(prefix='inpg-test-media-')


def pdf(name='preuve.pdf', content=PDF):
    return SimpleUploadedFile(name, content, content_type='application/pdf')


@override_settings(MEDIA_ROOT=MEDIA)
class Base(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.org = Organization.objects.create(legal_name='Pétrole SA', ninea='N-1', activity='Distribution', address='Dakar', verified_at=timezone.now())
        self.other = Organization.objects.create(legal_name='Autre SA', ninea='N-2', activity='Stockage', address='Thiès', verified_at=timezone.now())
        self.users = {}
        for role in ['ENTERPRISE', 'MANAGER', 'EVALUATOR', 'AUDITOR', 'DECISION_MAKER', 'ADMIN']:
            user = get_user_model().objects.create_user(username=role.lower(), email=f'{role.lower()}@test.sn', password=PASSWORD)
            AccessProfile.objects.create(user=user, role=role, organization=self.org if role == 'ENTERPRISE' else None, is_owner=role == 'ENTERPRISE')
            self.users[role] = user
        self.client = APIClient()

    def as_(self, role):
        self.client.force_authenticate(self.users[role])
        return self.client

    def new(self, domains=('Sécurité',), activity='Distribution'):
        r = self.as_('ENTERPRISE').post('/api/v1/applications/', {'organization': self.org.pk, 'domains': list(domains), 'activity': activity}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        return Application.objects.get(pk=r.json()['id'])

    def fill(self, app):
        for doc in app.documents.all():
            self.assertEqual(self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': pdf()}, format='multipart').status_code, 200)
            self.assertEqual(self.as_('MANAGER').post(f'/api/v1/documents/{doc.pk}/review/', {'status': 'VALIDATED'}, format='json').status_code, 200)

    def to(self, target, domains=('Sécurité',)):
        """Amène un dossier jusqu'à l'étape voulue par l'API."""
        app = self.new(domains)
        self.fill(app)
        steps = [('ENTERPRISE', 'submit', {}), ('MANAGER', 'start-review', {}), ('MANAGER', 'assign', {'user_id': self.users['EVALUATOR'].pk})]
        stops = {'SUBMITTED': 1, 'UNDER_REVIEW': 3, 'DECISION_PENDING': 3}
        for role, path, body in steps[:stops.get(target, 0)]:
            self.assertIn(self.as_(role).post(f'/api/v1/applications/{app.pk}/{path}/', body, format='json').status_code, (200, 201))
        if target == 'DECISION_PENDING':
            self.assertEqual(self.as_('EVALUATOR').post(f'/api/v1/applications/{app.pk}/complete-evaluation/').status_code, 200)
        app.refresh_from_db()
        return app

    def post(self, role, path, body=None):
        return self.as_(role).post(path, body or {}, format='json')


class SecurityTests(Base):
    def test_S1_files_only_through_api_with_rbac(self):
        app = self.new(); doc = app.documents.first()
        self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': pdf()}, format='multipart')
        data = self.client.get(f'/api/v1/applications/{app.pk}/').json()['documents'][0]
        self.assertEqual(data['download_url'], f'/api/v1/documents/{doc.pk}/download/')
        self.assertNotIn('file', data)
        response = self.client.get(data['download_url'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), PDF)
        self.assertEqual(APIClient().get(data['download_url']).status_code, 403)
        outsider = get_user_model().objects.create_user(username='autre', password=PASSWORD)
        AccessProfile.objects.create(user=outsider, role='ENTERPRISE', organization=self.other)
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get(data['download_url']).status_code, 404)
        self.assertEqual(APIClient().get('/media/' + RequiredDocument.objects.get(pk=doc.pk).file.name).status_code, 404)

    def test_S2_file_type_checked_on_content(self):
        doc = self.new().documents.first()
        for name, content in [('virus.exe', b'MZ\x90\x00'), ('faux.pdf', b'MZ\x90\x00'), ('image.png', PDF)]:
            r = self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': SimpleUploadedFile(name, content)}, format='multipart')
            self.assertEqual(r.status_code, 400, name)
        png = SimpleUploadedFile('photo.png', b'\x89PNG\r\n\x1a\n' + b'0' * 10)
        self.assertEqual(self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': png}, format='multipart').status_code, 200)

    def test_S3_only_failed_logins_count(self):
        client = APIClient()
        for _ in range(12):
            self.assertEqual(client.post('/api/v1/auth/login/', {'username': 'enterprise', 'password': PASSWORD}, format='json').status_code, 200)
        for _ in range(10):
            client.post('/api/v1/auth/login/', {'username': 'enterprise', 'password': 'faux'}, format='json')
        self.assertEqual(client.post('/api/v1/auth/login/', {'username': 'enterprise', 'password': PASSWORD}, format='json').status_code, 429)

    @override_settings(REST_FRAMEWORK={'NUM_PROXIES': 1, 'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'], 'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated']})
    def test_S3_behind_proxy_counts_real_client_ip(self):
        from rest_framework.settings import api_settings
        api_settings.reload()
        try:
            for _ in range(10):
                APIClient().post('/api/v1/auth/login/', {'username': 'enterprise', 'password': 'faux'}, format='json', HTTP_X_FORWARDED_FOR='10.0.0.1')
            blocked = APIClient().post('/api/v1/auth/login/', {'username': 'enterprise', 'password': PASSWORD}, format='json', HTTP_X_FORWARDED_FOR='10.0.0.1')
            other = APIClient().post('/api/v1/auth/login/', {'username': 'enterprise', 'password': PASSWORD}, format='json', HTTP_X_FORWARDED_FOR='10.0.0.2')
            self.assertEqual((blocked.status_code, other.status_code), (429, 200))
        finally:
            api_settings.reload()

    def test_S4_registration_counter_is_separate(self):
        client = APIClient()
        for _ in range(10):
            client.post('/api/v1/auth/register/', {}, format='json')
        self.assertEqual(client.post('/api/v1/auth/login/', {'username': 'enterprise', 'password': PASSWORD}, format='json').status_code, 200)

    def test_S5_debug_off_by_default(self):
        import os, subprocess, sys
        env = {k: v for k, v in os.environ.items() if k not in ('DJANGO_DEBUG', 'DJANGO_SECRET_KEY')}
        result = subprocess.run([sys.executable, '-c', 'import django,os;os.environ["DJANGO_SETTINGS_MODULE"]="config.settings";django.setup()'],
                                env=env, capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__)))
        self.assertIn('DJANGO_SECRET_KEY est obligatoire', result.stderr)

    def test_S6_security_headers(self):
        response = self.as_('ENTERPRISE').get('/api/v1/auth/me/')
        self.assertEqual(response['X-Frame-Options'], 'DENY')
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')

    def test_S7_enterprise_cannot_change_legal_identity(self):
        r = self.as_('ENTERPRISE').patch(f'/api/v1/organizations/{self.org.pk}/', {'ninea': 'FAUX', 'legal_name': 'Autre nom', 'address': 'Rufisque'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual((self.org.ninea, self.org.legal_name, self.org.address), ('N-1', 'Pétrole SA', 'Rufisque'))
        self.assertEqual(self.as_('ADMIN').patch(f'/api/v1/organizations/{self.org.pk}/', {'ninea': 'N-1-bis'}, format='json').json()['ninea'], 'N-1-bis')

    def test_S8_password_reset_and_unique_email(self):
        r = APIClient().post('/api/v1/auth/register/', {'kind': 'PROFESSIONAL', 'username': 'nouveau', 'email': 'ENTERPRISE@test.sn', 'first_name': 'A', 'last_name': 'B', 'password': 'Robust-example-592!'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(APIClient().post('/api/v1/auth/password-reset/', {'email': 'inconnu@test.sn'}, format='json').status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(APIClient().post('/api/v1/auth/password-reset/', {'email': 'enterprise@test.sn'}, format='json').status_code, 200)
        link = [line for line in mail.outbox[0].body.splitlines() if 'reinitialisation?' in line][0]
        uid, token = link.split('uid=')[1].split('&token=')
        self.assertEqual(APIClient().post('/api/v1/auth/password-reset/confirm/', {'uid': uid, 'token': 'faux', 'password': 'Nouveau-mot-2026!'}, format='json').status_code, 400)
        self.assertEqual(APIClient().post('/api/v1/auth/password-reset/confirm/', {'uid': uid, 'token': token, 'password': 'Nouveau-mot-2026!'}, format='json').status_code, 200)
        self.assertEqual(APIClient().post('/api/v1/auth/login/', {'username': 'enterprise', 'password': 'Nouveau-mot-2026!'}, format='json').status_code, 200)
        self.assertEqual(APIClient().post('/api/v1/auth/password-reset/confirm/', {'uid': uid, 'token': token, 'password': 'Encore-autre-2026!'}, format='json').status_code, 400)

    def test_S9_unverified_organization_cannot_submit(self):
        Organization.objects.filter(pk=self.org.pk).update(verified_at=None)
        app = self.new(); self.fill(app)
        r = self.post('ENTERPRISE', f'/api/v1/applications/{app.pk}/submit/')
        self.assertEqual(r.status_code, 400); self.assertIn('vérifiée', r.json()['detail'])
        self.assertEqual(self.post('ENTERPRISE', f'/api/v1/organizations/{self.org.pk}/verify/').status_code, 403)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post('MANAGER', f'/api/v1/organizations/{self.org.pk}/verify/').status_code, 200)
        self.assertTrue(any('vérifié' in m.subject for m in mail.outbox))
        self.assertEqual(self.post('ENTERPRISE', f'/api/v1/applications/{app.pk}/submit/').status_code, 200)
        self.assertTrue(APIClient().post('/api/v1/auth/register/', {'kind': 'ENTERPRISE', 'username': 'neuf', 'email': 'neuf@test.sn', 'first_name': 'A', 'last_name': 'B', 'password': 'Robust-example-592!', 'legal_name': 'Neuve', 'ninea': 'N-9'}, format='json').status_code == 201
                        and not Organization.objects.get(ninea='N-9').is_verified)


class WorkflowTests(Base):
    def test_W1_cannot_resubmit_with_open_non_conformity(self):
        app = self.to('UNDER_REVIEW')
        self.post('EVALUATOR', f'/api/v1/applications/{app.pk}/request-correction/', {'domain': 'Sécurité', 'description': 'Écart'})
        r = self.post('ENTERPRISE', f'/api/v1/applications/{app.pk}/submit/')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Corrections demandées', r.json()['detail'])

    def test_W2_evaluation_requires_completed_audits(self):
        app = self.to('UNDER_REVIEW')
        audit = self.post('MANAGER', f'/api/v1/applications/{app.pk}/schedule-audit/', {'auditor_id': self.users['AUDITOR'].pk, 'scheduled_for': '2026-11-10T09:00'}).json()
        self.assertEqual(self.post('EVALUATOR', f'/api/v1/applications/{app.pk}/complete-evaluation/').status_code, 400)
        self.assertEqual(self.post('AUDITOR', f'/api/v1/applications/{app.pk}/complete-audit/', {'audit_id': audit['id'], 'summary': ''}).status_code, 400)
        self.assertEqual(self.post('AUDITOR', f'/api/v1/applications/{app.pk}/complete-audit/', {'audit_id': audit['id'], 'summary': 'Constats : RAS.'}).status_code, 200)
        self.assertEqual(self.post('AUDITOR', f'/api/v1/applications/{app.pk}/complete-audit/', {'audit_id': audit['id'], 'summary': 'Encore'}).status_code, 400)
        self.assertEqual(self.post('EVALUATOR', f'/api/v1/applications/{app.pk}/complete-evaluation/').status_code, 200)

    def test_W3_decision_by_domain_computes_level(self):
        app = self.to('DECISION_PENDING', ('Sécurité', 'Qualité', 'Environnement'))
        self.assertEqual(app.level, 'Platinum')
        self.assertEqual(self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED', 'domains': ['Sécurité', 'Inconnu']}).status_code, 400)
        self.assertEqual(self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED', 'domains': []}).status_code, 400)
        r = self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED', 'domains': ['Qualité', 'Sécurité'], 'level': 'Platinum'})
        self.assertEqual((r.status_code, r.json()['level']), (200, 'Gold'))
        cert = Certificate.objects.get(application=app)
        self.assertEqual((cert.level, cert.domains), ('Gold', ['Sécurité', 'Qualité']))

    def test_W4_creation_validates_domains_activity_and_computes_level(self):
        for body in [{'domains': ['Foo']}, {'domains': ['Sécurité', 'Sécurité']}, {'domains': []}, {'domains': ['Sécurité'], 'activity': 'Pêche'}]:
            r = self.as_('ENTERPRISE').post('/api/v1/applications/', {'organization': self.org.pk, 'activity': 'Distribution', **body}, format='json')
            self.assertEqual(r.status_code, 400, body)
        r = self.as_('ENTERPRISE').post('/api/v1/applications/', {'organization': self.org.pk, 'activity': 'Transport', 'domains': ['Qualité', 'Sécurité'], 'level': 'Platinum'}, format='json')
        self.assertEqual(r.json()['level'], 'Gold')
        self.assertRegex(r.json()['reference'], r'^INPG-\d{4}-0001$')
        names = {d['name'] for d in r.json()['documents']}
        self.assertIn('Attestation transport de matières dangereuses', names)
        self.assertEqual(len(names), 7)

    def test_W5_changing_domains_resyncs_checklist_and_keeps_uploads(self):
        app = self.new(('Sécurité',))
        kept = app.documents.get(name='Politique HSE signée')
        self.as_('ENTERPRISE').post(f'/api/v1/documents/{kept.pk}/upload/', {'file': pdf()}, format='multipart')
        r = self.as_('ENTERPRISE').patch(f'/api/v1/applications/{app.pk}/', {'domains': ['Sécurité', 'Environnement']}, format='json')
        self.assertEqual((r.status_code, r.json()['level']), (200, 'Gold'))
        self.assertEqual(app.documents.count(), 7)
        self.assertEqual(app.documents.get(pk=kept.pk).status, 'SUBMITTED')
        self.as_('ENTERPRISE').patch(f'/api/v1/applications/{app.pk}/', {'domains': ['Environnement']}, format='json')
        self.assertFalse(app.documents.filter(pk=kept.pk).exists())

    def test_W6_invalid_audit_date_is_a_clean_error(self):
        app = self.to('UNDER_REVIEW')
        for value in ['demain', None, '']:
            r = self.post('MANAGER', f'/api/v1/applications/{app.pk}/schedule-audit/', {'auditor_id': self.users['AUDITOR'].pk, 'scheduled_for': value})
            self.assertEqual(r.status_code, 400)
        self.assertFalse(Audit.objects.exists())

    def test_W7_protected_deletions_return_400(self):
        app = self.new()
        self.assertEqual(self.as_('ADMIN').delete(f'/api/v1/organizations/{self.org.pk}/').status_code, 400)
        submitted = self.to('SUBMITTED')
        self.assertEqual(self.as_('ADMIN').delete(f'/api/v1/applications/{submitted.pk}/').status_code, 400)
        self.assertEqual(self.as_('ADMIN').delete(f'/api/v1/applications/{app.pk}/').status_code, 204)

    def test_W8_no_assignment_or_audit_after_decision(self):
        app = self.to('DECISION_PENDING')
        self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED'})
        self.assertEqual(self.post('MANAGER', f'/api/v1/applications/{app.pk}/assign/', {'user_id': self.users['AUDITOR'].pk}).status_code, 400)
        self.assertEqual(self.post('MANAGER', f'/api/v1/applications/{app.pk}/schedule-audit/', {'auditor_id': self.users['AUDITOR'].pk, 'scheduled_for': '2026-12-01T10:00'}).status_code, 400)

    def test_W9_certificate_one_year_and_revocation_final(self):
        app = self.to('DECISION_PENDING')
        self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED'})
        cert = Certificate.objects.get(application=app)
        self.assertAlmostEqual((cert.expires_at - cert.issued_at).days, 365, delta=1)
        url = f'/api/v1/certificates/{cert.pk}/update-status/'
        self.assertEqual(self.post('ADMIN', url, {'status': 'SUSPENDED'}).status_code, 200)
        self.assertEqual(self.post('ADMIN', url, {'status': 'SUSPENDED'}).status_code, 400)
        self.assertEqual(self.post('ADMIN', url, {'status': 'VALID'}).status_code, 200)
        self.assertEqual(self.post('ADMIN', url, {'status': 'REVOKED'}).status_code, 200)
        self.assertEqual(self.post('ADMIN', url, {'status': 'VALID'}).status_code, 400)
        Certificate.objects.filter(pk=cert.pk).update(status='VALID', expires_at=timezone.now() - timedelta(days=1))
        self.assertEqual(self.as_('ENTERPRISE').get('/api/v1/certificates/').json()[0]['effective_status'], 'EXPIRED')
        self.assertEqual(self.post('ADMIN', url, {'status': 'SUSPENDED'}).status_code, 200)
        self.assertEqual(self.post('ADMIN', url, {'status': 'VALID'}).status_code, 400)

    def test_W10_W17_assignment_once_and_unassign(self):
        app = self.to('SUBMITTED')
        url = f'/api/v1/applications/{app.pk}/'
        self.assertEqual(self.post('MANAGER', url + 'assign/', {'user_id': self.users['EVALUATOR'].pk}).status_code, 200)
        self.assertEqual(self.post('MANAGER', url + 'assign/', {'user_id': self.users['EVALUATOR'].pk}).status_code, 400)
        self.assertEqual(app.events.filter(event_type='ASSIGNED').count(), 1)
        self.assertEqual(self.post('MANAGER', url + 'unassign/', {'user_id': self.users['EVALUATOR'].pk}).status_code, 200)
        self.assertFalse(ApplicationAssignment.objects.filter(application=app).exists())
        self.assertEqual(self.as_('EVALUATOR').get(url).status_code, 404)

    def test_W11_severity_and_due_date_validated(self):
        app = self.to('UNDER_REVIEW')
        url = f'/api/v1/applications/{app.pk}/request-correction/'
        self.assertEqual(self.post('EVALUATOR', url, {'domain': 'Sécurité', 'description': 'x', 'severity': 'BANANE'}).status_code, 400)
        self.assertEqual(self.post('EVALUATOR', url, {'domain': 'Qualité', 'description': 'x'}).status_code, 400)
        self.assertEqual(self.post('EVALUATOR', url, {'domain': 'Sécurité', 'description': 'x', 'due_date': '2020-01-01'}).status_code, 400)
        r = self.post('EVALUATOR', url, {'domain': 'Sécurité', 'description': 'x', 'severity': 'CRITIQUE'})
        self.assertEqual((r.status_code, r.json()['severity_label']), (201, 'Critique'))
        self.assertEqual(r.json()['due_date'], str(timezone.localdate() + timedelta(days=30)))

    def test_W12_validated_document_locked_in_draft(self):
        app = self.new(); doc = app.documents.first()
        self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': pdf()}, format='multipart')
        self.post('MANAGER', f'/api/v1/documents/{doc.pk}/review/', {'status': 'VALIDATED'})
        self.assertEqual(self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': pdf()}, format='multipart').status_code, 400)

    def test_W13_correction_can_be_sent_back_with_reason(self):
        app = self.to('UNDER_REVIEW')
        nc = self.post('EVALUATOR', f'/api/v1/applications/{app.pk}/request-correction/', {'domain': 'Sécurité', 'description': 'Écart'}).json()
        url = f'/api/v1/applications/{app.pk}/'
        self.post('ENTERPRISE', url + 'respond-correction/', {'non_conformity_id': nc['id'], 'response': 'Fait.'})
        self.assertEqual(self.post('EVALUATOR', url + 'reject-correction/', {'non_conformity_id': nc['id'], 'reason': ''}).status_code, 400)
        r = self.post('EVALUATOR', url + 'reject-correction/', {'non_conformity_id': nc['id'], 'reason': 'Preuve manquante.'})
        self.assertEqual((r.status_code, r.json()['status'], r.json()['rejection_reason']), (200, 'OPEN', 'Preuve manquante.'))
        self.assertEqual(self.post('ENTERPRISE', url + 'respond-correction/', {'non_conformity_id': nc['id'], 'response': 'Preuve jointe.'}).status_code, 200)
        self.assertEqual(self.post('EVALUATOR', url + 'validate-correction/', {'non_conformity_id': nc['id']}).json()['application_status'], 'UNDER_REVIEW')

    def test_W14_refusal_requires_reason_and_allows_linked_request(self):
        app = self.to('DECISION_PENDING')
        url = f'/api/v1/applications/{app.pk}/decide/'
        self.assertEqual(self.post('DECISION_MAKER', url, {'decision': 'REJECTED'}).status_code, 400)
        self.assertEqual(self.post('DECISION_MAKER', url, {'decision': 'REJECTED', 'note': 'Plan d’urgence absent.'}).status_code, 200)
        self.assertEqual(self.as_('ENTERPRISE').get(f'/api/v1/applications/{app.pk}/').json()['decision_note'], 'Plan d’urgence absent.')
        r = self.as_('ENTERPRISE').post('/api/v1/applications/', {'organization': self.org.pk, 'activity': 'Distribution', 'domains': ['Sécurité'], 'previous_application': app.pk}, format='json')
        self.assertEqual((r.status_code, r.json()['previous_application']), (201, app.pk))
        draft = self.new()
        self.assertEqual(self.as_('ENTERPRISE').post('/api/v1/applications/', {'organization': self.org.pk, 'activity': 'Distribution', 'domains': ['Sécurité'], 'previous_application': draft.pk}, format='json').status_code, 400)

    def test_W14_renewal_targets_own_certificate(self):
        app = self.to('DECISION_PENDING')
        self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED'})
        cert = Certificate.objects.get(application=app)
        body = {'organization': self.org.pk, 'activity': 'Distribution', 'domains': ['Sécurité'], 'kind': 'RENEWAL'}
        self.assertEqual(self.as_('ENTERPRISE').post('/api/v1/applications/', body, format='json').status_code, 400)
        r = self.as_('ENTERPRISE').post('/api/v1/applications/', {**body, 'renewal_of': cert.pk}, format='json')
        self.assertEqual((r.status_code, r.json()['kind_label']), (201, 'Renouvellement'))

    def test_W18_document_rejection_needs_comment(self):
        doc = self.new().documents.first()
        self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': pdf()}, format='multipart')
        self.assertEqual(self.post('MANAGER', f'/api/v1/documents/{doc.pk}/review/', {'status': 'REJECTED'}).status_code, 400)
        r = self.post('MANAGER', f'/api/v1/documents/{doc.pk}/review/', {'status': 'REJECTED', 'comment': 'Signature manquante.'})
        self.assertEqual(r.json()['review_comment'], 'Signature manquante.')

    def test_W20_kind_and_activity_kept(self):
        app = self.new(activity='Laboratoire')
        data = self.as_('ENTERPRISE').get(f'/api/v1/applications/{app.pk}/').json()
        self.assertEqual((data['activity'], data['kind'], data['kind_label']), ('Laboratoire', 'INITIAL', 'Certification initiale'))


class SynchronisationTests(Base):
    def test_C1_second_action_on_changed_dossier_is_explained(self):
        app = self.to('DECISION_PENDING')
        url = f'/api/v1/applications/{app.pk}/decide/'
        self.assertEqual(self.post('DECISION_MAKER', url, {'decision': 'CERTIFIED'}).status_code, 200)
        r = self.post('DECISION_MAKER', url, {'decision': 'REJECTED', 'note': 'Non'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('« Certifié »', r.json()['detail'])
        self.assertEqual(Certificate.objects.filter(application=app).count(), 1)
        submitted = self.to('SUBMITTED')
        for expected in (200, 400):
            self.assertEqual(self.post('MANAGER', f'/api/v1/applications/{submitted.pk}/start-review/').status_code, expected)
        self.assertEqual(submitted.events.filter(event_type='REVIEW_STARTED').count(), 1)

    def test_C2_decision_is_atomic(self):
        """Si la création du certificat échoue, le dossier ne reste pas « Certifié » sans certificat."""
        from unittest import mock
        from django.db import IntegrityError
        app = self.to('DECISION_PENDING')
        with mock.patch('platform_api.views.Certificate.objects.create', side_effect=IntegrityError('panne simulée')):
            with self.assertRaises(IntegrityError):
                self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED'})
        app.refresh_from_db()
        self.assertEqual(app.status, 'DECISION_PENDING')
        self.assertFalse(app.events.filter(event_type='DECISION_CERTIFIED').exists())

    def test_C3_replaced_file_is_deleted(self):
        app = self.to('UNDER_REVIEW')
        self.post('EVALUATOR', f'/api/v1/applications/{app.pk}/request-correction/', {'domain': 'Sécurité', 'description': 'Écart'})
        doc = app.documents.first(); old = doc.file.name; storage = doc.file.storage
        self.assertTrue(storage.exists(old))
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.as_('ENTERPRISE').post(f'/api/v1/documents/{doc.pk}/upload/', {'file': pdf('v2.pdf')}, format='multipart').status_code, 200)
        self.assertFalse(storage.exists(old))
        self.assertTrue(storage.exists(RequiredDocument.objects.get(pk=doc.pk).file.name))

    def test_C4_certificate_status_visible_with_dossier(self):
        app = self.to('DECISION_PENDING')
        self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED'})
        cert = Certificate.objects.get(application=app)
        self.post('ADMIN', f'/api/v1/certificates/{cert.pk}/update-status/', {'status': 'SUSPENDED'})
        listed = [a for a in self.as_('ENTERPRISE').get('/api/v1/applications/').json() if a['id'] == app.pk][0]
        self.assertEqual((listed['status'], listed['certificate']['effective_status'], listed['certificate']['status_label']), ('CERTIFIED', 'SUSPENDED', 'Suspendu'))

    def test_C5_checklist_preview_matches_created_dossier(self):
        preview = self.as_('ENTERPRISE').get('/api/v1/requirements/preview/?activity=Distribution&domains=S%C3%A9curit%C3%A9,Qualit%C3%A9').json()
        app = self.new(('Sécurité', 'Qualité'))
        self.assertEqual(preview['level'], 'Gold')
        self.assertEqual(sorted(d['name'] for d in preview['documents']), sorted(app.documents.values_list('name', flat=True)))

    def test_C5_referential_is_editable_by_admin_only(self):
        body = {'domain': 'Qualité', 'activity': '', 'name': 'Plan qualité fournisseur', 'mandatory': True, 'active': True, 'order': 5}
        self.assertEqual(self.as_('MANAGER').post('/api/v1/requirements/', body, format='json').status_code, 403)
        self.assertEqual(self.as_('ADMIN').post('/api/v1/requirements/', {**body, 'domain': 'Inconnu'}, format='json').status_code, 400)
        self.assertEqual(self.as_('ADMIN').post('/api/v1/requirements/', body, format='json').status_code, 201)
        self.assertIn('Plan qualité fournisseur', self.new(('Qualité',)).documents.values_list('name', flat=True))

    def test_C6_labels_come_from_api(self):
        app = self.new()
        data = self.as_('ENTERPRISE').get(f'/api/v1/applications/{app.pk}/').json()
        self.assertEqual(data['status_label'], 'Brouillon')
        self.assertEqual(data['events'][0]['event_label'], 'Checklist mise à jour' if data['events'][0]['event_type'] == 'CHECKLIST_UPDATED' else 'Brouillon créé')
        self.assertEqual(data['documents'][0]['status_label'], 'Non déposé')
        self.assertIn('Environnement', APIClient().get('/api/v1/meta/').json()['domains'])

    def test_C7_updated_at_changes_on_every_action(self):
        app = self.to('SUBMITTED'); before = app.updated_at
        self.post('MANAGER', f'/api/v1/applications/{app.pk}/start-review/')
        app.refresh_from_db()
        self.assertGreater(app.updated_at, before)

    def test_C11_audit_date_is_timezone_aware(self):
        app = self.to('UNDER_REVIEW')
        self.post('MANAGER', f'/api/v1/applications/{app.pk}/schedule-audit/', {'auditor_id': self.users['AUDITOR'].pk, 'scheduled_for': '2026-11-10T09:00'})
        when = Audit.objects.get().scheduled_for
        self.assertIsNotNone(when.tzinfo)
        self.assertEqual(timezone.localtime(when).hour, 9)

    def test_C12_emails_sent_at_each_step(self):
        with self.captureOnCommitCallbacks(execute=True):
            app = self.to('SUBMITTED')
        self.assertTrue(any('manager@test.sn' in m.to and 'Dossier soumis' in m.subject for m in mail.outbox))
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            self.post('MANAGER', f'/api/v1/applications/{app.pk}/start-review/')
            self.post('MANAGER', f'/api/v1/applications/{app.pk}/assign/', {'user_id': self.users['EVALUATOR'].pk})
        recipients = {addr for m in mail.outbox for addr in m.to}
        self.assertEqual(recipients, {'enterprise@test.sn', 'evaluator@test.sn'})
        self.assertIn('/espace/dossiers/', [m for m in mail.outbox if 'enterprise@test.sn' in m.to][0].body)
        self.assertIn('/admin/dossiers/', [m for m in mail.outbox if 'evaluator@test.sn' in m.to][0].body)


class FunctionalTests(Base):
    def test_F11_accounts_list_and_deactivate(self):
        root = get_user_model().objects.create_superuser(username='root', email='root@test.sn', password=PASSWORD)
        self.assertEqual(self.as_('MANAGER').get('/api/v1/admin/accounts/').status_code, 403)
        listing = self.as_('ADMIN').get('/api/v1/admin/accounts/').json()
        self.assertIn('evaluator', [u['username'] for u in listing])
        self.assertNotIn('enterprise', [u['username'] for u in listing])
        url = f"/api/v1/admin/accounts/{self.users['EVALUATOR'].pk}/set-active/"
        self.assertEqual(self.post('ADMIN', url, {'is_active': False}).status_code, 403)
        self.client.force_authenticate(root)
        self.assertEqual(self.client.post(url, {'is_active': False}, format='json').status_code, 200)
        self.assertEqual(self.client.post(f'/api/v1/admin/accounts/{root.pk}/set-active/', {'is_active': False}, format='json').status_code, 400)
        login = APIClient().post('/api/v1/auth/login/', {'username': 'evaluator', 'password': PASSWORD}, format='json')
        self.assertEqual(login.status_code, 401)

    def test_F12_public_certificate_verification(self):
        app = self.to('DECISION_PENDING')
        self.post('DECISION_MAKER', f'/api/v1/applications/{app.pk}/decide/', {'decision': 'CERTIFIED'})
        cert = Certificate.objects.get(application=app)
        r = APIClient().get(f'/api/v1/public/certificates/{cert.number.lower()}/')
        self.assertEqual((r.status_code, r.json()['organization'], r.json()['is_valid']), (200, 'Pétrole SA', True))
        self.assertNotIn('ninea', r.json())
        self.assertEqual(APIClient().get('/api/v1/public/certificates/CERT-INCONNU/').status_code, 404)

    def test_F13_role_access_to_lists(self):
        app = self.to('UNDER_REVIEW')
        self.post('MANAGER', f'/api/v1/applications/{app.pk}/schedule-audit/', {'auditor_id': self.users['AUDITOR'].pk, 'scheduled_for': '2026-11-10T09:00'})
        self.post('EVALUATOR', f'/api/v1/applications/{app.pk}/request-correction/', {'domain': 'Sécurité', 'description': 'Écart'})
        self.assertEqual(len(self.as_('MANAGER').get('/api/v1/audits/').json()), 1)
        self.assertEqual(len(self.as_('AUDITOR').get('/api/v1/audits/').json()), 1)
        self.assertEqual(len(self.as_('AUDITOR').get('/api/v1/non-conformities/').json()), 1)
        self.assertEqual(len(self.as_('ENTERPRISE').get('/api/v1/non-conformities/').json()), 1)
        self.assertEqual(self.as_('MANAGER').get('/api/v1/certificates/').status_code, 200)
        self.assertEqual(self.as_('ENTERPRISE').get('/api/v1/certificates/').status_code, 200)

    def test_F13_decision_maker_does_not_see_drafts(self):
        draft = self.new(); submitted = self.to('SUBMITTED')
        ids = [a['id'] for a in self.as_('DECISION_MAKER').get('/api/v1/applications/').json()]
        self.assertNotIn(draft.pk, ids); self.assertIn(submitted.pk, ids)
        self.assertEqual(self.as_('DECISION_MAKER').get(f'/api/v1/applications/{draft.pk}/').status_code, 404)
        self.assertIn(draft.pk, [a['id'] for a in self.as_('MANAGER').get('/api/v1/applications/').json()])

    def test_F10_list_filters(self):
        draft = self.new(); submitted = self.to('SUBMITTED')
        ids = [a['id'] for a in self.as_('MANAGER').get('/api/v1/applications/?status=SUBMITTED').json()]
        self.assertEqual(ids, [submitted.pk])
        self.assertEqual(len(self.as_('MANAGER').get('/api/v1/applications/?search=pétrole').json()), 2)
        self.assertEqual(self.as_('MANAGER').get('/api/v1/applications/').json()[0]['organization_name'], 'Pétrole SA')

    def test_F6_members_and_invitations(self):
        self.assertEqual(self.as_('ENTERPRISE').get(f'/api/v1/organizations/{self.org.pk}/members/').json()[0]['is_owner'], True)
        with self.captureOnCommitCallbacks(execute=True):
            r = self.post('ENTERPRISE', '/api/v1/invitations/', {'email': 'collegue@test.sn'})
        self.assertEqual(r.status_code, 201)
        token = Invitation.objects.get().token
        self.assertIn(f'/invitation/{token}', mail.outbox[-1].body)
        self.assertEqual(APIClient().get(f'/api/v1/invitations/{token}/').json()['organization'], 'Pétrole SA')
        accept = APIClient().post(f'/api/v1/invitations/{token}/accept/', {'username': 'collegue', 'first_name': 'C', 'last_name': 'D', 'password': 'Collegue-2026-ok!'}, format='json')
        self.assertEqual(accept.status_code, 201)
        colleague = get_user_model().objects.get(username='collegue')
        self.assertEqual((colleague.email, colleague.access_profile.organization_id, colleague.access_profile.is_owner), ('collegue@test.sn', self.org.pk, False))
        self.assertEqual(APIClient().post(f'/api/v1/invitations/{token}/accept/', {'username': 'x2', 'first_name': 'C', 'last_name': 'D', 'password': 'Collegue-2026-ok!'}, format='json').status_code, 404)
        self.client.force_authenticate(colleague)
        self.assertEqual(self.client.post('/api/v1/invitations/', {'email': 'autre@test.sn'}, format='json').status_code, 403)
        self.assertEqual(len(self.client.get('/api/v1/applications/').json()), 0)

    def test_F6_expired_invitation_refused(self):
        inv = Invitation.objects.create(organization=self.org, email='tard@test.sn', token='t' * 40, invited_by=self.users['ENTERPRISE'], expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(APIClient().get(f'/api/v1/invitations/{inv.token}/').status_code, 404)


@unittest.skipIf(connection.vendor != 'postgresql', 'Accès réellement concurrents : exécuté avec PostgreSQL (CI).')
@override_settings(MEDIA_ROOT=MEDIA)
class ConcurrencyTests(TransactionTestCase):
    """Plusieurs utilisateurs déclenchent la même action au même instant : une seule réussit, les autres reçoivent 400 (jamais 500)."""
    def burst(self, user, path, body, n=6):
        results, barrier = [], threading.Barrier(n)
        def go():
            from django.db import connection as conn
            client = APIClient(); client.force_authenticate(user)
            barrier.wait()
            try:
                results.append(client.post(path, body, format='json').status_code)
            finally:
                conn.close()
        threads = [threading.Thread(target=go) for _ in range(n)]
        [t.start() for t in threads]; [t.join() for t in threads]
        return sorted(results)

    def setUp(self):
        org = Organization.objects.create(legal_name='C', ninea='C', activity='Distribution', verified_at=timezone.now())
        self.users = {}
        for role in ['MANAGER', 'EVALUATOR', 'DECISION_MAKER']:
            u = get_user_model().objects.create_user(username=role, password=PASSWORD)
            AccessProfile.objects.create(user=u, role=role); self.users[role] = u
        self.app = lambda status: Application.objects.create(organization=org, reference=f'C-{Application.objects.count()}', level='Standard', status=status, domains=['Sécurité'])

    def test_concurrent_actions(self):
        a = self.app('DECISION_PENDING')
        self.assertEqual(self.burst(self.users['DECISION_MAKER'], f'/api/v1/applications/{a.pk}/decide/', {'decision': 'CERTIFIED'}), [200, 400, 400, 400, 400, 400])
        b = self.app('SUBMITTED')
        self.assertEqual(self.burst(self.users['MANAGER'], f'/api/v1/applications/{b.pk}/start-review/', {}), [200, 400, 400, 400, 400, 400])
        self.assertEqual(b.events.filter(event_type='REVIEW_STARTED').count(), 1)
        c = self.app('UNDER_REVIEW')
        ApplicationAssignment.objects.create(application=c, user=self.users['EVALUATOR'])
        self.assertEqual(self.burst(self.users['EVALUATOR'], f'/api/v1/applications/{c.pk}/request-correction/', {'domain': 'Sécurité', 'description': 'x'}), [201] * 6)
        self.assertEqual(sorted(c.non_conformities.values_list('reference', flat=True)), [f'NC-{c.pk}-{i:03d}' for i in range(1, 7)])
        d = self.app('UNDER_REVIEW')
        self.assertEqual(self.burst(self.users['MANAGER'], f'/api/v1/applications/{d.pk}/assign/', {'user_id': self.users['EVALUATOR'].pk}), [200, 400, 400, 400, 400, 400])

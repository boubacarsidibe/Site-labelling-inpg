"""Audit rôle par rôle : chaque action est tentée, à la bonne étape du dossier, par chaque acteur.

La matrice `EXPECTED` décrit ce que chaque rôle doit pouvoir faire (docs/rbac.md). Le test échoue sur toute
différence et affiche la matrice obtenue ; `INPG_ROLES_REPORT=chemin.md` l'écrit aussi dans un fichier.
"""
import os
import shutil
import tempfile
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import AccessProfile, Application, Audit, Certificate, NonConformity, Organization, RequiredDocument

MEDIA = tempfile.mkdtemp(prefix='inpg-roles-media-')
PASSWORD = 'Roles-audit-2026!'

ACTORS = {
    'titulaire': ('ENTERPRISE', True), 'collaborateur': ('ENTERPRISE', False), 'autre_entreprise': ('ENTERPRISE', True),
    'professionnel': ('PROFESSIONAL', False), 'gestionnaire': ('MANAGER', False), 'evaluateur': ('EVALUATOR', False),
    'evaluateur_non_affecte': ('EVALUATOR', False), 'auditeur': ('AUDITOR', False), 'decideur': ('DECISION_MAKER', False),
    'administrateur': ('ADMIN', False), 'superutilisateur': (None, False), 'anonyme': (None, False),
}
ENT = {'titulaire', 'collaborateur'}
ADM = {'administrateur', 'superutilisateur'}

# action -> acteurs qui doivent réussir
EXPECTED = {
    # Organisation
    'lire sa fiche entreprise': ENT | {'gestionnaire'} | ADM,
    'modifier sa fiche (adresse)': ENT | ADM,
    'vérifier une organisation': {'gestionnaire'} | ADM,
    'voir les membres': ENT | ADM,
    'inviter un collaborateur': {'titulaire', 'autre_entreprise'},  # chacun dans sa propre organisation
    # Brouillon
    'créer une demande': ENT | ADM,
    'aperçu de la checklist': ENT | {'autre_entreprise', 'gestionnaire', 'evaluateur', 'evaluateur_non_affecte', 'auditeur', 'decideur'} | ADM,
    'modifier un brouillon': ENT | ADM,
    'supprimer un brouillon': ENT | ADM,
    'voir un brouillon': ENT | {'gestionnaire'} | ADM,
    'déposer une pièce': ENT | ADM,
    'télécharger une pièce (brouillon)': ENT | {'gestionnaire'} | ADM,
    'valider une pièce': {'gestionnaire'} | ADM,
    'soumettre': ENT | ADM,
    # Soumis
    'voir un dossier soumis': ENT | {'gestionnaire', 'decideur'} | ADM,
    'démarrer l’évaluation': {'gestionnaire'} | ADM,
    'affecter un évaluateur': {'gestionnaire'} | ADM,
    # En évaluation (évaluateur et auditeur affectés)
    'voir un dossier affecté': ENT | {'gestionnaire', 'evaluateur', 'auditeur', 'decideur'} | ADM,
    'télécharger une pièce (évaluation)': ENT | {'gestionnaire', 'evaluateur', 'auditeur', 'decideur'} | ADM,
    'retirer un évaluateur': {'gestionnaire'} | ADM,
    'planifier un audit': {'gestionnaire'} | ADM,
    'rédiger le compte rendu d’audit': {'auditeur'} | ADM,
    'signaler une non-conformité': {'evaluateur', 'auditeur'} | ADM,
    'clôturer l’évaluation': {'evaluateur'} | ADM,
    # Corrections demandées
    'répondre à une non-conformité': ENT | ADM,
    'remplacer une pièce en correction': ENT | ADM,
    'revoir une pièce remplacée': {'gestionnaire', 'evaluateur'} | ADM,
    'clôturer une non-conformité': {'evaluateur', 'auditeur'} | ADM,
    'renvoyer une non-conformité': {'evaluateur', 'auditeur'} | ADM,
    # Décision
    'décider (certifier)': {'decideur'} | ADM,
    'décider (refuser)': {'decideur'} | ADM,
    # Certificats et registres
    'voir ses certificats': ENT | {'gestionnaire', 'decideur'} | ADM,
    'suspendre un certificat': ADM,
    'voir les audits du dossier (liste)': {'gestionnaire', 'evaluateur', 'auditeur', 'decideur'} | ADM,
    'voir les non-conformités du dossier (liste)': ENT | {'gestionnaire', 'evaluateur', 'auditeur', 'decideur'} | ADM,
    'gérer les référentiels': ADM,
    'lister les comptes internes': ADM,
    'créer un compte interne': {'superutilisateur'},
    'désactiver un compte': {'superutilisateur'},
    'vérifier un certificat (public)': set(ACTORS),
    'changer son mot de passe': set(ACTORS) - {'anonyme'},
}


def pdf():
    return SimpleUploadedFile('preuve.pdf', b'%PDF-1.4 preuve', content_type='application/pdf')


@override_settings(MEDIA_ROOT=MEDIA)
class RolesAudit(TestCase):
    maxDiff = None

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.org = Organization.objects.create(legal_name='Pétrole SA', ninea='N-1', activity='Distribution', address='Dakar', verified_at=timezone.now())
        self.other = Organization.objects.create(legal_name='Autre SA', ninea='N-2', activity='Stockage', address='Thiès', verified_at=timezone.now())
        self.u = {}
        for name, (role, owner) in ACTORS.items():
            if name == 'anonyme':
                continue
            user = get_user_model().objects.create_user(username=name, email=f'{name}@test.sn', password=PASSWORD, is_superuser=name == 'superutilisateur')
            if role:
                org = self.other if name == 'autre_entreprise' else self.org if role == 'ENTERPRISE' else None
                AccessProfile.objects.create(user=user, role=role, organization=org, is_owner=owner)
            self.u[name] = user
        self.c = APIClient()

    # ------------------------------------------------------------------ outils
    def as_(self, name):
        self.c.force_authenticate(self.u.get(name))
        return self.c

    def ok(self, name, method, url, data=None, fmt='json'):
        response = getattr(self.as_(name), method)(url, data or {}, format=fmt)
        return response.status_code < 300, response

    def must(self, name, method, url, data=None, fmt='json'):
        success, response = self.ok(name, method, url, data, fmt)
        self.assertTrue(success, f'{name} {method} {url} : {response.status_code} {response.content[:300]}')
        return response

    def app(self, status, domains=('Sécurité',)):
        """Dossier amené à l'étape voulue avec les vrais rôles."""
        a = self.must('titulaire', 'post', '/api/v1/applications/', {'organization': self.org.pk, 'domains': list(domains), 'activity': 'Distribution'}).json()
        if status == 'DRAFT':
            return Application.objects.get(pk=a['id'])
        for d in RequiredDocument.objects.filter(application_id=a['id']):
            self.must('titulaire', 'post', f'/api/v1/documents/{d.pk}/upload/', {'file': pdf()}, 'multipart')
            self.must('gestionnaire', 'post', f'/api/v1/documents/{d.pk}/review/', {'status': 'VALIDATED'})
        base = f"/api/v1/applications/{a['id']}/"
        self.must('titulaire', 'post', base + 'submit/')
        if status != 'SUBMITTED':
            self.must('gestionnaire', 'post', base + 'start-review/')
            self.must('gestionnaire', 'post', base + 'assign/', {'user_id': self.u['evaluateur'].pk})
            self.must('gestionnaire', 'post', base + 'schedule-audit/', {'auditor_id': self.u['auditeur'].pk, 'scheduled_for': (timezone.now() + timedelta(days=3)).isoformat()})
        if status in ('CORRECTION_REQUIRED', 'DECISION_PENDING', 'CERTIFIED'):
            audit = Audit.objects.get(application_id=a['id'])
            self.must('auditeur', 'post', base + 'complete-audit/', {'audit_id': audit.pk, 'summary': 'RAS'})
        if status == 'CORRECTION_REQUIRED':
            self.must('evaluateur', 'post', base + 'request-correction/', {'domain': domains[0], 'description': 'Écart'})
        if status in ('DECISION_PENDING', 'CERTIFIED'):
            self.must('evaluateur', 'post', base + 'complete-evaluation/')
        if status == 'CERTIFIED':
            self.must('decideur', 'post', base + 'decide/', {'decision': 'CERTIFIED', 'domains': list(domains)})
        return Application.objects.get(pk=a['id'])

    def attempt(self, name, fn):
        """Exécute l'action puis annule tout : chaque acteur part du même état."""
        with transaction.atomic():
            success = bool(fn(name))
            transaction.set_rollback(True)
        return success

    # ------------------------------------------------------------------ scénarios
    def scenarios(self):
        S = {}
        p = lambda n, m, url, data=None, fmt='json': self.ok(n, m, url, data, fmt)[0]

        S['lire sa fiche entreprise'] = (None, lambda n, a: p(n, 'get', f'/api/v1/organizations/{self.org.pk}/'))
        S['modifier sa fiche (adresse)'] = (None, lambda n, a: p(n, 'patch', f'/api/v1/organizations/{self.org.pk}/', {'address': 'Rufisque'}))
        S['vérifier une organisation'] = ('NEW_ORG', lambda n, a: p(n, 'post', f'/api/v1/organizations/{a.pk}/verify/'))
        S['voir les membres'] = (None, lambda n, a: p(n, 'get', f'/api/v1/organizations/{self.org.pk}/members/'))
        S['inviter un collaborateur'] = (None, lambda n, a: p(n, 'post', '/api/v1/invitations/', {'email': f'nouveau.{n}@test.sn'}))

        S['créer une demande'] = (None, lambda n, a: p(n, 'post', '/api/v1/applications/', {'organization': self.org.pk, 'domains': ['Qualité'], 'activity': 'Distribution'}))
        S['aperçu de la checklist'] = (None, lambda n, a: p(n, 'get', '/api/v1/requirements/preview/?domains=Sécurité&activity=Distribution'))
        S['modifier un brouillon'] = ('DRAFT', lambda n, a: p(n, 'patch', f'/api/v1/applications/{a.pk}/', {'scope': 'Dépôt'}))
        S['supprimer un brouillon'] = ('DRAFT', lambda n, a: p(n, 'delete', f'/api/v1/applications/{a.pk}/'))
        S['voir un brouillon'] = ('DRAFT', lambda n, a: p(n, 'get', f'/api/v1/applications/{a.pk}/'))
        S['déposer une pièce'] = ('DRAFT', lambda n, a: p(n, 'post', f'/api/v1/documents/{a.documents.first().pk}/upload/', {'file': pdf()}, 'multipart'))

        def download_draft(n, a):
            d = a.documents.first(); self.must('titulaire', 'post', f'/api/v1/documents/{d.pk}/upload/', {'file': pdf()}, 'multipart')
            return p(n, 'get', f'/api/v1/documents/{d.pk}/download/')
        S['télécharger une pièce (brouillon)'] = ('DRAFT', download_draft)

        def review(n, a):
            d = a.documents.first(); self.must('titulaire', 'post', f'/api/v1/documents/{d.pk}/upload/', {'file': pdf()}, 'multipart')
            return p(n, 'post', f'/api/v1/documents/{d.pk}/review/', {'status': 'VALIDATED'})
        S['valider une pièce'] = ('DRAFT', review)

        def submit(n, a):
            for d in a.documents.all():
                self.must('titulaire', 'post', f'/api/v1/documents/{d.pk}/upload/', {'file': pdf()}, 'multipart')
                self.must('gestionnaire', 'post', f'/api/v1/documents/{d.pk}/review/', {'status': 'VALIDATED'})
            return p(n, 'post', f'/api/v1/applications/{a.pk}/submit/')
        S['soumettre'] = ('DRAFT', submit)

        S['voir un dossier soumis'] = ('SUBMITTED', lambda n, a: p(n, 'get', f'/api/v1/applications/{a.pk}/'))
        S['démarrer l’évaluation'] = ('SUBMITTED', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/start-review/'))
        S['affecter un évaluateur'] = ('SUBMITTED', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/assign/', {'user_id': self.u['evaluateur'].pk}))

        S['voir un dossier affecté'] = ('UNDER_REVIEW', lambda n, a: p(n, 'get', f'/api/v1/applications/{a.pk}/'))
        S['télécharger une pièce (évaluation)'] = ('UNDER_REVIEW', lambda n, a: p(n, 'get', f'/api/v1/documents/{a.documents.first().pk}/download/'))
        S['retirer un évaluateur'] = ('UNDER_REVIEW', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/unassign/', {'user_id': self.u['evaluateur'].pk}))
        S['planifier un audit'] = ('UNDER_REVIEW', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/schedule-audit/', {'auditor_id': self.u['auditeur'].pk, 'scheduled_for': (timezone.now() + timedelta(days=9)).isoformat()}))
        S['rédiger le compte rendu d’audit'] = ('UNDER_REVIEW', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/complete-audit/', {'audit_id': a.audits.first().pk, 'summary': 'Constats'}))
        S['signaler une non-conformité'] = ('UNDER_REVIEW', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/request-correction/', {'domain': 'Sécurité', 'description': 'Écart'}))

        def complete_eval(n, a):
            self.must('auditeur', 'post', f'/api/v1/applications/{a.pk}/complete-audit/', {'audit_id': a.audits.first().pk, 'summary': 'RAS'})
            return p(n, 'post', f'/api/v1/applications/{a.pk}/complete-evaluation/')
        S['clôturer l’évaluation'] = ('UNDER_REVIEW', complete_eval)

        nc = lambda a: a.non_conformities.first()
        S['répondre à une non-conformité'] = ('CORRECTION_REQUIRED', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/respond-correction/', {'non_conformity_id': nc(a).pk, 'response': 'Corrigé'}))
        S['remplacer une pièce en correction'] = ('CORRECTION_REQUIRED', lambda n, a: p(n, 'post', f'/api/v1/documents/{a.documents.first().pk}/upload/', {'file': pdf()}, 'multipart'))

        def review_replaced(n, a):
            d = a.documents.first(); self.must('titulaire', 'post', f'/api/v1/documents/{d.pk}/upload/', {'file': pdf()}, 'multipart')
            return p(n, 'post', f'/api/v1/documents/{d.pk}/review/', {'status': 'VALIDATED'})
        S['revoir une pièce remplacée'] = ('CORRECTION_REQUIRED', review_replaced)

        def answered(a):
            self.must('titulaire', 'post', f'/api/v1/applications/{a.pk}/respond-correction/', {'non_conformity_id': nc(a).pk, 'response': 'Corrigé'})
        S['clôturer une non-conformité'] = ('CORRECTION_REQUIRED', lambda n, a: answered(a) or p(n, 'post', f'/api/v1/applications/{a.pk}/validate-correction/', {'non_conformity_id': nc(a).pk}))
        S['renvoyer une non-conformité'] = ('CORRECTION_REQUIRED', lambda n, a: answered(a) or p(n, 'post', f'/api/v1/applications/{a.pk}/reject-correction/', {'non_conformity_id': nc(a).pk, 'reason': 'Insuffisant'}))

        S['décider (certifier)'] = ('DECISION_PENDING', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/decide/', {'decision': 'CERTIFIED', 'domains': ['Sécurité']}))
        S['décider (refuser)'] = ('DECISION_PENDING', lambda n, a: p(n, 'post', f'/api/v1/applications/{a.pk}/decide/', {'decision': 'REJECTED', 'note': 'Non conforme'}))

        # Régression : le registre était figé à sa première lecture (cache du queryset de classe), les nouveaux certificats manquaient.
        self.as_('gestionnaire').get('/api/v1/certificates/')
        def sees_certificate(n, a):
            success, response = self.ok(n, 'get', '/api/v1/certificates/')
            return success and any(c['id'] == a.certificate.pk for c in response.json())
        S['voir ses certificats'] = ('CERTIFIED', sees_certificate)
        S['suspendre un certificat'] = ('CERTIFIED', lambda n, a: p(n, 'post', f'/api/v1/certificates/{a.certificate.pk}/update-status/', {'status': 'SUSPENDED'}))
        def listed(n, url, ids):
            success, response = self.ok(n, 'get', url)
            return success and bool(ids & {row['id'] for row in response.json()})
        S['voir les audits du dossier (liste)'] = ('UNDER_REVIEW', lambda n, a: listed(n, '/api/v1/audits/', set(a.audits.values_list('id', flat=True))))
        S['voir les non-conformités du dossier (liste)'] = ('CORRECTION_REQUIRED', lambda n, a: listed(n, '/api/v1/non-conformities/', set(a.non_conformities.values_list('id', flat=True))))
        S['gérer les référentiels'] = (None, lambda n, a: p(n, 'post', '/api/v1/requirements/', {'domain': 'Qualité', 'activity': '', 'name': f'Pièce {n}', 'mandatory': True, 'active': True, 'order': 9}))
        S['lister les comptes internes'] = (None, lambda n, a: p(n, 'get', '/api/v1/admin/accounts/'))
        S['créer un compte interne'] = (None, lambda n, a: p(n, 'post', '/api/v1/admin/accounts/', {'username': f'cree.{n}', 'email': f'cree.{n}@test.sn', 'password': 'Interne-solide-2026!', 'role': 'AUDITOR'}))
        S['désactiver un compte'] = (None, lambda n, a: p(n, 'post', f"/api/v1/admin/accounts/{self.u['auditeur'].pk}/set-active/", {'is_active': False}))
        S['vérifier un certificat (public)'] = ('CERTIFIED', lambda n, a: p(n, 'get', f'/api/v1/public/certificates/{a.certificate.number}/'))
        def change_password(n, a):
            self.c.force_authenticate(None); self.c.logout()
            if n != 'anonyme':
                self.assertTrue(self.c.login(username=n, password=PASSWORD))
            r = self.c.post('/api/v1/auth/password-change/', {'current_password': PASSWORD, 'new_password': 'Nouveau-secret-2026!'}, format='json')
            self.c.logout()
            return r.status_code == 200
        S['changer son mot de passe'] = (None, change_password)
        return S

    def test_matrice_des_roles(self):
        scenarios = self.scenarios()
        self.assertEqual(set(scenarios), set(EXPECTED), 'Chaque action attendue doit avoir un scénario.')
        actual, cache_states = {}, {}
        for action, (state, fn) in scenarios.items():
            if state == 'NEW_ORG':
                target = Organization.objects.create(legal_name='À vérifier SA', ninea=f'N-{action[:3]}', activity='Transport', address='')
            elif state:
                target = cache_states.get(state) or cache_states.setdefault(state, self.app(state))
            else:
                target = None
            actual[action] = set()
            for name in ACTORS:
                cache.clear()
                if self.attempt(name, lambda n: fn(n, Application.objects.get(pk=target.pk) if isinstance(target, Application) else target)):
                    actual[action].add(name)

        names = list(ACTORS)
        lines = ['| Action | ' + ' | '.join(names) + ' |', '|---|' + '---|' * len(names)]
        problems = []
        for action in EXPECTED:
            cells = []
            for n in names:
                want, got = n in EXPECTED[action], n in actual[action]
                cells.append('✅' if want and got else '·' if not want and not got else '❌ bloqué' if want else '⚠️ autorisé')
                if want != got:
                    problems.append(f"{action} — {n} : {'devrait pouvoir, mais est refusé' if want else 'ne devrait pas pouvoir, mais réussit'}")
            lines.append(f'| {action} | ' + ' | '.join(cells) + ' |')
        report = '\n'.join(lines) + '\n\n' + ('\n'.join('- ' + p for p in problems) or 'Aucun écart.') + '\n'
        if os.environ.get('INPG_ROLES_REPORT'):
            with open(os.environ['INPG_ROLES_REPORT'], 'w', encoding='utf-8') as fh:
                fh.write(report)
        self.assertEqual(problems, [], '\n' + report)


class PasswordChange(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(username='awa', email='awa@test.sn', password=PASSWORD)
        self.c = APIClient(enforce_csrf_checks=True)
        self.c.get('/api/v1/auth/csrf/')
        self.c.login(username='awa', password=PASSWORD)

    def post(self, data):
        return self.c.post('/api/v1/auth/password-change/', data, format='json', HTTP_X_CSRFTOKEN=self.c.cookies['csrftoken'].value)

    def test_mot_de_passe_actuel_exige(self):
        self.assertEqual(self.post({'current_password': 'faux', 'new_password': 'Nouveau-secret-2026!'}).status_code, 400)
        self.assertTrue(get_user_model().objects.get(pk=self.user.pk).check_password(PASSWORD))

    def test_regles_de_robustesse(self):
        self.assertEqual(self.post({'current_password': PASSWORD, 'new_password': '12345'}).status_code, 400)
        self.assertEqual(self.post({'current_password': PASSWORD, 'new_password': PASSWORD}).status_code, 400)

    def test_changement_garde_la_session_et_invalide_l_ancien(self):
        self.assertEqual(self.post({'current_password': PASSWORD, 'new_password': 'Nouveau-secret-2026!'}).status_code, 200)
        self.assertEqual(self.c.get('/api/v1/auth/me/').status_code, 200)
        self.assertFalse(APIClient().login(username='awa', password=PASSWORD))

    def test_csrf_et_session_obligatoires(self):
        self.assertEqual(self.c.post('/api/v1/auth/password-change/', {}, format='json').status_code, 403)
        self.c.logout(); self.c.get('/api/v1/auth/csrf/')
        self.assertEqual(self.post({'current_password': PASSWORD, 'new_password': 'Nouveau-secret-2026!'}).status_code, 401)

"""Règles partagées : journal, notifications e-mail, référentiel, numérotation, fichiers, limitation de débit."""
import logging
import os
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, Throttled
from rest_framework.throttling import SimpleRateThrottle
from .models import AccessProfile, Application, RequiredDocument, RequirementTemplate, WorkflowEvent, DOMAINS, ACTIVITIES

log = logging.getLogger('platform_api')

EVENT_LABELS = {
    'DRAFT_CREATED': 'Brouillon créé', 'DRAFT_UPDATED': 'Brouillon modifié', 'CHECKLIST_UPDATED': 'Checklist mise à jour',
    'DOCUMENT_UPLOADED': 'Pièce déposée', 'DOCUMENT_VALIDATED': 'Pièce validée', 'DOCUMENT_REJECTED': 'Pièce à corriger',
    'SUBMITTED': 'Dossier soumis', 'ASSIGNED': 'Intervenant affecté', 'UNASSIGNED': 'Affectation retirée',
    'REVIEW_STARTED': 'Évaluation démarrée', 'AUDIT_SCHEDULED': 'Audit planifié', 'AUDIT_COMPLETED': 'Audit réalisé',
    'CORRECTION_REQUESTED': 'Correction demandée', 'CORRECTION_RESPONDED': 'Correction transmise',
    'CORRECTION_REJECTED': 'Correction renvoyée', 'CORRECTION_VALIDATED': 'Correction clôturée',
    'EVALUATION_COMPLETED': 'Évaluation terminée', 'DECISION_CERTIFIED': 'Certification accordée', 'DECISION_REJECTED': 'Certification refusée',
    'CERTIFICATE_VALID': 'Certificat réactivé', 'CERTIFICATE_SUSPENDED': 'Certificat suspendu', 'CERTIFICATE_REVOKED': 'Certificat révoqué',
    'ORGANIZATION_VERIFIED': 'Organisation vérifiée',
}

def status_label(status):
    return Application.Status(status).label if status in Application.Status.values else status

def require_status(item, *allowed, action='Cette action'):
    """Vérifie l'étape du dossier (sous verrou) et explique pourquoi l'action n'est plus possible."""
    if item.status not in allowed:
        raise ValidationError({'detail': f'{action} est impossible : le dossier est actuellement « {status_label(item.status)} ». Actualisez la page, il a peut-être été modifié par un autre utilisateur.'})

def lock_application(view):
    """Relit le dossier visible par l'utilisateur en le verrouillant jusqu'à la fin de la transaction."""
    obj = view.get_object()
    return Application.objects.select_for_update().get(pk=obj.pk)

# ------------------------------------------------------------------ journal et e-mails
def _users(qs):
    return [u for u in qs if u.is_active and u.email]

def enterprise_users(app):
    User = get_user_model()
    return _users(User.objects.filter(access_profile__role='ENTERPRISE', access_profile__organization_id=app.organization_id))

def role_users(*roles):
    return _users(get_user_model().objects.filter(access_profile__role__in=roles))

def assignees(app):
    return _users(get_user_model().objects.filter(applicationassignment__application=app))

RECIPIENTS = {
    'SUBMITTED': lambda a, x: role_users('MANAGER'),
    'REVIEW_STARTED': lambda a, x: enterprise_users(a),
    'ASSIGNED': lambda a, x: x or [],
    'AUDIT_SCHEDULED': lambda a, x: (x or []) + enterprise_users(a),
    'AUDIT_COMPLETED': lambda a, x: role_users('MANAGER') + assignees(a),
    'DOCUMENT_REJECTED': lambda a, x: enterprise_users(a),
    'CORRECTION_REQUESTED': lambda a, x: enterprise_users(a),
    'CORRECTION_RESPONDED': lambda a, x: assignees(a),
    'CORRECTION_REJECTED': lambda a, x: enterprise_users(a),
    'CORRECTION_VALIDATED': lambda a, x: enterprise_users(a),
    'EVALUATION_COMPLETED': lambda a, x: role_users('DECISION_MAKER'),
    'DECISION_CERTIFIED': lambda a, x: enterprise_users(a) + role_users('MANAGER'),
    'DECISION_REJECTED': lambda a, x: enterprise_users(a) + role_users('MANAGER'),
    'CERTIFICATE_SUSPENDED': lambda a, x: enterprise_users(a),
    'CERTIFICATE_REVOKED': lambda a, x: enterprise_users(a),
    'CERTIFICATE_VALID': lambda a, x: enterprise_users(a),
}

def mail(recipients, subject, body):
    """Envoie après validation de la transaction ; une panne SMTP n'annule jamais l'action métier."""
    emails = sorted({u.email if hasattr(u, 'email') else u for u in recipients if (getattr(u, 'email', u))})
    if not emails:
        return
    def _send():
        try:
            send_mail(f'[Label INPG] {subject}', body, settings.DEFAULT_FROM_EMAIL, emails, fail_silently=False)
        except Exception:  # pragma: no cover - dépend du serveur SMTP
            log.exception('Échec d’envoi d’e-mail : %s', subject)
    transaction.on_commit(_send)

def link_for(user, app):
    internal = getattr(getattr(user, 'access_profile', None), 'role', 'ADMIN') != 'ENTERPRISE'
    return f"{settings.FRONTEND_URL}/{'admin' if internal else 'espace'}/dossiers/{app.pk}"

def event(application, user, event_type, note='', notify_users=None):
    """Journalise une transition (dans la même transaction) et prévient les personnes concernées."""
    WorkflowEvent.objects.create(application=application, actor=user if user and user.is_authenticated else None, event_type=event_type, note=note)
    pick = RECIPIENTS.get(event_type)
    if not pick:
        return
    label = EVENT_LABELS.get(event_type, event_type)
    for recipient in {u.pk: u for u in pick(application, notify_users) if u != user}.values():
        mail([recipient], f'{application.reference} — {label}',
             f"Bonjour,\n\nDossier {application.reference} ({application.organization.legal_name}) : {label.lower()}."
             + (f"\n\n{note}" if note else '') + f"\n\nStatut : {status_label(application.status)}\nAccéder au dossier : {link_for(recipient, application)}\n\nPlateforme Label INPG")

# ------------------------------------------------------------------ référentiel et checklist
def validate_domains(domains):
    if not isinstance(domains, list) or not domains or any(d not in DOMAINS for d in domains) or len(set(domains)) != len(domains):
        raise ValidationError({'domains': f'Choisissez un à trois volets parmi : {", ".join(DOMAINS)} (sans doublon).'})
    return [d for d in DOMAINS if d in domains]

def validate_activity(activity):
    if activity not in ACTIVITIES:
        raise ValidationError({'activity': f'Activité inconnue. Valeurs possibles : {", ".join(ACTIVITIES)}.'})
    return activity

def checklist(activity, domains):
    return list(RequirementTemplate.objects.filter(active=True, domain__in=domains, activity__in=['', activity]).order_by('domain', 'order', 'id'))

def sync_checklist(application):
    """Aligne les pièces attendues sur les volets et l'activité ; conserve les pièces déjà déposées qui restent requises."""
    wanted = {(t.domain, t.name): t for t in checklist(application.activity, application.domains)}
    existing = {(d.domain, d.name): d for d in application.documents.all()}
    for key, doc in existing.items():
        if key not in wanted:
            remove_file(doc.file)
            doc.delete()
    for key, t in wanted.items():
        if key not in existing:
            RequiredDocument.objects.create(application=application, domain=t.domain, name=t.name, mandatory=t.mandatory)

def next_reference():
    """Référence lisible INPG-AAAA-NNNN, attribuée dans la transaction de création."""
    year = timezone.now().year
    prefix = f'INPG-{year}-'
    last = Application.objects.select_for_update().filter(reference__startswith=prefix).order_by('-reference').values_list('reference', flat=True).first()
    number = int(last.rsplit('-', 1)[1]) + 1 if last and last.rsplit('-', 1)[1].isdigit() else 1
    return f'{prefix}{number:04d}'

# ------------------------------------------------------------------ fichiers
ALLOWED_FILES = {'.pdf': (b'%PDF',), '.png': (b'\x89PNG\r\n\x1a\n',), '.jpg': (b'\xff\xd8\xff',), '.jpeg': (b'\xff\xd8\xff',)}

def validate_upload(uploaded):
    if not uploaded:
        raise ValidationError({'file': 'Un fichier est requis.'})
    if uploaded.size > settings.MAX_UPLOAD_SIZE:
        raise ValidationError({'file': 'Le fichier dépasse 10 Mo.'})
    ext = os.path.splitext(uploaded.name)[1].lower()
    head = uploaded.read(16); uploaded.seek(0)
    if ext not in ALLOWED_FILES or not head.startswith(ALLOWED_FILES[ext]):
        raise ValidationError({'file': 'Seuls les fichiers PDF, PNG et JPEG authentiques sont acceptés.'})

def remove_file(field_file):
    """Supprime le fichier du disque une fois la transaction validée (jamais avant)."""
    if field_file and field_file.name:
        storage, name = field_file.storage, field_file.name
        transaction.on_commit(lambda: storage.exists(name) and storage.delete(name))

# ------------------------------------------------------------------ limitation de débit
class _Ident(SimpleRateThrottle):
    rate = '1/s'
    def get_cache_key(self, request, view):
        return None

def client_ip(request):
    """IP du client ; derrière un proxy, REST_FRAMEWORK['NUM_PROXIES'] indique combien de sauts ignorer."""
    return _Ident().get_ident(request)

class RateLimit:
    """Compteur partagé (cache Django) : ne compte que ce qu'on lui signale, par portée séparée."""
    def __init__(self, scope, limit, window):
        self.scope, self.limit, self.window = scope, limit, window
    def key(self, request, extra=''):
        return f'ratelimit:{self.scope}:{client_ip(request)}:{extra}'
    def check(self, request, extra=''):
        if cache.get(self.key(request, extra), 0) >= self.limit:
            raise Throttled(wait=self.window, detail='Trop de tentatives. Réessayez plus tard.')
    def hit(self, request, extra=''):
        key = self.key(request, extra)
        if cache.add(key, 1, self.window) is False:
            try:
                cache.incr(key)
            except ValueError:
                cache.set(key, 1, self.window)
    def reset(self, request, extra=''):
        cache.delete(self.key(request, extra))

LOGIN_FAILURES = RateLimit('login', 10, 60)
REGISTRATIONS = RateLimit('register', 10, 3600)
PASSWORD_RESETS = RateLimit('password-reset', 5, 3600)
INVITATION_ACCEPTS = RateLimit('invitation', 20, 3600)
PUBLIC_LOOKUPS = RateLimit('verify', 60, 60)

import json
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password, MinimumLengthValidator, CommonPasswordValidator, NumericPasswordValidator, UserAttributeSimilarityValidator
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework.exceptions import Throttled
from .access import role, capabilities, profile
from .models import DOMAINS, ACTIVITIES, LEVELS
from .services import LOGIN_FAILURES, PASSWORD_RESETS, mail

PASSWORD_VALIDATORS = [MinimumLengthValidator(10), CommonPasswordValidator(), NumericPasswordValidator(), UserAttributeSimilarityValidator()]

def identity(user):
    access = profile(user)
    org = access.organization if access and access.organization_id else None
    return {'id': user.pk, 'username': user.get_username(), 'email': user.email, 'role': role(user), 'capabilities': capabilities(user),
            'is_superuser': user.is_superuser, 'organization_id': org.pk if org else None,
            'organization_name': org.legal_name if org else None, 'organization_verified': org.is_verified if org else None,
            'is_owner': bool(access and access.is_owner)}

def body(request):
    data = json.loads(request.body or b'{}')
    if not isinstance(data, dict):
        raise ValueError()
    return data

def throttled(exc):
    return JsonResponse({'detail': str(exc.detail)}, status=429)

@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'detail': 'CSRF prêt.'})

@require_GET
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    return JsonResponse(identity(request.user))

@require_GET
def meta(request):
    """Valeurs de référence partagées par l'interface (une seule source de vérité)."""
    return JsonResponse({'domains': DOMAINS, 'activities': ACTIVITIES, 'levels': {str(k): v for k, v in LEVELS.items()},
                         'severities': [{'value': 'MINEURE', 'label': 'Mineure'}, {'value': 'MAJEURE', 'label': 'Majeure'}, {'value': 'CRITIQUE', 'label': 'Critique'}]})

@require_POST
@csrf_protect
def sign_in(request):
    try:
        data = body(request)
        username = data.get('username'); password = data.get('password')
        if not isinstance(username, str) or not isinstance(password, str) or len(username) > 150 or len(password) > 4096:
            raise ValueError()
    except (ValueError, AttributeError):
        return JsonResponse({'detail': 'Requête invalide.'}, status=400)
    # Seuls les échecs sont comptés (par IP), pour bloquer la force brute sans pénaliser les connexions légitimes.
    try:
        LOGIN_FAILURES.check(request)
    except Throttled as exc:
        return throttled(exc)
    user = authenticate(request, username=username, password=password)
    if user is None:
        LOGIN_FAILURES.hit(request)
        return JsonResponse({'detail': 'Identifiants incorrects.'}, status=401)
    login(request, user)
    return JsonResponse(identity(user))

@require_POST
@csrf_protect
def sign_out(request):
    logout(request)
    return JsonResponse({'detail': 'Déconnecté.'})

@require_POST
@csrf_protect
def password_reset(request):
    """Envoie un lien de réinitialisation. La réponse est identique que l'adresse existe ou non."""
    try:
        PASSWORD_RESETS.check(request)
        email = body(request).get('email')
    except Throttled as exc:
        return throttled(exc)
    except ValueError:
        return JsonResponse({'detail': 'Requête invalide.'}, status=400)
    PASSWORD_RESETS.hit(request)
    if isinstance(email, str) and email.strip():
        for user in get_user_model().objects.filter(email__iexact=email.strip(), is_active=True):
            uid = urlsafe_base64_encode(force_bytes(user.pk)); token = default_token_generator.make_token(user)
            mail([user], 'Réinitialisation de votre mot de passe',
                 f'Bonjour {user.get_username()},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 24 heures) :\n'
                 f'{settings.FRONTEND_URL}/reinitialisation?uid={uid}&token={token}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.\n\nPlateforme Label INPG')
    return JsonResponse({'detail': 'Si un compte correspond à cette adresse, un e-mail vient d’être envoyé.'})

@require_POST
@csrf_protect
def password_reset_confirm(request):
    try:
        data = body(request)
        user = get_user_model().objects.get(pk=force_str(urlsafe_base64_decode(str(data.get('uid', '')))), is_active=True)
    except (ValueError, TypeError, OverflowError, get_user_model().DoesNotExist):
        return JsonResponse({'detail': 'Lien invalide ou expiré.'}, status=400)
    if not default_token_generator.check_token(user, str(data.get('token', ''))):
        return JsonResponse({'detail': 'Lien invalide ou expiré.'}, status=400)
    password = data.get('password')
    try:
        if not isinstance(password, str):
            raise ValidationError('Mot de passe requis.')
        validate_password(password, user, password_validators=PASSWORD_VALIDATORS)
    except ValidationError as error:
        return JsonResponse({'detail': ' '.join(error.messages)}, status=400)
    user.set_password(password); user.save(update_fields=['password'])
    return JsonResponse({'detail': 'Mot de passe modifié. Vous pouvez vous connecter.'})

@require_POST
@csrf_protect
def password_change(request):
    """Changement du mot de passe par l'utilisateur connecté (tous les rôles). Les échecs comptent comme des échecs de connexion."""
    if not request.user.is_authenticated or not request.user.is_active:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    try:
        LOGIN_FAILURES.check(request)
        data = body(request)
    except Throttled as exc:
        return throttled(exc)
    except ValueError:
        return JsonResponse({'detail': 'Requête invalide.'}, status=400)
    current, new = data.get('current_password'), data.get('new_password')
    if not isinstance(current, str) or not request.user.check_password(current):
        LOGIN_FAILURES.hit(request)
        return JsonResponse({'detail': 'Mot de passe actuel incorrect.'}, status=400)
    try:
        if not isinstance(new, str) or new == current:
            raise ValidationError('Choisissez un nouveau mot de passe différent de l’actuel.')
        validate_password(new, request.user, password_validators=PASSWORD_VALIDATORS)
    except ValidationError as error:
        return JsonResponse({'detail': ' '.join(error.messages)}, status=400)
    request.user.set_password(new); request.user.save(update_fields=['password'])
    update_session_auth_hash(request, request.user)  # la session en cours reste ouverte, les autres sont fermées
    return JsonResponse({'detail': 'Mot de passe modifié.'})

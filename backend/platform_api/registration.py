import json
import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction, IntegrityError
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST, require_GET
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import Throttled, PermissionDenied, ValidationError as ApiValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .access import capabilities, profile
from .auth_views import PASSWORD_VALIDATORS, throttled
from .models import AccessProfile, Organization, Invitation, ACTIVITIES
from .serializers import InvitationSerializer
from .services import REGISTRATIONS, INVITATION_ACCEPTS, mail

INVITATION_VALIDITY = timedelta(days=7)

def _clean_identity(data, extra_limits=None):
    clean = {}
    limits = {'username': 150, 'email': 254, 'first_name': 150, 'last_name': 150, 'password': 4096, **(extra_limits or {})}
    for key, maximum in limits.items():
        value = data.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > maximum:
            raise ValidationError('Les champs obligatoires doivent être valides et renseignés.')
        clean[key] = value if key == 'password' else value.strip()
    validate_email(clean['email'])
    User = get_user_model()
    User._meta.get_field('username').run_validators(clean['username'])
    if User.objects.filter(email__iexact=clean['email']).exists():
        raise ValidationError('Un compte utilise déjà cette adresse e-mail.')
    user = User(username=clean['username'], email=clean['email'], first_name=clean['first_name'], last_name=clean['last_name'])
    validate_password(clean['password'], user, password_validators=PASSWORD_VALIDATORS)
    return clean, user

@require_POST
@csrf_protect
def register(request):
    try:
        REGISTRATIONS.check(request)
    except Throttled as exc:
        return throttled(exc)
    if request.user.is_authenticated:
        return JsonResponse({'detail': 'Déconnectez-vous avant de créer un autre compte.'}, status=400)
    REGISTRATIONS.hit(request)
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict) or data.get('kind') not in ['ENTERPRISE', 'PROFESSIONAL']:
            raise ValidationError('Choisissez Entreprise ou Professionnel.')
        clean, user = _clean_identity(data, {'legal_name': 255, 'ninea': 64} if data['kind'] == 'ENTERPRISE' else None)
        activity = data.get('activity', '')
        if data['kind'] == 'ENTERPRISE' and activity and activity not in ACTIVITIES:
            raise ValidationError('Activité inconnue.')
        with transaction.atomic():
            user.set_password(clean['password'])
            user.save()
            organization = None
            if data['kind'] == 'ENTERPRISE':
                # Jamais de rattachement à une organisation existante par le NINEA ; la nouvelle organisation doit être vérifiée par l'INPG.
                organization = Organization.objects.create(legal_name=clean['legal_name'], ninea=clean['ninea'], activity=activity, address='')
            AccessProfile.objects.create(user=user, role=data['kind'], organization=organization, is_owner=data['kind'] == 'ENTERPRISE')
        return JsonResponse({'detail': 'Compte créé.'}, status=201)
    except ValidationError as error:
        return JsonResponse({'detail': ' '.join(error.messages)}, status=400)
    except IntegrityError:
        return JsonResponse({'detail': 'Cet identifiant ou cette entreprise est déjà enregistré. Contactez l’administrateur pour un rattachement.'}, status=400)
    except (ValueError, TypeError):
        return JsonResponse({'detail': 'Requête invalide.'}, status=400)

# ------------------------------------------------------------------ invitations des collègues
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def invitations(request):
    access = profile(request.user)
    if 'members.read' not in capabilities(request.user) or not access or not access.organization_id:
        raise PermissionDenied('Réservé aux comptes entreprise.')
    org = access.organization
    if request.method == 'GET':
        pending = org.invitations.filter(accepted_at__isnull=True, expires_at__gt=timezone.now()).order_by('-created_at')
        return Response(InvitationSerializer(pending, many=True).data)
    if 'members.invite' not in capabilities(request.user):
        raise PermissionDenied('Seul le titulaire du compte entreprise peut inviter des collègues.')
    email = request.data.get('email')
    try:
        validate_email(email)
    except (ValidationError, TypeError):
        raise ApiValidationError({'email': 'Adresse e-mail invalide.'})
    if get_user_model().objects.filter(email__iexact=email).exists():
        raise ApiValidationError({'email': 'Un compte utilise déjà cette adresse.'})
    invitation = Invitation.objects.create(organization=org, email=email, token=secrets.token_urlsafe(32), invited_by=request.user, expires_at=timezone.now() + INVITATION_VALIDITY)
    mail([email], f'Invitation à rejoindre {org.legal_name}',
         f'Bonjour,\n\n{request.user.get_username()} vous invite à rejoindre l’espace de « {org.legal_name} » sur la plateforme Label INPG.\n'
         f'Créez votre compte avec ce lien (valable 7 jours) :\n{settings.FRONTEND_URL}/invitation/{invitation.token}\n\nPlateforme Label INPG')
    return Response(InvitationSerializer(invitation).data, status=201)

def _invitation(token):
    return Invitation.objects.select_related('organization').filter(token=token, accepted_at__isnull=True, expires_at__gt=timezone.now()).first()

@require_GET
def invitation_detail(request, token):
    invitation = _invitation(token)
    if not invitation:
        return JsonResponse({'detail': 'Invitation invalide, expirée ou déjà utilisée.'}, status=404)
    return JsonResponse({'organization': invitation.organization.legal_name, 'email': invitation.email})

@require_POST
@csrf_protect
def invitation_accept(request, token):
    try:
        INVITATION_ACCEPTS.check(request)
    except Throttled as exc:
        return throttled(exc)
    INVITATION_ACCEPTS.hit(request)
    try:
        data = json.loads(request.body)
        with transaction.atomic():
            invitation = Invitation.objects.select_for_update().filter(pk=getattr(_invitation(token), 'pk', None)).first()
            if not invitation:
                return JsonResponse({'detail': 'Invitation invalide, expirée ou déjà utilisée.'}, status=404)
            clean, user = _clean_identity({**data, 'email': invitation.email})
            user.set_password(clean['password']); user.save()
            AccessProfile.objects.create(user=user, role='ENTERPRISE', organization=invitation.organization)
            invitation.accepted_at = timezone.now(); invitation.save(update_fields=['accepted_at'])
        return JsonResponse({'detail': 'Compte créé.'}, status=201)
    except ValidationError as error:
        return JsonResponse({'detail': ' '.join(error.messages)}, status=400)
    except IntegrityError:
        return JsonResponse({'detail': 'Cet identifiant est déjà utilisé.'}, status=400)
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({'detail': 'Requête invalide.'}, status=400)

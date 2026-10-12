from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password, MinimumLengthValidator, CommonPasswordValidator, NumericPasswordValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction, IntegrityError
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied
from .access import capabilities
from .models import AccessProfile

INTERNAL_ROLES = ['ADMIN', 'MANAGER', 'EVALUATOR', 'AUDITOR', 'DECISION_MAKER']

class IsSuperuser(BasePermission):
    def has_permission(self,request,view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.is_superuser)

class InternalAccountSerializer(serializers.Serializer):
    username=serializers.CharField(max_length=150)
    email=serializers.EmailField()
    password=serializers.CharField(write_only=True,max_length=4096,trim_whitespace=False)
    role=serializers.ChoiceField(choices=['ADMIN','MANAGER','EVALUATOR','AUDITOR','DECISION_MAKER'])
    def validate_username(self,value):
        try:
            get_user_model()._meta.get_field('username').run_validators(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        return value
    def validate_password(self,value):
        try:
            validate_password(value,password_validators=[MinimumLengthValidator(10),CommonPasswordValidator(),NumericPasswordValidator()])
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        return value

def _create(request):
    serializer=InternalAccountSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data=serializer.validated_data.copy()
    if get_user_model().objects.filter(email__iexact=data['email']).exists():
        return Response({'detail':'Un compte utilise déjà cette adresse e-mail.'},status=400)
    role=data.pop('role')
    try:
        with transaction.atomic():
            user=get_user_model().objects.create_user(**data,is_superuser=False,is_staff=False)
            AccessProfile.objects.create(user=user,role=role)
    except IntegrityError:
        return Response({'detail':'Identifiant déjà utilisé.'},status=400)
    return Response({'id':user.pk,'username':user.username,'role':role},status=201)


def _list(request):
    """Liste des comptes (lecture : administrateurs ; actions : superutilisateur)."""
    if 'users.manage' not in capabilities(request.user):
        raise PermissionDenied('Vous ne pouvez pas consulter les comptes.')
    users = get_user_model().objects.select_related('access_profile__organization').order_by('-is_active', 'username')
    kind = request.query_params.get('scope', 'internal')
    if kind == 'internal':
        users = users.filter(Q(is_superuser=True) | Q(access_profile__role__in=INTERNAL_ROLES))
    return Response([{'id': u.pk, 'username': u.username, 'email': u.email, 'is_active': u.is_active, 'is_superuser': u.is_superuser,
                      'role': 'ADMIN' if u.is_superuser else getattr(getattr(u, 'access_profile', None), 'role', None),
                      'organization': getattr(getattr(getattr(u, 'access_profile', None), 'organization', None), 'legal_name', None),
                      'last_login': u.last_login} for u in users])


@api_view(['POST'])
@permission_classes([IsSuperuser])
def set_account_active(request, user_id):
    target = get_user_model().objects.filter(pk=user_id).first()
    if not target:
        return Response({'detail': 'Compte introuvable.'}, status=404)
    if target.pk == request.user.pk or target.is_superuser:
        return Response({'detail': 'Un superutilisateur ne peut pas être désactivé depuis l’interface.'}, status=400)
    active = request.data.get('is_active')
    if not isinstance(active, bool):
        return Response({'detail': 'is_active (booléen) est requis.'}, status=400)
    target.is_active = active
    target.save(update_fields=['is_active'])
    return Response({'id': target.pk, 'is_active': target.is_active})


@api_view(['GET', 'POST'])
def accounts(request):
    if request.method == 'POST':
        if not IsSuperuser().has_permission(request, None):
            raise PermissionDenied('Seul un superutilisateur peut créer des comptes internes.')
        return _create(request)
    return _list(request)

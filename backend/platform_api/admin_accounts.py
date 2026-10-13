from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password, MinimumLengthValidator, CommonPasswordValidator, NumericPasswordValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction, IntegrityError
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from .models import AccessProfile

class IsSuperuser(BasePermission):
    def has_permission(self,request,view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.is_superuser)

class InternalAccountSerializer(serializers.Serializer):
    username=serializers.CharField(max_length=150)
    email=serializers.EmailField()
    password=serializers.CharField(write_only=True,max_length=4096,trim_whitespace=False)
    role=serializers.ChoiceField(choices=['MANAGER','EVALUATOR','AUDITOR','DECISION_MAKER'])
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

@api_view(['POST'])
@permission_classes([IsSuperuser])
def create_internal_account(request):
    serializer=InternalAccountSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data=serializer.validated_data.copy()
    role=data.pop('role')
    try:
        with transaction.atomic():
            user=get_user_model().objects.create_user(**data,is_superuser=False,is_staff=False)
            AccessProfile.objects.create(user=user,role=role)
    except IntegrityError:
        return Response({'detail':'Identifiant déjà utilisé.'},status=400)
    return Response({'id':user.pk,'username':user.username,'role':role},status=201)

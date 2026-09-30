import json
from types import SimpleNamespace
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth.password_validation import validate_password, MinimumLengthValidator, CommonPasswordValidator, NumericPasswordValidator, UserAttributeSimilarityValidator
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction, IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST
from .auth_views import LoginThrottle
from .models import AccessProfile, Organization

@require_POST
@csrf_protect
def register(request):
    if not LoginThrottle().allow_request(SimpleNamespace(user=AnonymousUser(),META=request.META),None):
        return JsonResponse({'detail':'Trop de tentatives. Réessayez plus tard.'},status=429)
    if request.user.is_authenticated:
        return JsonResponse({'detail':'Déconnectez-vous avant de créer un autre compte.'},status=400)
    try:
        data=json.loads(request.body)
        if not isinstance(data,dict) or data.get('kind') not in ['ENTERPRISE','PROFESSIONAL']:
            raise ValidationError('Choisissez Entreprise ou Professionnel.')
        clean={}
        limits={'username':150,'email':254,'first_name':150,'last_name':150,'password':4096}
        if data['kind']=='ENTERPRISE':
            limits.update(legal_name=255,ninea=64)
        for key,maximum in limits.items():
            value=data.get(key)
            if not isinstance(value,str) or not value.strip() or len(value)>maximum:
                raise ValidationError('Les champs obligatoires doivent être valides et renseignés.')
            clean[key]=value if key=='password' else value.strip()
        validate_email(clean['email'])
        User=get_user_model()
        User._meta.get_field('username').run_validators(clean['username'])
        user=User(username=clean['username'],email=clean['email'],first_name=clean['first_name'],last_name=clean['last_name'])
        validate_password(clean['password'],user,password_validators=[MinimumLengthValidator(10),CommonPasswordValidator(),NumericPasswordValidator(),UserAttributeSimilarityValidator()])
        with transaction.atomic():
            user.set_password(clean['password'])
            user.save()
            organization=None
            if data['kind']=='ENTERPRISE':
                # Never attach a public signup to an existing organization by NINEA.
                organization=Organization.objects.create(legal_name=clean['legal_name'],ninea=clean['ninea'],activity='',address='')
            AccessProfile.objects.create(user=user,role=data['kind'],organization=organization)
        return JsonResponse({'detail':'Compte créé.'},status=201)
    except ValidationError as error:
        return JsonResponse({'detail':' '.join(error.messages)},status=400)
    except IntegrityError:
        return JsonResponse({'detail':'Cet identifiant ou cette entreprise est déjà enregistré. Contactez l’administrateur pour un rattachement.'},status=400)
    except (ValueError,TypeError):
        return JsonResponse({'detail':'Requête invalide.'},status=400)

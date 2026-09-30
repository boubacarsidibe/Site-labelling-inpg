import json
from types import SimpleNamespace
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import AnonymousUser
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework.throttling import AnonRateThrottle
from .access import role, capabilities, profile

class LoginThrottle(AnonRateThrottle):
    rate='10/min'

def identity(user):
    access=profile(user)
    return {'id':user.pk,'username':user.get_username(),'role':role(user),'capabilities':capabilities(user),'is_superuser':user.is_superuser,'organization_id':access.organization_id if access else None}

@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'detail':'CSRF prêt.'})

@require_GET
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail':'Authentification requise.'},status=401)
    return JsonResponse(identity(request.user))

@require_POST
@csrf_protect
def sign_in(request):
    if not LoginThrottle().allow_request(SimpleNamespace(user=AnonymousUser(),META=request.META),None):
        return JsonResponse({'detail':'Trop de tentatives. Réessayez plus tard.'},status=429)
    try:
        data=json.loads(request.body)
        username=data.get('username'); password=data.get('password')
        if not isinstance(username,str) or not isinstance(password,str) or len(username)>150 or len(password)>4096:
            raise ValueError()
    except (ValueError,AttributeError):
        return JsonResponse({'detail':'Requête invalide.'},status=400)
    user=authenticate(request,username=username,password=password)
    if user is None:
        return JsonResponse({'detail':'Identifiants incorrects.'},status=401)
    login(request,user)
    return JsonResponse(identity(user))

@require_POST
@csrf_protect
def sign_out(request):
    logout(request)
    return JsonResponse({'detail':'Déconnecté.'})

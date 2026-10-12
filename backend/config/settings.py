from pathlib import Path
import os
import dj_database_url
from django.core.exceptions import ImproperlyConfigured
BASE_DIR = Path(__file__).resolve().parent.parent
env = os.environ.get
# Le mode debug doit être demandé explicitement (DJANGO_DEBUG=1) : un déploiement sans variables reste en production.
DEBUG = env('DJANGO_DEBUG','0') == '1'
SECRET_KEY = env('DJANGO_SECRET_KEY','local-development-only-not-for-deployment')
if not DEBUG and SECRET_KEY == 'local-development-only-not-for-deployment':
    raise ImproperlyConfigured('DJANGO_SECRET_KEY est obligatoire en production (ou DJANGO_DEBUG=1 en développement).')
ALLOWED_HOSTS = env('DJANGO_ALLOWED_HOSTS','127.0.0.1,localhost').split(',')
INSTALLED_APPS = ['django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','rest_framework','platform_api']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
TEMPLATES = []
WSGI_APPLICATION = 'config.wsgi.application'

# Base de données : SQLite par défaut (développement), PostgreSQL via DATABASE_URL (production).
# SQLite n'accepte qu'un écrivain : les transactions IMMEDIATE sérialisent les actions concurrentes au lieu d'échouer.
if env('DATABASE_URL'):
    DATABASES = {'default': dj_database_url.parse(env('DATABASE_URL'), conn_max_age=60)}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3', 'OPTIONS': {'transaction_mode': 'IMMEDIATE', 'timeout': 20}}}

# Cache partagé entre processus (compteurs anti-force-brute) : Redis si DJANGO_REDIS_URL est défini.
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': env('DJANGO_REDIS_URL')}} if env('DJANGO_REDIS_URL') else {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

LANGUAGE_CODE = 'fr-fr'; TIME_ZONE = 'Africa/Dakar'; USE_I18N = True; USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# Les pièces déposées ne sont jamais servies publiquement : téléchargement uniquement via l'API (contrôle des droits).
MEDIA_ROOT = Path(env('DJANGO_MEDIA_ROOT', BASE_DIR / 'media'))
MAX_UPLOAD_SIZE = 10 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE + 1024 * 1024

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    # Nombre de proxys de confiance devant l'application (Nginx = 1) : l'IP réelle est lue dans X-Forwarded-For.
    'NUM_PROXIES': int(env('DJANGO_NUM_PROXIES')) if env('DJANGO_NUM_PROXIES') else None,
}

# Adresse de l'interface, utilisée dans les liens des e-mails.
FRONTEND_URL = env('FRONTEND_URL', 'http://127.0.0.1:4200').rstrip('/')
DEFAULT_FROM_EMAIL = env('DJANGO_DEFAULT_FROM_EMAIL', 'Label INPG <no-reply@inpg.sn>')
if env('EMAIL_HOST'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = env('EMAIL_HOST'); EMAIL_PORT = int(env('EMAIL_PORT', '587'))
    EMAIL_HOST_USER = env('EMAIL_HOST_USER', ''); EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', '')
    EMAIL_USE_TLS = env('EMAIL_USE_TLS', '1') == '1'
else:
    # Sans serveur SMTP, les e-mails sont affichés dans la console du serveur.
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
PASSWORD_RESET_TIMEOUT = 60 * 60 * 24

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_TRUSTED_ORIGINS = env('DJANGO_CSRF_TRUSTED_ORIGINS','http://127.0.0.1:4200,http://localhost:4200' if DEBUG else '').split(',') if DEBUG or env('DJANGO_CSRF_TRUSTED_ORIGINS') else []
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
if not DEBUG:
    SECURE_HSTS_SECONDS = int(env('DJANGO_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_SSL_REDIRECT = env('DJANGO_SSL_REDIRECT', '1') == '1'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

LOGGING = {
    'version': 1, 'disable_existing_loggers': False,
    'formatters': {'plain': {'format': '%(asctime)s %(levelname)s %(name)s %(message)s'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'plain'}},
    'loggers': {'django.request': {'handlers': ['console'], 'level': 'WARNING'},
                'platform_api': {'handlers': ['console'], 'level': env('DJANGO_LOG_LEVEL', 'INFO')}},
}

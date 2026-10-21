from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from platform_api.models import AccessProfile, Organization

PASSWORD='Demo-Label2026!'

class Command(BaseCommand):
    help='Crée un compte par rôle (mot de passe commun) pour essayer la plateforme en développement.'
    @transaction.atomic
    def handle(self,*args,**options):
        if not settings.DEBUG:
            raise CommandError('Commande réservée au développement (DJANGO_DEBUG=1).')
        User=get_user_model()
        org,_=Organization.objects.get_or_create(ninea='009876543',defaults={'legal_name':'Sénégal Pétrole Distribution','activity':'Distribution','verified_at':timezone.now()})
        accounts=[('admin','ADMIN',None,False,True),('entreprise','ENTERPRISE',org,True,False),('gestionnaire','MANAGER',None,False,False),
                  ('evaluateur','EVALUATOR',None,False,False),('auditeur','AUDITOR',None,False,False),('decideur','DECISION_MAKER',None,False,False)]
        for name,role,organization,owner,superuser in accounts:
            user,_=User.objects.get_or_create(username=name,defaults={'email':f'{name}@demo.sn'})
            user.set_password(PASSWORD); user.is_staff=superuser; user.is_superuser=superuser; user.save()
            if not superuser:
                AccessProfile.objects.update_or_create(user=user,defaults={'role':role,'organization':organization,'is_owner':owner})
            self.stdout.write(f'{name:13} {role}')
        self.stdout.write(self.style.SUCCESS(f'Comptes prêts. Mot de passe : {PASSWORD}'))

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from platform_api.models import AccessProfile, Organization, ApplicationAssignment
from django.db import transaction

class Command(BaseCommand):
    help='Attribuer un rôle à un compte existant depuis le serveur.'
    def add_arguments(self,parser):
        parser.add_argument('username')
        parser.add_argument('role',choices=AccessProfile.Role.values)
        parser.add_argument('--organization',type=int)
    @transaction.atomic
    def handle(self,*args,**options):
        if options['role'] not in ['ENTERPRISE','PROFESSIONAL']:
            raise CommandError('Les comptes internes doivent être créés par un superutilisateur via /api/v1/admin/accounts/.')
        user=get_user_model().objects.filter(username=options['username']).first()
        if not user:
            raise CommandError('Compte introuvable.')
        if user.is_superuser:
            raise CommandError('Un superutilisateur dispose déjà de tous les droits. Utilisez un compte métier non superutilisateur.')
        organization=options['organization']
        if options['role']=='ENTERPRISE':
            if not organization or not Organization.objects.filter(pk=organization).exists():
                raise CommandError('--organization doit désigner une entreprise existante.')
        elif organization:
            raise CommandError('--organization est réservé au rôle ENTERPRISE.')
        AccessProfile.objects.update_or_create(user=user,defaults={'role':options['role'],'organization_id':organization})
        ApplicationAssignment.objects.filter(user=user).delete()
        self.stdout.write(self.style.SUCCESS('Rôle attribué ; anciennes affectations supprimées.'))

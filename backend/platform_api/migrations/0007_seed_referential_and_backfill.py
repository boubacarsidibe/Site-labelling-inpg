from datetime import timedelta
from django.db import migrations
from django.utils import timezone

COMMON = {
    'Sécurité': ['Politique HSE signée', 'Plan de prévention des risques', 'Rapport d’audit interne'],
    'Qualité': ['Politique qualité', 'Procédure de contrôle', 'Registre des non-conformités'],
    'Environnement': ['Plan de gestion environnementale', 'Suivi des déchets', 'Plan d’urgence environnemental'],
}
# Pièces propres à une activité (reprises de l'ancienne checklist de l'interface), rattachées au volet Sécurité.
BY_ACTIVITY = {
    'Distribution': 'Autorisation réglementaire de distribution',
    'Transport': 'Attestation transport de matières dangereuses',
    'Laboratoire': 'Certificat ISO/IEC 17025',
    'Stockage': 'Étude de dangers du site',
    'Raffinage': 'Plan de maîtrise des procédés',
    'Prestataire technique': 'Attestation d’habilitation technique',
}
LEVELS = {1: 'Standard', 2: 'Gold', 3: 'Platinum'}


def forwards(apps, schema_editor):
    Template = apps.get_model('platform_api', 'RequirementTemplate')
    for domain, names in COMMON.items():
        for i, name in enumerate(names):
            Template.objects.get_or_create(domain=domain, activity='', name=name, defaults={'order': i})
    for activity, name in BY_ACTIVITY.items():
        Template.objects.get_or_create(domain='Sécurité', activity=activity, name=name, defaults={'order': 10})

    Certificate = apps.get_model('platform_api', 'Certificate')
    for cert in Certificate.objects.select_related('application'):
        cert.level = cert.level or cert.application.level
        cert.domains = cert.domains or cert.application.domains
        cert.expires_at = cert.expires_at or cert.issued_at + timedelta(days=365)
        cert.save(update_fields=['level', 'domains', 'expires_at'])

    # Les organisations existantes ont été créées avant la vérification : elles sont considérées comme vérifiées.
    Organization = apps.get_model('platform_api', 'Organization')
    Organization.objects.filter(verified_at__isnull=True).update(verified_at=timezone.now())

    # Le premier compte entreprise de chaque organisation en devient le titulaire.
    Profile = apps.get_model('platform_api', 'AccessProfile')
    seen = set()
    for profile in Profile.objects.filter(role='ENTERPRISE', organization__isnull=False).order_by('id'):
        if profile.organization_id not in seen:
            seen.add(profile.organization_id)
            Profile.objects.filter(pk=profile.pk).update(is_owner=True)


class Migration(migrations.Migration):
    dependencies = [('platform_api', '0006_audit_corrections')]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]

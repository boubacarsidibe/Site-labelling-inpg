from django.db import migrations, models


def backfill_certificate_expiry(apps, schema_editor):
    Certificate = apps.get_model('platform_api', 'Certificate')
    for certificate in Certificate.objects.filter(expires_at__isnull=True).iterator():
        issued_at = certificate.issued_at
        try:
            expires_at = issued_at.replace(year=issued_at.year + 3)
        except ValueError:
            expires_at = issued_at.replace(year=issued_at.year + 3, day=28)
        Certificate.objects.filter(pk=certificate.pk).update(expires_at=expires_at)


class Migration(migrations.Migration):
    dependencies = [('platform_api', '0012_certificate_expires_at')]

    operations = [
        migrations.RunPython(backfill_certificate_expiry, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='application',
            name='activity',
            field=models.CharField(
                choices=[
                    ('Raffinage', 'Raffinage'),
                    ('Transport', 'Transport'),
                    ('Stockage', 'Stockage'),
                    ('Distribution', 'Distribution'),
                    ('Laboratoire', 'Laboratoire'),
                    ('Prestataire technique', 'Prestataire technique'),
                ],
                default='Distribution',
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name='application',
            name='level',
            field=models.CharField(
                choices=[('Standard', 'Standard'), ('Gold', 'Gold'), ('Platinum', 'Platinum')],
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name='certificate',
            name='status',
            field=models.CharField(
                choices=[('VALID', 'Valide'), ('SUSPENDED', 'Suspendu'), ('REVOKED', 'Révoqué')],
                default='VALID',
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name='nonconformity',
            name='severity',
            field=models.CharField(
                choices=[('MINEURE', 'Mineure'), ('MAJEURE', 'Majeure'), ('CRITIQUE', 'Critique')],
                default='MAJEURE',
                max_length=16,
            ),
        ),
    ]

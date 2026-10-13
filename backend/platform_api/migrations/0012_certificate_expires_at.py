from django.db import migrations, models
class Migration(migrations.Migration):
    dependencies=[('platform_api','0011_notification')]
    operations=[migrations.AddField(model_name='certificate',name='expires_at',field=models.DateTimeField(blank=True,null=True))]

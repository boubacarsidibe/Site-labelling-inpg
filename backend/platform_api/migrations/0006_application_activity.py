from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies=[('platform_api','0005_application_description_application_scope')]
    operations=[migrations.AddField(model_name='application',name='activity',field=models.CharField(default='Distribution',max_length=32))]

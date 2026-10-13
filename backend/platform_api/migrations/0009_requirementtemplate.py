from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies=[('platform_api','0008_training_trainingenrollment')]
    operations=[migrations.CreateModel(name='RequirementTemplate',fields=[
        ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
        ('domain',models.CharField(max_length=32)),('activity',models.CharField(blank=True,max_length=32)),
        ('name',models.CharField(max_length=255)),('mandatory',models.BooleanField(default=True)),
        ('active',models.BooleanField(default=True)),('version',models.CharField(default='1.0',max_length=16)),
        ('created_at',models.DateTimeField(auto_now_add=True)),
    ])]

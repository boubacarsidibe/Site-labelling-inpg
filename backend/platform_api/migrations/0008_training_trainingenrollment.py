from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies=[('platform_api','0007_application_request_type')]
    operations=[
        migrations.CreateModel(name='Training',fields=[
            ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
            ('title',models.CharField(max_length=255)),('description',models.TextField()),
            ('duration_days',models.PositiveSmallIntegerField(default=1)),
            ('format',models.CharField(choices=[('IN_PERSON','Présentiel'),('ONLINE','En ligne'),('HYBRID','Hybride')],default='IN_PERSON',max_length=16)),
            ('starts_at',models.DateTimeField(blank=True,null=True)),('capacity',models.PositiveIntegerField(default=20)),
            ('active',models.BooleanField(default=True)),('created_at',models.DateTimeField(auto_now_add=True)),
        ]),
        migrations.CreateModel(name='TrainingEnrollment',fields=[
            ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
            ('status',models.CharField(choices=[('REQUESTED','Demande envoyée'),('CONFIRMED','Confirmée'),('COMPLETED','Terminée'),('CANCELLED','Annulée')],default='REQUESTED',max_length=16)),
            ('enrolled_at',models.DateTimeField(auto_now_add=True)),
            ('organization',models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.SET_NULL,related_name='training_enrollments',to='platform_api.organization')),
            ('training',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='enrollments',to='platform_api.training')),
            ('user',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='training_enrollments',to=settings.AUTH_USER_MODEL)),
        ]),
        migrations.AddConstraint(model_name='trainingenrollment',constraint=models.UniqueConstraint(fields=('training','user'),name='unique_training_enrollment')),
    ]

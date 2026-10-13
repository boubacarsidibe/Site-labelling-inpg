from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
    dependencies=[('platform_api','0009_requirementtemplate')]
    operations=[migrations.CreateModel(name='ApplicationMessage',fields=[
        ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
        ('body',models.TextField()),('created_at',models.DateTimeField(auto_now_add=True)),
        ('application',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='messages',to='platform_api.application')),
        ('author',models.ForeignKey(null=True,on_delete=django.db.models.deletion.SET_NULL,to=settings.AUTH_USER_MODEL)),
    ],options={'ordering':['created_at','id']})]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
    dependencies=[('platform_api','0010_applicationmessage')]
    operations=[migrations.CreateModel(name='Notification',fields=[
        ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
        ('title',models.CharField(max_length=160)),('body',models.TextField(blank=True)),('url',models.CharField(blank=True,max_length=255)),
        ('read_at',models.DateTimeField(blank=True,null=True)),('created_at',models.DateTimeField(auto_now_add=True)),
        ('user',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='notifications',to=settings.AUTH_USER_MODEL)),
    ],options={'ordering':['-created_at','-id']})]

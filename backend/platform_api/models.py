from django.db import models
from django.conf import settings

class AccessProfile(models.Model):
    class Role(models.TextChoices):
        ENTERPRISE='ENTERPRISE','Entreprise'
        PROFESSIONAL='PROFESSIONAL','Professionnel'
        MANAGER='MANAGER','Gestionnaire'
        EVALUATOR='EVALUATOR','Évaluateur'
        AUDITOR='AUDITOR','Auditeur'
        DECISION_MAKER='DECISION_MAKER','Décideur'
        ADMIN='ADMIN','Administrateur'
    user=models.OneToOneField(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='access_profile')
    role=models.CharField(max_length=24,choices=Role.choices)
    organization=models.ForeignKey('Organization',null=True,blank=True,on_delete=models.PROTECT)

class ApplicationAssignment(models.Model):
    application=models.ForeignKey('Application',on_delete=models.CASCADE,related_name='assignments')
    user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['application','user'],name='unique_application_assignee')]
class Organization(models.Model):
    legal_name=models.CharField(max_length=255); ninea=models.CharField(max_length=64, unique=True); activity=models.CharField(max_length=32); address=models.CharField(max_length=255)
class Application(models.Model):
    class Status(models.TextChoices):
        DRAFT='DRAFT','Brouillon'
        SUBMITTED='SUBMITTED','Soumis'
        UNDER_REVIEW='UNDER_REVIEW','En évaluation'
        CORRECTION_REQUIRED='CORRECTION_REQUIRED','Corrections demandées'
        DECISION_PENDING='DECISION_PENDING','En décision'
        CERTIFIED='CERTIFIED','Certifié'
        REJECTED='REJECTED','Refusé'
    organization=models.ForeignKey(Organization,on_delete=models.PROTECT,related_name='applications'); reference=models.CharField(max_length=32,unique=True); level=models.CharField(max_length=16); status=models.CharField(max_length=24,choices=Status.choices,default=Status.DRAFT); domains=models.JSONField(default=list); scope=models.CharField(max_length=500,blank=True); description=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True)
class RequiredDocument(models.Model):
    class Status(models.TextChoices):
        MISSING='MISSING','Non déposé'
        SUBMITTED='SUBMITTED','Déposé'
        VALIDATED='VALIDATED','Validé'
        REJECTED='REJECTED','À corriger'
    application=models.ForeignKey(Application,on_delete=models.CASCADE,related_name='documents')
    domain=models.CharField(max_length=32)
    name=models.CharField(max_length=255)
    mandatory=models.BooleanField(default=True)
    status=models.CharField(max_length=24,choices=Status.choices,default=Status.MISSING)
    file=models.FileField(upload_to='documents/%Y/%m/',null=True,blank=True)
    review_comment=models.TextField(blank=True)
    submitted_at=models.DateTimeField(null=True,blank=True)
    reviewed_at=models.DateTimeField(null=True,blank=True)

class WorkflowEvent(models.Model):
    application=models.ForeignKey(Application,on_delete=models.CASCADE,related_name='events')
    actor=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.SET_NULL,null=True,blank=True)
    event_type=models.CharField(max_length=48)
    note=models.TextField(blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering=['-created_at','-id']

class Audit(models.Model):
    class Status(models.TextChoices): SCHEDULED='SCHEDULED','Planifié'; COMPLETED='COMPLETED','Réalisé'
    application=models.ForeignKey(Application,on_delete=models.CASCADE,related_name='audits')
    auditor=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='audits')
    scheduled_for=models.DateTimeField(null=True,blank=True)
    performed_at=models.DateTimeField(null=True,blank=True)
    status=models.CharField(max_length=16,choices=Status.choices,default=Status.SCHEDULED)
    summary=models.TextField(blank=True)

class NonConformity(models.Model):
    class Status(models.TextChoices): OPEN='OPEN','Ouverte'; CORRECTED='CORRECTED','Corrigée'; VALIDATED='VALIDATED','Clôturée'
    application=models.ForeignKey(Application,on_delete=models.CASCADE,related_name='non_conformities')
    reference=models.CharField(max_length=32)
    domain=models.CharField(max_length=32)
    description=models.TextField()
    severity=models.CharField(max_length=16,default='MAJEURE')
    status=models.CharField(max_length=16,choices=Status.choices,default=Status.OPEN)
    response=models.TextField(blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['application','reference'],name='unique_nonconformity_reference')]

class Certificate(models.Model):
    application=models.OneToOneField(Application,on_delete=models.PROTECT,related_name='certificate')
    number=models.CharField(max_length=48,unique=True)
    issued_at=models.DateTimeField(auto_now_add=True)
    status=models.CharField(max_length=16,default='VALID')

from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone

DOMAINS=['Sécurité','Qualité','Environnement']
ACTIVITIES=['Raffinage','Transport','Stockage','Distribution','Laboratoire','Prestataire technique']
LEVELS={1:'Standard',2:'Gold',3:'Platinum'}
CERTIFICATE_VALIDITY=timedelta(days=365)

def level_for(domains):
    """Le niveau du Label dépend uniquement du nombre de volets : 1 Standard, 2 Gold, 3 Platinum."""
    return LEVELS.get(len(set(domains)),'')

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
    organization=models.ForeignKey('Organization',null=True,blank=True,on_delete=models.PROTECT,related_name='members')
    is_owner=models.BooleanField(default=False,help_text='Titulaire du compte entreprise : peut inviter ses collègues.')

class ApplicationAssignment(models.Model):
    application=models.ForeignKey('Application',on_delete=models.CASCADE,related_name='assignments')
    user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['application','user'],name='unique_application_assignee')]

class Organization(models.Model):
    legal_name=models.CharField(max_length=255); ninea=models.CharField(max_length=64, unique=True); activity=models.CharField(max_length=32,blank=True); address=models.CharField(max_length=255,blank=True)
    verified_at=models.DateTimeField(null=True,blank=True)
    verified_by=models.ForeignKey(settings.AUTH_USER_MODEL,null=True,blank=True,on_delete=models.SET_NULL,related_name='+')
    @property
    def is_verified(self): return self.verified_at is not None

class Application(models.Model):
    class Status(models.TextChoices):
        DRAFT='DRAFT','Brouillon'
        SUBMITTED='SUBMITTED','Soumis'
        UNDER_REVIEW='UNDER_REVIEW','En évaluation'
        CORRECTION_REQUIRED='CORRECTION_REQUIRED','Corrections demandées'
        DECISION_PENDING='DECISION_PENDING','En décision'
        CERTIFIED='CERTIFIED','Certifié'
        REJECTED='REJECTED','Refusé'
    class Kind(models.TextChoices):
        INITIAL='INITIAL','Certification initiale'
        RENEWAL='RENEWAL','Renouvellement'
    organization=models.ForeignKey(Organization,on_delete=models.PROTECT,related_name='applications'); reference=models.CharField(max_length=32,unique=True); level=models.CharField(max_length=16); status=models.CharField(max_length=24,choices=Status.choices,default=Status.DRAFT); domains=models.JSONField(default=list); scope=models.CharField(max_length=500,blank=True); description=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True)
    kind=models.CharField(max_length=16,choices=Kind.choices,default=Kind.INITIAL)
    activity=models.CharField(max_length=32,blank=True)
    renewal_of=models.ForeignKey('Certificate',null=True,blank=True,on_delete=models.SET_NULL,related_name='renewals')
    previous_application=models.ForeignKey('self',null=True,blank=True,on_delete=models.SET_NULL,related_name='follow_ups')
    decision_note=models.TextField(blank=True)
    updated_at=models.DateTimeField(auto_now=True)

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

class RequirementTemplate(models.Model):
    """Référentiel : pièce attendue pour un volet, éventuellement limitée à une activité."""
    domain=models.CharField(max_length=32)
    activity=models.CharField(max_length=32,blank=True,help_text='Vide : toutes les activités.')
    name=models.CharField(max_length=255)
    mandatory=models.BooleanField(default=True)
    active=models.BooleanField(default=True)
    order=models.PositiveIntegerField(default=0)
    class Meta:
        ordering=['domain','order','id']

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
    class Severity(models.TextChoices): MINOR='MINEURE','Mineure'; MAJOR='MAJEURE','Majeure'; CRITICAL='CRITIQUE','Critique'
    application=models.ForeignKey(Application,on_delete=models.CASCADE,related_name='non_conformities')
    reference=models.CharField(max_length=32)
    domain=models.CharField(max_length=32)
    description=models.TextField()
    severity=models.CharField(max_length=16,choices=Severity.choices,default=Severity.MAJOR)
    status=models.CharField(max_length=16,choices=Status.choices,default=Status.OPEN)
    response=models.TextField(blank=True)
    rejection_reason=models.TextField(blank=True)
    due_date=models.DateField(null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['application','reference'],name='unique_nonconformity_reference')]

class Certificate(models.Model):
    class Status(models.TextChoices): VALID='VALID','Valide'; SUSPENDED='SUSPENDED','Suspendu'; REVOKED='REVOKED','Révoqué'
    application=models.OneToOneField(Application,on_delete=models.PROTECT,related_name='certificate')
    number=models.CharField(max_length=48,unique=True)
    issued_at=models.DateTimeField(auto_now_add=True)
    expires_at=models.DateTimeField(null=True,blank=True)
    level=models.CharField(max_length=16,blank=True)
    domains=models.JSONField(default=list)
    status=models.CharField(max_length=16,choices=Status.choices,default=Status.VALID)
    @property
    def effective_status(self):
        """Statut affiché : un certificat valide dont la date est dépassée est « Expiré »."""
        if self.status==self.Status.VALID and self.expires_at and self.expires_at<=timezone.now():
            return 'EXPIRED'
        return self.status

class Invitation(models.Model):
    organization=models.ForeignKey(Organization,on_delete=models.CASCADE,related_name='invitations')
    email=models.EmailField()
    token=models.CharField(max_length=64,unique=True)
    invited_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='+')
    created_at=models.DateTimeField(auto_now_add=True)
    expires_at=models.DateTimeField()
    accepted_at=models.DateTimeField(null=True,blank=True)

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { ActorType, ReferentialService } from '../../core/services/referential.service';
import { Domain } from '../../core/models/platform.models';
import { AuthService } from '../../core/services/auth.service';

@Component({standalone:true,imports:[FormsModule,RouterLink,IconComponent],templateUrl:'./certification-form-v2.html',styleUrl:'./certification-form-v2.css'})
export class CertificationFormComponent {
  private auth=inject(AuthService); private http=inject(HttpClient); private router=inject(Router);
  private readonly referential=inject(ReferentialService);
  readonly actors:ActorType[]=['Raffinage','Transport','Stockage','Distribution','Laboratoire','Prestataire technique'];
  readonly steps=['Demande','Dossier','Évaluation','Correction','Décision','Certification','Suivi'];
  readonly domains:Domain[]=['Sécurité','Qualité','Environnement'];
  actor:ActorType='Distribution'; selected:Domain[]=[]; type='Certification initiale'; scope=''; description=''; message='';
  busy=false;
  get documents(){return this.selected.length?this.referential.checklist(this.actor,this.selected):[];}
  get level(){return ['À définir','Standard','Gold','Platinum'][this.selected.length];}
  toggle(domain:Domain){this.selected=this.selected.includes(domain)?this.selected.filter(d=>d!==domain):[...this.selected,domain];this.message='';}
  async save(){if(this.busy)return;if(!this.selected.length){this.message='Choisissez au moins un volet.';return;}const organization=this.auth.user()?.organization_id;if(!organization){this.message='Votre compte n’est pas rattaché à une entreprise.';return;}this.busy=true;this.message='';try{const created=await firstValueFrom(this.http.post<{id:number}>('/api/v1/applications/',{organization,request_type:this.type==='Renouvellement'?'RENEWAL':'INITIAL',activity:this.actor,level:this.level,domains:this.selected,scope:this.scope,description:this.description}));await this.router.navigate(['/espace/dossiers',created.id,'documents']);}catch(error:any){this.message=this.apiError(error);}finally{this.busy=false;}}
  private apiError(error:any){const body=error?.error;if(typeof body?.detail==='string')return body.detail;if(body&&typeof body==='object'){const details=Object.entries(body).flatMap(([field,value])=>Array.isArray(value)?value.map(item=>`${field} : ${item}`):[`${field} : ${value}`]);if(details.length)return details.join(' · ');}return error?.status===403?'Votre session a expiré. Reconnectez-vous puis réessayez.':'Création de la demande impossible. Réessayez ou contactez l’INPG.';}
}

type TrackingAudit={auditor_name:string;status:string;scheduled_for:string|null};
type TrackingCertificate={number:string;issued_at:string;status:string;is_active:boolean};
type TrackingMessage={id:number;author_name:string;body:string;created_at:string};
type TrackingApplication={id:number;reference:string;level:string;domains:string[];scope:string;status:string;certification_status:string|null;has_active_certificate:boolean;created_at:string;audits:TrackingAudit[];messages:TrackingMessage[];certificate?:TrackingCertificate};
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent],templateUrl:'./workflow-tracking-v2.component.html',styleUrl:'./certification-pages.css'})
export class CertificationTrackingComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient); id=Number(this.route.snapshot.paramMap.get('id')); application?:TrackingApplication; loading=true; error=''; messageBody=''; sending=false;
  async ngOnInit(){try{this.application=await firstValueFrom(this.http.get<TrackingApplication>(`/api/v1/applications/${this.id}/`));}catch(error:any){this.error=error.error?.detail||'Dossier introuvable ou non autorisé.';}finally{this.loading=false;}}
  readonly steps=[{name:'Demande',text:'Définir le périmètre et les volets de certification.'},{name:'Dossier',text:'Rassembler et déposer les pièces justificatives.'},{name:'Évaluation',text:'Analyse documentaire et audit de conformité.'},{name:'Correction',text:'Traiter les écarts et transmettre les preuves.'},{name:'Décision',text:'Examen du dossier par l’INPG.'},{name:'Certification',text:'Émission du certificat après décision favorable.'},{name:'Suivi',text:'Contrôles et renouvellement de la certification.'}];
  get stage(){const value=this.application?.status||'DRAFT';return ({DRAFT:1,SUBMITTED:2,UNDER_REVIEW:3,CORRECTION_REQUIRED:4,DECISION_PENDING:5,CERTIFIED:7,REJECTED:5} as Record<string,number>)[value]||1;}
  stepStatus(index:number){if(this.application?.status==='CERTIFIED'&&index===7)return this.application.has_active_certificate?'Suivi actif':'Label non actif';if(this.application?.status==='REJECTED'){if(index<5)return 'Terminé';if(index===5)return 'Refusé';return 'Non applicable';}return index<this.stage?'Terminé':index===this.stage?'En cours':'À venir';}
  async sendMessage(){if(!this.messageBody.trim()||this.sending)return;this.sending=true;this.error='';try{await firstValueFrom(this.http.post('/api/v1/application-messages/',{application:this.id,body:this.messageBody.trim()}));this.messageBody='';await this.ngOnInit();}catch(error:any){this.error=error.error?.body?.[0]||error.error?.detail||'Message impossible à envoyer.';}finally{this.sending=false;}}
  statusLabel(value:string){return ({DRAFT:'Brouillon',SUBMITTED:'Soumis',UNDER_REVIEW:'En évaluation',CORRECTION_REQUIRED:'Corrections demandées',DECISION_PENDING:'En décision',CERTIFIED:'Certifié',REJECTED:'Refusé',SCHEDULED:'Planifié',COMPLETED:'Réalisé'} as Record<string,string>)[value]||value;}
  applicationStatusLabel(){if(this.application?.status==='CERTIFIED'&&!this.application.has_active_certificate)return ({SUSPENDED:'Certification suspendue',REVOKED:'Certification révoquée',EXPIRED:'Certification expirée'} as Record<string,string>)[this.application.certification_status||'']||'Certification non active';return this.statusLabel(this.application?.status||'');}
}

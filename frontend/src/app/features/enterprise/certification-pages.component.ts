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

@Component({standalone:true,imports:[FormsModule,RouterLink,IconComponent],templateUrl:'./certification-form.html',styleUrl:'./certification-pages.css'})
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
  async save(){if(this.busy)return;if(!this.selected.length){this.message='Choisissez au moins un volet.';return;}const organization=this.auth.user()?.organization_id;if(!organization){this.message='Votre compte n’est pas rattaché à une entreprise.';return;}this.busy=true;this.message='';try{const created=await firstValueFrom(this.http.post<{id:number}>('/api/v1/applications/',{organization,level:this.level,domains:this.selected,scope:this.scope,description:this.description}));await this.router.navigate(['/espace/dossiers',created.id,'documents']);}catch(error:any){this.message=error.error?.detail||'Création du brouillon impossible.';}finally{this.busy=false;}}
}

type TrackingAudit={auditor_name:string;status:string;scheduled_for:string|null};
type TrackingCertificate={number:string;issued_at:string;status:string};
type TrackingApplication={id:number;reference:string;level:string;domains:string[];scope:string;status:string;created_at:string;audits:TrackingAudit[];certificate?:TrackingCertificate};
@Component({standalone:true,imports:[CommonModule,RouterLink,IconComponent],templateUrl:'./workflow-tracking.component.html',styleUrl:'./certification-pages.css'})
export class CertificationTrackingComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient); id=Number(this.route.snapshot.paramMap.get('id')); application?:TrackingApplication; loading=true; error='';
  async ngOnInit(){try{this.application=await firstValueFrom(this.http.get<TrackingApplication>(`/api/v1/applications/${this.id}/`));}catch(error:any){this.error=error.error?.detail||'Dossier introuvable ou non autorisé.';}finally{this.loading=false;}}
  readonly steps=[{name:'Demande',text:'Définir le périmètre et les volets de certification.'},{name:'Dossier',text:'Rassembler et déposer les pièces justificatives.'},{name:'Évaluation',text:'Analyse documentaire et audit de conformité.'},{name:'Correction',text:'Traiter les écarts et transmettre les preuves.'},{name:'Décision',text:'Examen du dossier par l’INPG.'},{name:'Certification',text:'Émission du certificat après décision favorable.'},{name:'Suivi',text:'Contrôles et renouvellement de la certification.'}];
  get stage(){const value=this.application?.status||'DRAFT';return ({DRAFT:1,SUBMITTED:2,UNDER_REVIEW:3,CORRECTION_REQUIRED:4,DECISION_PENDING:5,CERTIFIED:6,REJECTED:5} as Record<string,number>)[value]||1;}
  statusLabel(value:string){return ({DRAFT:'Brouillon',SUBMITTED:'Soumis',UNDER_REVIEW:'En évaluation',CORRECTION_REQUIRED:'Corrections demandées',DECISION_PENDING:'En décision',CERTIFIED:'Certifié',REJECTED:'Refusé',SCHEDULED:'Planifié',COMPLETED:'Réalisé'} as Record<string,string>)[value]||value;}
}

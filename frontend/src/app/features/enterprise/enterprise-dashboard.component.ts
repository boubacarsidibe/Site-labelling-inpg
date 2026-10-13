import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { DatePipe } from '@angular/common';

type Document={id:number;name:string;status:string;domain:string};
type Audit={id:number;status:string;scheduled_for:string|null;auditor_name:string};
type NonConformity={id:number;reference:string;status:string;description:string};
type Application={id:number;reference:string;request_type:string;level:string;activity:string;status:string;certification_status:string|null;has_active_certificate:boolean;domains:string[];created_at:string;documents:Document[];audits:Audit[];non_conformities:NonConformity[];certificate?:{number:string;status:string;is_active:boolean}};
type DashboardAction={label:string;detail:string;icon:string;route:any[]};
@Component({standalone:true,imports:[RouterLink,IconComponent,DatePipe],templateUrl:'./enterprise-dashboard-v3.component.html',styleUrl:'./enterprise-dashboard-v3.component.css',styles:['.app-status.REVOKED,.app-status.EXPIRED{background:#fff0f0;color:#b33333}.app-status.SUSPENDED,.app-status.INACTIVE{background:#fff3e8;color:#9a5700}']})
export class EnterpriseDashboardComponent {
  private http=inject(HttpClient); applications:Application[]=[]; loading=true; error='';
  async ngOnInit(){try{this.applications=await firstValueFrom(this.http.get<Application[]>('/api/v1/applications/'));}catch(error:any){this.error=error.error?.detail||'Impossible de charger vos dossiers.';}finally{this.loading=false;}}
  get certified(){return this.applications.filter(item=>item.has_active_certificate).length;} get active(){return this.applications.filter(item=>!['CERTIFIED','REJECTED'].includes(item.status)).length;} get corrections(){return this.applications.filter(item=>item.status==='CORRECTION_REQUIRED').length;}
  readonly workflow=['Demande','Dossier','Évaluation','Correction','Décision','Certification','Suivi'];
  stage(item:Application){return ({DRAFT:0,SUBMITTED:1,UNDER_REVIEW:2,CORRECTION_REQUIRED:3,DECISION_PENDING:4,CERTIFIED:5,REJECTED:4} as Record<string,number>)[item.status]??0;}
  progress(item:Application){return Math.round(((this.stage(item)+1)/this.workflow.length)*100);}
  get activeApplication(){return this.applications.find(item=>!['CERTIFIED','REJECTED'].includes(item.status));}
  documents(item:Application){const total=item.documents.length;const validated=item.documents.filter(doc=>doc.status==='VALIDATED').length;const deposited=item.documents.filter(doc=>['SUBMITTED','VALIDATED'].includes(doc.status)).length;return {total,validated,deposited,missing:total-deposited,review:item.documents.filter(doc=>doc.status==='REJECTED').length};}
  compliance(item:Application){const docs=this.documents(item);return docs.total?Math.round((docs.validated/docs.total)*100):0;}
  actions(item:Application):DashboardAction[]{const docs=this.documents(item);const actions:DashboardAction[]=[];if(['DRAFT','CORRECTION_REQUIRED'].includes(item.status)&&(docs.missing||docs.review)){actions.push({label:docs.review?'Corriger les documents refusés':'Déposer les pièces requises',detail:docs.review?`${docs.review} document(s) à corriger`:`${docs.missing} document(s) à déposer`,icon:'tool',route:['/espace/dossiers',item.id,'documents']});}const open=item.non_conformities.filter(nc=>nc.status==='OPEN').length;if(open){actions.push({label:'Répondre aux non-conformités',detail:`${open} écart(s) en attente de réponse`,icon:'shield',route:['/espace/dossiers',item.id,'non-conformites']});}const audit=item.audits.find(value=>value.status==='SCHEDULED'&&value.scheduled_for);if(audit){actions.push({label:'Préparer l’audit planifié',detail:`Avec ${audit.auditor_name||'l’auditeur INPG'}`,icon:'chart',route:['/espace/dossiers',item.id]});}if(!actions.length){actions.push({label:'Consulter le suivi du dossier',detail:'Aucune action entreprise n’est requise actuellement.',icon:'check',route:['/espace/dossiers',item.id]});}return actions;}
  nextAudit(item:Application){return item.audits.find(value=>value.status==='SCHEDULED'&&value.scheduled_for);}
  requestType(item:Application){return item.request_type==='RENEWAL'?'Renouvellement':'Certification initiale';}
  label(status:string){return ({DRAFT:'Brouillon',SUBMITTED:'Soumis',UNDER_REVIEW:'En évaluation',CORRECTION_REQUIRED:'Corrections demandées',DECISION_PENDING:'En décision',CERTIFIED:'Certifié',REJECTED:'Refusé'} as Record<string,string>)[status]||status;}
  displayStatus(item:Application){if(item.status==='CERTIFIED'&&!item.has_active_certificate)return ({SUSPENDED:'Certification suspendue',REVOKED:'Certification révoquée',EXPIRED:'Certification expirée'} as Record<string,string>)[item.certification_status||'']||'Certification non active';return this.label(item.status);}
  displayStatusClass(item:Application){return item.status==='CERTIFIED'&&!item.has_active_certificate?(item.certification_status||'INACTIVE'):item.status;}
  action(item:Application){return item.status==='DRAFT'?'documents':item.status==='CORRECTION_REQUIRED'?'non-conformites':'tracking';}
}

import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';

type Document={id:number;name:string;domain:string;status:string;review_comment:string;file:string|null};
type NC={id:number;reference:string;domain:string;description:string;status:string;response:string};
type Audit={id:number;auditor_name:string;status:string;scheduled_for:string|null;summary:string};
type Event={id:number;event_type:string;note:string;created_at:string;actor_name:string|null};
type Application={id:number;reference:string;level:string;domains:string[];scope:string;description:string;status:string;documents:Document[];non_conformities:NC[];audits:Audit[];events:Event[];certificate?:{number:string;issued_at:string};};
type User={id:number;username:string;role:string};
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent],templateUrl:'./admin-workflow.component.html',styleUrl:'./admin-workflow.component.css'})
export class AdminWorkflowComponent {
  private http=inject(HttpClient); id=Number(inject(ActivatedRoute).snapshot.paramMap.get('id')); application?:Application; users:User[]=[]; loading=true; busy=''; message=''; error=''; selectedUser=0; correctionDomain=''; correctionDescription=''; auditSummary=''; decisionNote=''; selectedLabel='Gold';
  async ngOnInit(){await Promise.all([this.load(),this.loadUsers()]);}
  async load(){this.loading=true;try{this.application=await firstValueFrom(this.http.get<Application>(`/api/v1/applications/${this.id}/`));this.correctionDomain=this.application.domains[0]||'';this.selectedLabel=this.application.level||'Gold';}catch(e:any){this.error=e.error?.detail||'Dossier introuvable ou non autorisé.';}finally{this.loading=false;}}
  async loadUsers(){try{this.users=await firstValueFrom(this.http.get<User[]>('/api/v1/workflow/assignable-users/'));}catch{this.users=[];}}
  async call(name:string,url:string,body:unknown={}){this.busy=name;this.message='';this.error='';try{await firstValueFrom(this.http.post(url,body));await this.load();this.message='Action enregistrée.';}catch(e:any){this.error=e.error?.detail||e.error?.status?.[0]||'Action impossible à cette étape.';}finally{this.busy='';}}
  review(document:Document,status:string){return this.call(`review-${document.id}`,`/api/v1/documents/${document.id}/review/`,{status,comment:status==='VALIDATED'?'Pièce validée.':'Pièce à corriger.'});}
  assign(){if(this.selectedUser)this.call('assign',`/api/v1/applications/${this.id}/assign/`,{user_id:+this.selectedUser});}
  scheduleAudit(){if(this.selectedUser)this.call('audit',`/api/v1/applications/${this.id}/schedule-audit/`,{auditor_id:+this.selectedUser});}
  requestCorrection(){if(this.correctionDescription.trim())this.call('correction',`/api/v1/applications/${this.id}/request-correction/`,{domain:this.correctionDomain,description:this.correctionDescription});}
  statusLabel(status:string){return ({DRAFT:'Brouillon',SUBMITTED:'Soumis',UNDER_REVIEW:'En évaluation',CORRECTION_REQUIRED:'Corrections demandées',DECISION_PENDING:'En décision',CERTIFIED:'Certifié',REJECTED:'Refusé',MISSING:'À déposer',VALIDATED:'Validé',OPEN:'Ouverte',CORRECTED:'Réponse à valider',SCHEDULED:'Planifié',COMPLETED:'Réalisé',DRAFT_CREATED:'Brouillon créé',DRAFT_UPDATED:'Brouillon modifié',DOCUMENT_UPLOADED:'Pièce déposée',DOCUMENT_VALIDATED:'Pièce validée',DOCUMENT_REJECTED:'Pièce à corriger',ASSIGNED:'Intervenant affecté',REVIEW_STARTED:'Évaluation démarrée',AUDIT_SCHEDULED:'Audit planifié',AUDIT_COMPLETED:'Audit réalisé',CORRECTION_REQUESTED:'Correction demandée',CORRECTION_RESPONDED:'Correction transmise',CORRECTION_VALIDATED:'Correction clôturée',EVALUATION_COMPLETED:'Évaluation terminée',DECISION_CERTIFIED:'Certification accordée',DECISION_REJECTED:'Certification refusée',CERTIFICATE_VALID:'Certificat réactivé',CERTIFICATE_SUSPENDED:'Certificat suspendu',CERTIFICATE_REVOKED:'Certificat révoqué'} as Record<string,string>)[status]||status;}
  get auditors(){return this.users.filter(u=>u.role==='AUDITOR');} get evaluators(){return this.users.filter(u=>u.role==='EVALUATOR');}
}

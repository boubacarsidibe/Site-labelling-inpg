import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { MetaService } from '../../core/services/meta.service';
import { apiError, AutoRefresh } from '../../core/api';
import { ROLE_LABELS } from '../../core/labels';

type Document={id:number;name:string;domain:string;mandatory:boolean;status:string;status_label:string;review_comment:string;file_name:string|null;download_url:string|null};
type NC={id:number;reference:string;domain:string;description:string;severity:string;severity_label:string;status:string;status_label:string;response:string;rejection_reason:string;due_date:string|null};
type Audit={id:number;auditor:number;auditor_name:string;status:string;status_label:string;scheduled_for:string|null;summary:string;performed_at:string|null};
type Event={id:number;event_label:string;note:string;created_at:string;actor_name:string|null};
type Assignment={user_id:number;username:string;role:string};
type Application={id:number;reference:string;organization:number;organization_name:string;organization_verified:boolean;level:string;domains:string[];activity:string;kind_label:string;scope:string;description:string;status:string;status_label:string;decision_note:string;updated_at:string;
  documents:Document[];non_conformities:NC[];audits:Audit[];events:Event[];assignments:Assignment[];certificate?:{number:string;effective_status:string;status_label:string;expires_at:string;level:string;domains:string[]}};
type User={id:number;username:string;role:string};

@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent],templateUrl:'./admin-workflow.component.html',styleUrl:'./admin-workflow.component.css'})
export class AdminWorkflowComponent {
  private http=inject(HttpClient); readonly auth=inject(AuthService); private meta=inject(MetaService);
  readonly roles=ROLE_LABELS;
  id=Number(inject(ActivatedRoute).snapshot.paramMap.get('id')); application?:Application; users:User[]=[]; severities:{value:string;label:string}[]=[];
  loading=true; busy=''; message=''; error=''; changed=false;
  // Champs de saisie séparés par action (aucune variable partagée entre deux formulaires).
  assignee=0; auditor=0; auditDate=''; auditSummary:Record<number,string>={}; reviewComment:Record<number,string>={};
  correction={domain:'',description:'',severity:'MAJEURE',due:''}; rejectReason:Record<number,string>={};
  grantedDomains:string[]=[]; decisionNote='';
  private refresher=new AutoRefresh(()=>this.load(true));

  async ngOnInit(){this.severities=(await this.meta.load()).severities;await Promise.all([this.load(),this.loadUsers()]);this.refresher.start();}
  ngOnDestroy(){this.refresher.stop();}
  async load(silent=false){
    try{const fresh=await firstValueFrom(this.http.get<Application>(`/api/v1/applications/${this.id}/`));
      if(silent&&this.application&&fresh.updated_at!==this.application.updated_at)this.changed=true;
      const first=!this.application; this.application=fresh;
      if(first){this.correction.domain=fresh.domains[0]||'';this.grantedDomains=[...fresh.domains];}
    }catch(e){if(!silent)this.error=apiError(e,'Dossier introuvable ou non autorisé.');}finally{this.loading=false;}
  }
  async loadUsers(){if(!this.can('applications.assign'))return;try{this.users=await firstValueFrom(this.http.get<User[]>('/api/v1/workflow/assignable-users/'));}catch{this.users=[];}}
  can(capability:string){return this.auth.has(capability);}
  is(...statuses:string[]){return !!this.application&&statuses.includes(this.application.status);}
  get evaluators(){return this.users.filter(u=>u.role==='EVALUATOR'&&!this.application?.assignments.some(a=>a.user_id===u.id));}
  get auditors(){return this.users.filter(u=>u.role==='AUDITOR');}
  get grantedLevel(){return ({1:'Standard',2:'Gold',3:'Platinum'} as Record<number,string>)[this.grantedDomains.length]||'—';}
  mayCompleteAudit(a:Audit){return a.status==='SCHEDULED'&&this.can('audits.perform')&&(this.auth.user()?.role==='ADMIN'||a.auditor===this.auth.user()?.id);}
  toggleDomain(d:string){this.grantedDomains=this.grantedDomains.includes(d)?this.grantedDomains.filter(x=>x!==d):[...this.grantedDomains,d];}

  async call(name:string,url:string,body:unknown={},done='Action enregistrée.'){
    this.busy=name;this.message='';this.error='';
    try{await firstValueFrom(this.http.post(url,body));await this.load(true);this.changed=false;this.message=done;return true;}
    catch(e){this.error=apiError(e,'Action impossible à cette étape.');await this.load(true);this.changed=false;return false;}
    finally{this.busy='';}
  }
  base(){return `/api/v1/applications/${this.id}/`;}
  review(d:Document,status:'VALIDATED'|'REJECTED'){return this.call(`review-${d.id}`,`/api/v1/documents/${d.id}/review/`,{status,comment:this.reviewComment[d.id]||''},status==='VALIDATED'?'Pièce validée.':'Pièce renvoyée à l’entreprise avec votre commentaire.');}
  verify(){return this.call('verify',`/api/v1/organizations/${this.application?.organization}/verify/`,{},'Organisation vérifiée : l’entreprise est prévenue par e-mail.');}
  async assign(){if(this.assignee&&await this.call('assign',this.base()+'assign/',{user_id:+this.assignee},'Évaluateur affecté.'))this.assignee=0;}
  unassign(a:Assignment){return this.call(`unassign-${a.user_id}`,this.base()+'unassign/',{user_id:a.user_id},`${a.username} retiré du dossier.`);}
  async scheduleAudit(){if(await this.call('audit',this.base()+'schedule-audit/',{auditor_id:+this.auditor,scheduled_for:this.auditDate},'Audit planifié : l’auditeur et l’entreprise sont prévenus.')){this.auditor=0;this.auditDate='';}}
  completeAudit(a:Audit){return this.call(`complete-audit-${a.id}`,this.base()+'complete-audit/',{audit_id:a.id,summary:this.auditSummary[a.id]||''},'Compte rendu d’audit enregistré.');}
  async requestCorrection(){if(await this.call('correction',this.base()+'request-correction/',{domain:this.correction.domain,description:this.correction.description,severity:this.correction.severity,due_date:this.correction.due||undefined},'Non-conformité créée : l’entreprise est prévenue.'))this.correction={...this.correction,description:'',due:''};}
  closeCorrection(nc:NC){return this.call(`validate-${nc.id}`,this.base()+'validate-correction/',{non_conformity_id:nc.id},`${nc.reference} clôturée.`);}
  rejectCorrection(nc:NC){return this.call(`reject-${nc.id}`,this.base()+'reject-correction/',{non_conformity_id:nc.id,reason:this.rejectReason[nc.id]||''},`${nc.reference} renvoyée à l’entreprise.`);}
  startReview(){return this.call('review',this.base()+'start-review/',{},'Évaluation démarrée.');}
  completeEvaluation(){return this.call('evaluation',this.base()+'complete-evaluation/',{note:'Évaluation finalisée.'},'Dossier transmis en décision.');}
  certify(){return this.call('certify',this.base()+'decide/',{decision:'CERTIFIED',domains:this.grantedDomains,note:this.decisionNote},'Certificat émis.');}
  reject(){if(!this.decisionNote.trim()){this.error='Le motif du refus est obligatoire : il est communiqué à l’entreprise.';return;}return this.call('reject',this.base()+'decide/',{decision:'REJECTED',note:this.decisionNote},'Refus enregistré : l’entreprise est prévenue.');}
}

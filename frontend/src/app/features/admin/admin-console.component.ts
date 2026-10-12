import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { MetaService } from '../../core/services/meta.service';
import { apiError, AutoRefresh } from '../../core/api';
import { ROLE_LABELS } from '../../core/labels';

type Application={id:number;reference:string;organization_name:string;level:string;status:string;status_label:string;created_at:string;updated_at:string;domains:string[];open_non_conformities:number;certificate?:{effective_status:string;status_label:string}};
type Certificate={id:number;number:string;issued_at:string;expires_at:string;effective_status:string;status_label:string;status:string;application_id:number;organization_name:string;level:string;domains:string[]};
type Audit={id:number;application:number;application_reference:string;organization_name:string;auditor_name:string;scheduled_for:string|null;status:string;status_label:string;summary:string};
type NC={id:number;application:number;application_reference:string;organization_name:string;reference:string;domain:string;description:string;severity:string;severity_label:string;status:string;status_label:string;due_date:string|null};
type Requirement={id?:number;domain:string;activity:string;name:string;mandatory:boolean;active:boolean;order:number};
type Account={id:number;username:string;email:string;is_active:boolean;is_superuser:boolean;role:string|null;organization:string|null;last_login:string|null};

const STATUSES=[['SUBMITTED','Soumis'],['UNDER_REVIEW','En évaluation'],['CORRECTION_REQUIRED','Corrections demandées'],['DECISION_PENDING','En décision'],['CERTIFIED','Certifié'],['REJECTED','Refusé'],['DRAFT','Brouillon']];

@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent],templateUrl:'./admin-console.component.html',styleUrl:'./admin-console.component.css'})
export class AdminConsoleComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient); readonly auth=inject(AuthService); private meta=inject(MetaService);
  readonly statuses=STATUSES; readonly roles=ROLE_LABELS;
  applications:Application[]=[]; certificates:Certificate[]=[]; audits:Audit[]=[]; ncs:NC[]=[]; requirements:Requirement[]=[]; accounts:Account[]=[];
  domains:string[]=[]; activities:string[]=[];
  loading=false; error=''; message=''; query=''; statusFilter=''; ncFilter='OPEN,CORRECTED';
  created=''; accountError=''; username=''; email=''; password=''; role='MANAGER';
  draft:Requirement={domain:'Sécurité',activity:'',name:'',mandatory:true,active:true,order:0};
  private refresher=new AutoRefresh(()=>this.load(true));
  readonly sectionInfo:Record<string,{title:string;subtitle:string}>={
    dashboard:{title:'Tableau de bord',subtitle:'Ce qui attend une action de votre part, et l’état du portefeuille.'},
    dossiers:{title:'Dossiers',subtitle:'Consultez et orientez les demandes de certification.'},
    evaluations:{title:'Évaluations',subtitle:'Dossiers en cours d’évaluation, de correction ou de décision.'},
    audits:{title:'Audits',subtitle:'Audits planifiés et réalisés.'},
    'non-conformites':{title:'Non-conformités',subtitle:'Écarts ouverts, réponses à examiner et échéances.'},
    certificats:{title:'Certifications par Label',subtitle:'Registre des certificats, validité d’un an, suspension et révocation.'},
    referentiels:{title:'Référentiels',subtitle:'Pièces exigées par volet et par activité : elles alimentent la checklist des nouveaux dossiers.'},
    utilisateurs:{title:'Utilisateurs',subtitle:'Comptes internes : création, activation et désactivation.'},
  };
  get path(){return this.route.snapshot.routeConfig?.path||'dashboard';}
  get section(){return this.sectionInfo[this.path]||this.sectionInfo['dashboard'];}
  get filtered(){const q=this.query.trim().toLowerCase();return this.applications.filter(a=>(!this.statusFilter||a.status===this.statusFilter)&&(!q||[a.reference,a.organization_name,a.level,a.status_label,...a.domains].join(' ').toLowerCase().includes(q)));}
  count(status:string){return this.applications.filter(a=>a.status===status).length;}
  /** Dossiers qui attendent une action du rôle connecté. */
  get todo(){const r=this.auth.user()?.role;const want:Record<string,string[]>={MANAGER:['SUBMITTED'],EVALUATOR:['UNDER_REVIEW','CORRECTION_REQUIRED'],AUDITOR:['UNDER_REVIEW','CORRECTION_REQUIRED'],DECISION_MAKER:['DECISION_PENDING'],ADMIN:['SUBMITTED','DECISION_PENDING']};return this.applications.filter(a=>(want[r||'']||[]).includes(a.status));}
  get expiringSoon(){const limit=Date.now()+90*86400000;return this.certificates.filter(c=>c.effective_status==='VALID'&&new Date(c.expires_at).getTime()<limit);}
  overdue(nc:NC){return nc.status==='OPEN'&&!!nc.due_date&&new Date(nc.due_date+'T23:59:59')<new Date();}

  async ngOnInit(){this.statusFilter=this.route.snapshot.queryParamMap.get('statut')||'';const m=await this.meta.load();this.domains=m.domains;this.activities=m.activities;await this.load();this.refresher.start();}
  ngOnDestroy(){this.refresher.stop();}
  async load(silent=false){
    if(!silent)this.loading=true; this.error='';
    try{
      const p=this.path;
      if(['dashboard','dossiers','evaluations'].includes(p)){const params:Record<string,string>=p==='evaluations'?{status:'UNDER_REVIEW,CORRECTION_REQUIRED,DECISION_PENDING'}:{};this.applications=await firstValueFrom(this.http.get<Application[]>('/api/v1/applications/',{params}));}
      if(p==='certificats'||(p==='dashboard'&&this.auth.has('certificates.read')))this.certificates=await firstValueFrom(this.http.get<Certificate[]>('/api/v1/certificates/'));
      if(p==='audits')this.audits=await firstValueFrom(this.http.get<Audit[]>('/api/v1/audits/'));
      if(p==='non-conformites')this.ncs=await firstValueFrom(this.http.get<NC[]>('/api/v1/non-conformities/',{params:(this.ncFilter?{status:this.ncFilter}:{}) as Record<string,string>}));
      if(p==='referentiels')this.requirements=await firstValueFrom(this.http.get<Requirement[]>('/api/v1/requirements/'));
      if(p==='utilisateurs')this.accounts=await firstValueFrom(this.http.get<Account[]>('/api/v1/admin/accounts/'));
    }catch(e){if(!silent)this.error=apiError(e,'Impossible de charger les données.');}
    finally{this.loading=false;}
  }
  async act(fn:()=>Promise<unknown>,done:string){this.message='';this.error='';try{await fn();this.message=done;await this.load(true);}catch(e){this.error=apiError(e);}}
  updateCertificate(c:Certificate,status:string){
    if(status==='REVOKED'&&!confirm(`Révoquer définitivement ${c.number} ? Cette action est irréversible.`))return;
    return this.act(()=>firstValueFrom(this.http.post(`/api/v1/certificates/${c.id}/update-status/`,{status})),`Certificat ${c.number} mis à jour.`);
  }
  saveRequirement(r:Requirement){return this.act(()=>firstValueFrom(r.id?this.http.patch(`/api/v1/requirements/${r.id}/`,r):this.http.post('/api/v1/requirements/',r)),'Référentiel enregistré.').then(()=>{if(!r.id)this.draft={...this.draft,name:''};});}
  setActive(a:Account,active:boolean){return this.act(()=>firstValueFrom(this.http.post(`/api/v1/admin/accounts/${a.id}/set-active/`,{is_active:active})),`Compte ${a.username} ${active?'réactivé':'désactivé'}.`);}
  async createAccount(){if(!this.username||!this.email||!this.password)return;this.created='';this.accountError='';try{const response=await firstValueFrom(this.http.post<{username:string;role:string}>('/api/v1/admin/accounts/',{username:this.username,email:this.email,password:this.password,role:this.role}));this.created=`Compte ${response.username} créé avec le rôle ${this.roles[response.role]||response.role}.`;this.username='';this.email='';this.password='';await this.load(true);}catch(e){this.accountError=apiError(e,'Création impossible.');}}
}

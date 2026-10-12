import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { MetaService } from '../../core/services/meta.service';
import { apiError, AutoRefresh } from '../../core/api';
import { APPLICATION_STEPS } from '../../core/labels';

type Requirement={id:number;domain:string;name:string;mandatory:boolean};
type OwnCertificate={id:number;number:string;level:string;effective_status:string;status_label:string;expires_at:string};

@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent],templateUrl:'./certification-form.html',styleUrl:'./certification-pages.css'})
export class CertificationFormComponent {
  private auth=inject(AuthService); private http=inject(HttpClient); private router=inject(Router); private route=inject(ActivatedRoute); private metaService=inject(MetaService);
  readonly steps=APPLICATION_STEPS;
  readonly icons:Record<string,string>={'Sécurité':'shield','Qualité':'medal','Environnement':'leaf'};
  readonly hints:Record<string,string>={'Sécurité':'Personnes et installations','Qualité':'Processus et performance','Environnement':'Impacts et ressources'};
  domains:string[]=[]; activities:string[]=[]; certificates:OwnCertificate[]=[];
  activity=''; selected:string[]=[]; kind='INITIAL'; renewalOf:number|null=null; previous:number|null=null; scope=''; description=''; message=''; busy=false;
  documents:Requirement[]=[]; level='À définir';
  async ngOnInit(){
    const meta=await this.metaService.load(); this.domains=meta.domains; this.activities=meta.activities;
    const org=this.auth.user()?.organization_id;
    try{const mine=await firstValueFrom(this.http.get<{activity:string}>(`/api/v1/organizations/${org}/`));this.activity=mine.activity||'';}catch{}
    try{this.certificates=(await firstValueFrom(this.http.get<OwnCertificate[]>('/api/v1/certificates/'))).filter(c=>c.effective_status!=='REVOKED');}catch{}
    const q=this.route.snapshot.queryParamMap;
    if(q.get('renouvellement')){this.kind='RENEWAL';this.renewalOf=Number(q.get('renouvellement'));}
    if(q.get('suite')){this.previous=Number(q.get('suite'));}
    await this.preview();
  }
  get unverified(){return this.auth.user()?.organization_verified===false;}
  toggle(domain:string){this.selected=this.selected.includes(domain)?this.selected.filter(d=>d!==domain):[...this.selected,domain];this.message='';this.preview();}
  /** Checklist et niveau calculés par l'API : exactement ce qui sera créé. */
  async preview(){
    if(!this.selected.length){this.documents=[];this.level='À définir';return;}
    const ordered=this.domains.filter(d=>this.selected.includes(d));
    const r=await firstValueFrom(this.http.get<{level:string;documents:Requirement[]}>('/api/v1/requirements/preview/',{params:{activity:this.activity,domains:ordered.join(',')}}));
    this.documents=r.documents; this.level=r.level||'À définir';
  }
  async save(){
    if(this.busy)return;
    if(!this.selected.length){this.message='Choisissez au moins un volet.';return;}
    if(!this.activity){this.message='Choisissez votre activité principale.';return;}
    if(this.kind==='RENEWAL'&&!this.renewalOf){this.message='Choisissez le certificat à renouveler.';return;}
    const organization=this.auth.user()?.organization_id;
    if(!organization){this.message='Votre compte n’est pas rattaché à une entreprise.';return;}
    this.busy=true;this.message='';
    try{
      const created=await firstValueFrom(this.http.post<{id:number}>('/api/v1/applications/',{organization,activity:this.activity,kind:this.kind,renewal_of:this.kind==='RENEWAL'?this.renewalOf:null,previous_application:this.previous,domains:this.domains.filter(d=>this.selected.includes(d)),scope:this.scope,description:this.description}));
      await this.router.navigate(['/espace/dossiers',created.id,'documents']);
    }catch(error){this.message=apiError(error,'Création du brouillon impossible.');}finally{this.busy=false;}
  }
}

type Event={id:number;event_label:string;note:string;created_at:string;actor_name:string|null};
type TrackingApplication={id:number;reference:string;level:string;domains:string[];scope:string;status:string;status_label:string;kind_label:string;created_at:string;updated_at:string;decision_note:string;previous_application:number|null;
  audits:{auditor_name:string;status_label:string;scheduled_for:string|null}[];events:Event[];certificate?:{id:number;number:string;issued_at:string;expires_at:string;effective_status:string;status_label:string;level:string;domains:string[]}};

@Component({standalone:true,imports:[CommonModule,RouterLink,IconComponent],templateUrl:'./workflow-tracking.component.html',styleUrl:'./certification-pages.css'})
export class CertificationTrackingComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient);
  id=Number(this.route.snapshot.paramMap.get('id')); application?:TrackingApplication; loading=true; error=''; changed=false;
  private refresher=new AutoRefresh(()=>this.load(true));
  readonly steps=[{name:'Demande',text:'Définir le périmètre et les volets de certification.'},{name:'Dossier',text:'Rassembler et déposer les pièces justificatives.'},{name:'Évaluation',text:'Analyse documentaire et audit de conformité.'},{name:'Correction',text:'Traiter les écarts et transmettre les preuves.'},{name:'Décision',text:'Examen du dossier par l’INPG.'},{name:'Certification',text:'Émission du certificat après décision favorable.'},{name:'Suivi',text:'Validité d’un an, puis renouvellement.'}];
  async ngOnInit(){await this.load();this.refresher.start();}
  ngOnDestroy(){this.refresher.stop();}
  async load(silent=false){
    try{const fresh=await firstValueFrom(this.http.get<TrackingApplication>(`/api/v1/applications/${this.id}/`));
      if(silent&&this.application&&fresh.updated_at!==this.application.updated_at)this.changed=true;
      this.application=fresh;}
    catch(error){if(!silent)this.error=apiError(error,'Dossier introuvable ou non autorisé.');}
    finally{this.loading=false;}
  }
  /** Étape en cours (1 à 7) ; 0 = parcours terminé. */
  get stage(){return ({DRAFT:2,SUBMITTED:3,UNDER_REVIEW:3,CORRECTION_REQUIRED:4,DECISION_PENDING:5,CERTIFIED:7,REJECTED:5} as Record<string,number>)[this.application?.status||'DRAFT']||1;}
  state(i:number){
    const s=this.application?.status; const n=i+1;
    if(s==='REJECTED')return n<5?'Terminé':n===5?'Refusé':'—';
    if(s==='CERTIFIED')return n<7?'Terminé':(this.application?.certificate?.status_label||'En cours');
    if(s!=='CORRECTION_REQUIRED'&&n===4&&this.stage>4)return 'Terminé';
    return n<this.stage?'Terminé':n===this.stage?'En cours':'À venir';
  }
}

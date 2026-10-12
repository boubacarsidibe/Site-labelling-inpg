import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MetaService } from '../../core/services/meta.service';
import { apiError } from '../../core/api';

type Organization={id:number;legal_name:string;ninea:string;activity:string;address:string;is_verified:boolean;verified_at:string|null};
type Member={username:string;email:string;first_name:string;last_name:string;is_owner:boolean;is_active:boolean};
type Invitation={id:number;email:string;created_at:string;expires_at:string;invited_by_name:string};

@Component({standalone:true,imports:[CommonModule,FormsModule],template:`
<div class="page-head"><div><p class="eyebrow">ESPACE ENTREPRISE</p><h1>Mon entreprise</h1><p>Informations de l’organisation, membres et invitations.</p></div></div>
@if(org){<div class="two">
<form class="panel stack" (ngSubmit)="save()"><h2>Fiche de l’organisation</h2>
<p>@if(org.is_verified){<span class="chip VALID">Vérifiée par l’INPG le {{org.verified_at|date:'dd/MM/yyyy'}}</span>}@else{<span class="chip SUSPENDED">En attente de vérification par l’INPG</span>}</p>
<label class="field">Raison sociale<input [value]="org.legal_name" disabled></label>
<label class="field">NINEA<input [value]="org.ninea" disabled></label>
<p class="muted">La raison sociale et le NINEA sont vérifiés par l’INPG : contactez-la pour les corriger.</p>
<label class="field">Activité principale<select name="activity" [(ngModel)]="org.activity"><option value="">Non renseignée</option>@for(a of activities;track a){<option [value]="a">{{a}}</option>}</select></label>
<label class="field">Adresse<input name="address" [(ngModel)]="org.address" maxlength="255"></label>
<div class="row"><button class="button" [disabled]="busy">Enregistrer</button>@if(saved){<span class="notice success">Fiche enregistrée.</span>}</div></form>
<section class="panel stack"><h2>Membres</h2>
<table class="simple-table"><thead><tr><th>Compte</th><th>E-mail</th><th>Rôle</th></tr></thead><tbody>@for(m of members;track m.username){<tr><td>{{m.first_name}} {{m.last_name}}<br><span class="muted">{{m.username}}</span></td><td>{{m.email}}</td><td>{{m.is_owner?'Titulaire':'Membre'}}</td></tr>}</tbody></table>
@if(auth.has('members.invite')){<form class="stack" (ngSubmit)="invite()"><h3>Inviter un collègue</h3><label class="field">Adresse e-mail<input name="email" type="email" [(ngModel)]="email" required></label><div><button class="outline" [disabled]="busy||!email">Envoyer l’invitation</button></div></form>}
@else{<p class="muted">Seul le titulaire du compte peut inviter des collègues.</p>}
@if(invitations.length){<h3>Invitations en attente</h3><ul>@for(i of invitations;track i.id){<li>{{i.email}} <span class="muted">· expire le {{i.expires_at|date:'dd/MM/yyyy'}}</span></li>}</ul>}
</section></div>}
@if(message){<p [class]="'notice '+(error?'error':'success')" role="status">{{message}}</p>}`})
export class EnterpriseDetailComponent{
  private http=inject(HttpClient); readonly auth=inject(AuthService); private meta=inject(MetaService);
  org?:Organization; members:Member[]=[]; invitations:Invitation[]=[]; activities:string[]=[]; email=''; busy=false; saved=false; message=''; error=false;
  async ngOnInit(){this.activities=(await this.meta.load()).activities;await this.load();}
  async load(){const id=this.auth.user()?.organization_id;try{this.org=await firstValueFrom(this.http.get<Organization>(`/api/v1/organizations/${id}/`));this.members=await firstValueFrom(this.http.get<Member[]>(`/api/v1/organizations/${id}/members/`));this.invitations=await firstValueFrom(this.http.get<Invitation[]>('/api/v1/invitations/'));}catch(e){this.message=apiError(e,'Organisation introuvable.');this.error=true;}}
  async save(){if(!this.org)return;this.busy=true;this.saved=false;this.message='';try{this.org=await firstValueFrom(this.http.patch<Organization>(`/api/v1/organizations/${this.org.id}/`,{activity:this.org.activity,address:this.org.address}));this.saved=true;}catch(e){this.message=apiError(e);this.error=true;}finally{this.busy=false;}}
  async invite(){this.busy=true;this.message='';this.error=false;try{await firstValueFrom(this.http.post('/api/v1/invitations/',{email:this.email}));this.message=`Invitation envoyée à ${this.email}.`;this.email='';await this.load();}catch(e){this.message=apiError(e);this.error=true;}finally{this.busy=false;}}
}

type Certificate={id:number;number:string;issued_at:string;expires_at:string;effective_status:string;status_label:string;level:string;domains:string[];application_id:number;application_reference:string};
@Component({standalone:true,imports:[CommonModule,RouterLink],template:`
<div class="page-head"><div><p class="eyebrow">ESPACE ENTREPRISE</p><h1>Mes certifications</h1><p>Vos certificats, leur validité (un an) et leur renouvellement.</p></div></div>
@if(loading){<p class="loading">Chargement…</p>}@else if(!certificates.length){<article class="panel"><h2>Aucun certificat</h2><p>Les certificats apparaissent ici après une décision favorable sur un de vos dossiers.</p><a class="button" routerLink="/espace/dossiers/nouveau">Préparer une demande</a></article>}
@else{<div class="cards">@for(c of certificates;track c.id){<article class="panel stack"><h2>Label {{c.level}}</h2><p><span [class]="'chip '+c.effective_status">{{c.status_label}}</span></p><p>{{c.number}}</p><p class="muted">{{c.domains.join(' · ')}}</p><p>Émis le {{c.issued_at|date:'dd/MM/yyyy'}} · expire le <b>{{c.expires_at|date:'dd/MM/yyyy'}}</b></p>
<div class="row"><a class="outline" [routerLink]="['/espace/dossiers',c.application_id]">Voir le dossier</a>@if(c.effective_status!=='REVOKED'){<a class="button" [routerLink]="['/espace/dossiers/nouveau']" [queryParams]="{renouvellement:c.id}">Renouveler</a>}</div>
<p class="muted">Vérification publique : <a [routerLink]="['/verification-certificat']" [queryParams]="{numero:c.number}">lien à partager</a></p></article>}</div>}
@if(error){<p class="notice error">{{error}}</p>}`})
export class CertificatesComponent{
  private http=inject(HttpClient); certificates:Certificate[]=[]; loading=true; error='';
  async ngOnInit(){try{this.certificates=await firstValueFrom(this.http.get<Certificate[]>('/api/v1/certificates/'));}catch(e){this.error=apiError(e);}finally{this.loading=false;}}
}

@Component({standalone:true,imports:[RouterLink],template:`<div class="page-head"><div><p class="eyebrow">ESPACE ENTREPRISE</p><h1>Formations INPG</h1><p>Le catalogue des formations proposées par l’INPG pour accompagner votre démarche.</p></div><a class="outline" routerLink="/formations">Ouvrir le catalogue complet</a></div><div class="cards">@for(course of courses;track course.slug){<article class="panel"><h3>{{course.name}}</h3><a class="outline" [routerLink]="['/formations',course.slug]">Voir les détails</a></article>}</div>`})
export class TrainingsComponent{courses=[{slug:'hse',name:'Management Santé, Sécurité et Environnement'},{slug:'qualite',name:'Management de la qualité'},{slug:'environnement',name:'Management environnemental'},{slug:'audit',name:'Pratique de l’audit interne'}];}

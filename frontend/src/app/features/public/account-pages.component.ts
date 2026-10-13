import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiError } from '../../core/api';
import { AuthService } from '../../core/services/auth.service';

const CARD=`.account{max-width:560px;margin:40px auto;padding:35px;background:white;border:1px solid #e0e7ef;border-radius:12px}.account img{width:160px;margin-bottom:25px}.kicker{font-size:10px;letter-spacing:2px;color:#55789c}.account h1{font-size:28px;margin:10px 0}.account>p{color:#6b8098}.account form{display:grid;gap:18px;margin:26px 0}.account label{display:grid;gap:7px;font-size:13px;color:#355474}.account small{font-size:11px;color:#6d8299}.account button:disabled{opacity:.6}@media(max-width:600px){.account{margin:15px;padding:24px}}`;

async function csrf(http:HttpClient){await firstValueFrom(http.get('/api/v1/auth/csrf/'));}

@Component({standalone:true,imports:[FormsModule,RouterLink],template:`<main class="account"><a routerLink="/"><img src="/assets/inpg-logo.svg" alt="INPG"></a><p class="kicker">MOT DE PASSE OUBLIÉ</p><h1>Réinitialiser votre mot de passe</h1><p>Indiquez l’adresse e-mail de votre compte : nous vous enverrons un lien valable 24 heures.</p>
@if(done){<p class="notice success" role="status">{{done}}</p>}@else{<form (ngSubmit)="submit()"><label>Adresse e-mail<input name="email" type="email" autocomplete="email" [(ngModel)]="email" required></label>@if(error){<p class="notice error" role="alert">{{error}}</p>}<button class="button" [disabled]="busy||!email">{{busy?'Envoi…':'Envoyer le lien'}}</button></form>}
<a routerLink="/connexion">Retour à la connexion</a></main>`,styles:[CARD]})
export class ForgotPasswordComponent{
  private http=inject(HttpClient);email='';busy=false;done='';error='';
  async submit(){if(this.busy)return;this.busy=true;this.error='';try{await csrf(this.http);const r=await firstValueFrom(this.http.post<{detail:string}>('/api/v1/auth/password-reset/',{email:this.email}));this.done=r.detail;}catch(e){this.error=apiError(e,'Envoi impossible. Réessayez plus tard.');}finally{this.busy=false;}}
}

@Component({standalone:true,imports:[FormsModule,RouterLink],template:`<main class="account"><a routerLink="/"><img src="/assets/inpg-logo.svg" alt="INPG"></a><p class="kicker">NOUVEAU MOT DE PASSE</p><h1>Choisissez un nouveau mot de passe</h1>
@if(done){<p class="notice success" role="status">{{done}}</p><a class="button" routerLink="/connexion">Se connecter</a>}@else if(!uid||!token){<p class="notice error" role="alert">Lien incomplet. Refaites une demande depuis « Mot de passe oublié ».</p><a routerLink="/mot-de-passe-oublie">Mot de passe oublié</a>}@else{<form (ngSubmit)="submit()"><label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" [(ngModel)]="password" required minlength="10"><small>10 caractères minimum ; évitez les mots de passe courants.</small></label><label>Confirmer<input name="confirm" type="password" autocomplete="new-password" [(ngModel)]="confirm" required></label>@if(error){<p class="notice error" role="alert">{{error}}</p>}<button class="button" [disabled]="busy">{{busy?'Enregistrement…':'Enregistrer'}}</button></form>}</main>`,styles:[CARD]})
export class ResetPasswordComponent{
  private http=inject(HttpClient);private q=inject(ActivatedRoute).snapshot.queryParamMap;
  uid=this.q.get('uid')||'';token=this.q.get('token')||'';password='';confirm='';busy=false;done='';error='';
  async submit(){if(this.busy)return;this.error='';if(this.password!==this.confirm){this.error='Les mots de passe ne correspondent pas.';return;}this.busy=true;try{await csrf(this.http);const r=await firstValueFrom(this.http.post<{detail:string}>('/api/v1/auth/password-reset/confirm/',{uid:this.uid,token:this.token,password:this.password}));this.password='';this.confirm='';this.done=r.detail;}catch(e){this.error=apiError(e,'Lien invalide ou expiré.');}finally{this.busy=false;}}
}

@Component({standalone:true,imports:[FormsModule,RouterLink],template:`<main class="account"><a routerLink="/"><img src="/assets/inpg-logo.svg" alt="INPG"></a><p class="kicker">INVITATION</p><h1>Rejoindre votre entreprise</h1>
@if(loading){<p class="loading">Vérification de l’invitation…</p>}@else if(done){<p class="notice success" role="status">Votre compte est créé et rattaché à {{organization}}.</p><a class="button" routerLink="/connexion">Se connecter</a>}@else if(!organization){<p class="notice error" role="alert">{{error}}</p>}@else{
<p>Vous êtes invité(e) à rejoindre <strong>{{organization}}</strong> sur la plateforme Label INPG. Le compte sera créé pour l’adresse <strong>{{email}}</strong>.</p>
<form (ngSubmit)="submit()"><label>Prénom<input name="first_name" [(ngModel)]="first_name" autocomplete="given-name" required maxlength="150"></label><label>Nom<input name="last_name" [(ngModel)]="last_name" autocomplete="family-name" required maxlength="150"></label><label>Identifiant de connexion<input name="username" [(ngModel)]="username" autocomplete="username" required maxlength="150"></label><label>Mot de passe<input name="password" type="password" [(ngModel)]="password" autocomplete="new-password" required minlength="10"><small>10 caractères minimum.</small></label><label>Confirmer le mot de passe<input name="confirm" type="password" [(ngModel)]="confirm" autocomplete="new-password" required></label>@if(error){<p class="notice error" role="alert">{{error}}</p>}<button class="button" [disabled]="busy">{{busy?'Création…':'Créer mon compte'}}</button></form>}</main>`,styles:[CARD]})
export class InvitationComponent{
  private http=inject(HttpClient);token=inject(ActivatedRoute).snapshot.paramMap.get('token')||'';
  loading=true;organization='';email='';first_name='';last_name='';username='';password='';confirm='';busy=false;done=false;error='';
  async ngOnInit(){try{const r=await firstValueFrom(this.http.get<{organization:string;email:string}>(`/api/v1/invitations/${encodeURIComponent(this.token)}/`));this.organization=r.organization;this.email=r.email;}catch(e){this.error=apiError(e,'Invitation invalide, expirée ou déjà utilisée.');}finally{this.loading=false;}}
  async submit(){if(this.busy)return;this.error='';if(this.password!==this.confirm){this.error='Les mots de passe ne correspondent pas.';return;}this.busy=true;try{await csrf(this.http);await firstValueFrom(this.http.post(`/api/v1/invitations/${encodeURIComponent(this.token)}/accept/`,{first_name:this.first_name,last_name:this.last_name,username:this.username,password:this.password}));this.password='';this.confirm='';this.done=true;}catch(e){this.error=apiError(e,'Création impossible.');}finally{this.busy=false;}}
}

type Verification={number:string;organization:string;level:string;domains:string[];issued_at:string;expires_at:string|null;status:string;status_label:string;is_valid:boolean};

@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink],template:`<section class="verify"><p class="kicker">REGISTRE PUBLIC</p><h1>Vérification de certificat</h1><p>Saisissez le numéro imprimé sur le certificat (ex. CERT-INPG-XXXXXXXXXXXXXXXX) pour en connaître la validité.</p>
<form (ngSubmit)="search()" class="verify-form"><label class="sr-only" for="numero">Numéro de certificat</label><input id="numero" name="numero" [(ngModel)]="number" placeholder="Numéro du certificat" required><button class="button" [disabled]="busy||!number.trim()">{{busy?'Recherche…':'Vérifier'}}</button></form>
@if(error){<p class="notice error" role="alert">{{error}}</p>}
@if(result){<article class="result" [class.valid]="result.is_valid"><span [class]="'chip '+result.status">{{result.status_label}}</span><h2>{{result.number}}</h2><dl><dt>Entreprise</dt><dd>{{result.organization}}</dd><dt>Niveau</dt><dd>{{result.level}}</dd><dt>Volets</dt><dd>{{result.domains.join(', ')}}</dd><dt>Délivré le</dt><dd>{{result.issued_at|date:'dd/MM/yyyy'}}</dd><dt>Valable jusqu’au</dt><dd>{{result.expires_at?(result.expires_at|date:'dd/MM/yyyy'):'—'}}</dd></dl>
<p class="muted">{{result.is_valid?'Ce certificat est en cours de validité.':'Ce certificat n’est pas valide à ce jour : il ne peut pas être présenté comme preuve de labellisation.'}}</p></article>}
<p class="muted">Une question sur un certificat ? <a routerLink="/contact">Contactez l’INPG</a>.</p></section>`,styles:[`.verify{max-width:720px;margin:50px auto;padding:0 20px}.kicker{font-size:10px;letter-spacing:2px;color:#55789c}.verify-form{display:flex;gap:12px;margin:24px 0}.verify-form input{flex:1;min-width:0;padding:12px;border:1px solid #cfdbe8;border-radius:6px}.result{padding:24px;border:1px solid #e0e7ef;border-left:5px solid #a32e35;border-radius:10px;background:white;margin:20px 0}.result.valid{border-left-color:#2c7a52}.result dl{display:grid;grid-template-columns:160px 1fr;gap:8px 16px}.result dt{color:#657e99}.result dd{margin:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}@media(max-width:600px){.verify-form{flex-direction:column}.result dl{grid-template-columns:1fr}}`]})
export class VerifyCertificateComponent{
  private http=inject(HttpClient);private router=inject(Router);private route=inject(ActivatedRoute);
  number=this.route.snapshot.queryParamMap.get('numero')||'';busy=false;error='';result?:Verification;
  ngOnInit(){if(this.number)this.search();}
  async search(){const n=this.number.trim();if(!n||this.busy)return;this.busy=true;this.error='';this.result=undefined;
    this.router.navigate([],{queryParams:{numero:n},replaceUrl:true});
    try{this.result=await firstValueFrom(this.http.get<Verification>(`/api/v1/public/certificates/${encodeURIComponent(n)}/`));}catch(e){this.error=apiError(e,'Vérification impossible.');}finally{this.busy=false;}}
}

@Component({standalone:true,imports:[FormsModule,RouterLink],template:`<main class="account"><a routerLink="/"><img src="/assets/inpg-logo.svg" alt="INPG"></a><p class="kicker">MON COMPTE · {{auth.user()?.username}}</p><h1>Changer mon mot de passe</h1><p>Les autres sessions ouvertes avec ce compte seront fermées.</p>
@if(done){<p class="notice success" role="status">{{done}}</p>}@else{<form (ngSubmit)="submit()"><label>Mot de passe actuel<input name="current" type="password" autocomplete="current-password" [(ngModel)]="current" required></label><label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" [(ngModel)]="password" required minlength="10"><small>10 caractères minimum ; évitez les mots de passe courants.</small></label><label>Confirmer le nouveau mot de passe<input name="confirm" type="password" autocomplete="new-password" [(ngModel)]="confirm" required></label>@if(error){<p class="notice error" role="alert">{{error}}</p>}<button class="button" [disabled]="busy||!current||!password">{{busy?'Enregistrement…':'Changer le mot de passe'}}</button></form>}
<a [routerLink]="auth.landing">Retour à mon espace</a></main>`,styles:[CARD]})
export class ChangePasswordComponent{
  private http=inject(HttpClient);readonly auth=inject(AuthService);current='';password='';confirm='';busy=false;done='';error='';
  async submit(){if(this.busy)return;this.error='';if(this.password!==this.confirm){this.error='Les deux nouveaux mots de passe ne correspondent pas.';return;}this.busy=true;
    try{await csrf(this.http);const r=await firstValueFrom(this.http.post<{detail:string}>('/api/v1/auth/password-change/',{current_password:this.current,new_password:this.password}));this.current='';this.password='';this.confirm='';this.done=r.detail;}
    catch(e){this.error=apiError(e,'Modification impossible.');}finally{this.busy=false;}}
}

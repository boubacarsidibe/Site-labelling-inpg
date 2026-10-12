import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export interface Identity {id:number;username:string;email:string;role:string|null;capabilities:string[];is_superuser:boolean;organization_id:number|null;organization_name:string|null;organization_verified:boolean|null;is_owner:boolean}
@Injectable({providedIn:'root'})
export class AuthService {
  private http=inject(HttpClient);
  readonly user=signal<Identity|null>(null);
  private pending?:Promise<Identity|null>; private fetchedAt=0;
  /** Vrai quand une session ouverte a été perdue (expiration, déconnexion dans un autre onglet). */
  expired=false;
  has(capability:string){return this.user()?.capabilities.includes(capability)??false;}
  /** Relit l'identité au serveur. Les gardes parent et enfant d'une même navigation partagent un seul appel. */
  refresh(force=false){
    if(!force&&this.pending&&Date.now()-this.fetchedAt<1500)return this.pending;
    this.fetchedAt=Date.now();
    this.pending=firstValueFrom(this.http.get<Identity>('/api/v1/auth/me/')).then(u=>{this.user.set(u);return u;},()=>{if(this.user())this.expired=true;this.user.set(null);return null;});
    return this.pending;
  }
  async login(username:string,password:string){await firstValueFrom(this.http.get('/api/v1/auth/csrf/'));this.user.set(await firstValueFrom(this.http.post<Identity>('/api/v1/auth/login/',{username,password})));this.expired=false;this.fetchedAt=Date.now();this.pending=Promise.resolve(this.user());}
  async logout(){await firstValueFrom(this.http.get('/api/v1/auth/csrf/'));await firstValueFrom(this.http.post('/api/v1/auth/logout/',{}));this.user.set(null);this.pending=undefined;}
  get landing(){return this.has('portal.admin')?'/admin/dashboard':this.has('portal.enterprise')?'/espace/tableau-de-bord':this.has('portal.professional')?'/professionnel':'/acces-refuse';}
}

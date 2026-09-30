import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export interface Identity {id:number;username:string;role:string|null;capabilities:string[];is_superuser:boolean;organization_id:number|null}
@Injectable({providedIn:'root'})
export class AuthService {
  private http=inject(HttpClient);
  readonly user=signal<Identity|null>(null);
  has(capability:string){return this.user()?.capabilities.includes(capability)??false;}
  async refresh(){try{this.user.set(await firstValueFrom(this.http.get<Identity>('/api/v1/auth/me/')));}catch{this.user.set(null);}return this.user();}
  async login(username:string,password:string){await firstValueFrom(this.http.get('/api/v1/auth/csrf/'));this.user.set(await firstValueFrom(this.http.post<Identity>('/api/v1/auth/login/',{username,password})));}
  async logout(){await firstValueFrom(this.http.get('/api/v1/auth/csrf/'));await firstValueFrom(this.http.post('/api/v1/auth/logout/',{}));this.user.set(null);}
  get landing(){return this.has('portal.admin')?'/admin/dashboard':this.has('portal.enterprise')?'/espace/tableau-de-bord':this.has('portal.professional')?'/professionnel':'/acces-refuse';}
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export interface Meta{domains:string[];activities:string[];levels:Record<string,string>;severities:{value:string;label:string}[]}
/** Valeurs de référence (volets, activités, niveaux, gravités) servies par l'API : aucune copie locale. */
@Injectable({providedIn:'root'})
export class MetaService{
  private http=inject(HttpClient);private cache?:Promise<Meta>;
  load(){return this.cache??=firstValueFrom(this.http.get<Meta>('/api/v1/meta/')).catch(e=>{this.cache=undefined;throw e;});}
}

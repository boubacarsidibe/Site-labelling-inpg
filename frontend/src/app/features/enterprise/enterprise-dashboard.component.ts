import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';

type Application={id:number;reference:string;level:string;status:string;domains:string[];created_at:string;certificate?:{number:string;status:string}};
@Component({standalone:true,imports:[RouterLink,IconComponent],templateUrl:'./enterprise-dashboard.component.html',styleUrl:'./enterprise-dashboard.component.css'})
export class EnterpriseDashboardComponent {
  private http=inject(HttpClient); applications:Application[]=[]; loading=true; error='';
  async ngOnInit(){try{this.applications=await firstValueFrom(this.http.get<Application[]>('/api/v1/applications/'));}catch(error:any){this.error=error.error?.detail||'Impossible de charger vos dossiers.';}finally{this.loading=false;}}
  get certified(){return this.applications.filter(item=>item.status==='CERTIFIED').length;} get active(){return this.applications.filter(item=>!['CERTIFIED','REJECTED'].includes(item.status)).length;} get corrections(){return this.applications.filter(item=>item.status==='CORRECTION_REQUIRED').length;}
  label(status:string){return ({DRAFT:'Brouillon',SUBMITTED:'Soumis',UNDER_REVIEW:'En évaluation',CORRECTION_REQUIRED:'Corrections demandées',DECISION_PENDING:'En décision',CERTIFIED:'Certifié',REJECTED:'Refusé'} as Record<string,string>)[status]||status;}
  action(item:Application){return item.status==='DRAFT'?'documents':item.status==='CORRECTION_REQUIRED'?'non-conformites':'tracking';}
}

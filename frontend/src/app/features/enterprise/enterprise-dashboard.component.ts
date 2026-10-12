import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { apiError, AutoRefresh } from '../../core/api';

type Application={id:number;reference:string;level:string;status:string;status_label:string;domains:string[];created_at:string;updated_at:string;open_non_conformities:number;certificate?:{number:string;effective_status:string;status_label:string;expires_at:string}};
@Component({standalone:true,imports:[RouterLink,IconComponent],templateUrl:'./enterprise-dashboard.component.html',styleUrl:'./enterprise-dashboard.component.css'})
export class EnterpriseDashboardComponent {
  private http=inject(HttpClient); readonly auth=inject(AuthService); applications:Application[]=[]; loading=true; error='';
  private refresher=new AutoRefresh(()=>this.load());
  async ngOnInit(){await this.load();this.refresher.start();}
  ngOnDestroy(){this.refresher.stop();}
  async load(){try{this.applications=await firstValueFrom(this.http.get<Application[]>('/api/v1/applications/'));this.error='';}catch(error){this.error=apiError(error,'Impossible de charger vos dossiers.');}finally{this.loading=false;}}
  get certified(){return this.applications.filter(item=>item.certificate?.effective_status==='VALID').length;}
  get active(){return this.applications.filter(item=>!['CERTIFIED','REJECTED'].includes(item.status)).length;}
  get corrections(){return this.applications.filter(item=>item.status==='CORRECTION_REQUIRED').length;}
  action(item:Application){return item.status==='DRAFT'?'documents':item.status==='CORRECTION_REQUIRED'?'non-conformites':'tracking';}
  /** Le certificat suspendu, révoqué ou expiré prime sur « Certifié ». */
  label(item:Application){return item.certificate&&item.certificate.effective_status!=='VALID'?`Certificat ${item.certificate.status_label.toLowerCase()}`:item.status_label;}
  tone(item:Application){return item.certificate&&item.certificate.effective_status!=='VALID'?item.certificate.effective_status:item.status;}
}

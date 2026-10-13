import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { apiError, AutoRefresh } from '../../core/api';

type Document={id:number;name:string;domain:string;mandatory:boolean;status:string;status_label:string;file_name:string|null;download_url:string|null;review_comment:string};
type Application={id:number;reference:string;status:string;status_label:string;updated_at:string;organization_verified:boolean;documents:Document[]};
@Component({standalone:true,imports:[RouterLink,IconComponent],templateUrl:'./workflow-documents.component.html',styleUrl:'./workflow-documents.component.css'})
export class WorkflowDocumentsComponent {
  private route=inject(ActivatedRoute); private router=inject(Router); private http=inject(HttpClient); readonly auth=inject(AuthService);
  id=Number(this.route.snapshot.paramMap.get('id')); application?:Application; loading=true; message=''; error=false; busy=0; changed=false;
  private refresher=new AutoRefresh(()=>this.load(true));
  async ngOnInit(){await this.load();this.refresher.start();}
  ngOnDestroy(){this.refresher.stop();}
  async load(silent=false){
    if(!silent)this.loading=true;
    try{const fresh=await firstValueFrom(this.http.get<Application>(`/api/v1/applications/${this.id}/`));
      if(silent&&this.application&&fresh.updated_at!==this.application.updated_at)this.changed=true;
      this.application=fresh;}
    catch(error){if(!silent){this.message=apiError(error,'Dossier introuvable ou non autorisé.');this.error=true;}}
    finally{this.loading=false;}
  }
  get editable(){return this.application?.status==='DRAFT'||this.application?.status==='CORRECTION_REQUIRED';}
  canUpload(d:Document){return this.editable&&(this.application?.status==='CORRECTION_REQUIRED'||d.status!=='VALIDATED');}
  get ready(){return !!this.application?.documents.length&&this.application.documents.every(d=>!d.mandatory||d.status==='VALIDATED');}
  async upload(document:Document,event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.busy=document.id;this.message='';this.error=false;const data=new FormData();data.append('file',file);try{await firstValueFrom(this.http.post(`/api/v1/documents/${document.id}/upload/`,data));await this.load(true);this.changed=false;}catch(error){this.message=apiError(error,'Dépôt impossible.');this.error=true;}finally{this.busy=0;input.value='';}}
  async remove(){if(!this.application||!confirm(`Supprimer définitivement le brouillon ${this.application.reference} et ses pièces ?`))return;this.busy=-2;this.message='';this.error=false;
    try{await firstValueFrom(this.http.delete(`/api/v1/applications/${this.application.id}/`));await this.router.navigateByUrl('/espace/tableau-de-bord');}
    catch(error){this.message=apiError(error,'Suppression impossible.');this.error=true;}finally{this.busy=0;}}
  async submit(){if(!this.application)return;this.busy=-1;this.message='';this.error=false;try{await firstValueFrom(this.http.post(`/api/v1/applications/${this.application.id}/submit/`,{}));await this.load(true);this.changed=false;this.message='Dossier soumis pour revue administrative.';}catch(error){this.message=apiError(error,'Les pièces requises doivent être validées avant soumission.');this.error=true;}finally{this.busy=0;}}
}

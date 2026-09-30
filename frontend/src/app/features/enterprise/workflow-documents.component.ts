import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';

type Document={id:number;name:string;domain:string;mandatory:boolean;status:string;file:string|null;review_comment:string};
type Application={id:number;reference:string;status:string;documents:Document[]};
@Component({standalone:true,imports:[RouterLink,IconComponent],templateUrl:'./workflow-documents.component.html',styleUrl:'./workflow-documents.component.css'})
export class WorkflowDocumentsComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient); id=Number(this.route.snapshot.paramMap.get('id')); application?:Application; loading=true; message=''; busy=0;
  async ngOnInit(){await this.load();}
  async load(){this.loading=true;this.message='';try{this.application=await firstValueFrom(this.http.get<Application>(`/api/v1/applications/${this.id}/`));}catch(error:any){this.message=error.error?.detail||'Dossier introuvable ou non autorisé.';}finally{this.loading=false;}}
  async upload(document:Document,event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.busy=document.id;this.message='';const data=new FormData();data.append('file',file);try{await firstValueFrom(this.http.post(`/api/v1/documents/${document.id}/upload/`,data));await this.load();}catch(error:any){this.message=error.error?.file?.[0]||error.error?.detail||'Dépôt impossible.';}finally{this.busy=0;input.value='';}}
  async submit(){if(!this.application)return;this.busy=-1;this.message='';try{await firstValueFrom(this.http.post(`/api/v1/applications/${this.application.id}/submit/`,{}));await this.load();this.message='Dossier soumis pour revue administrative.';}catch(error:any){this.message=error.error?.detail||'Les pièces requises doivent être validées avant soumission.';}finally{this.busy=0;}}
  statusLabel(status:string){return ({MISSING:'À déposer',SUBMITTED:'En revue',VALIDATED:'Validé',REJECTED:'À corriger'} as Record<string,string>)[status]||status;}
}

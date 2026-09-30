import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type NonConformity={id:number;reference:string;domain:string;description:string;severity:string;status:string;response:string};
type Application={id:number;reference:string;status:string;non_conformities:NonConformity[]};

@Component({standalone:true,imports:[FormsModule,RouterLink],templateUrl:'./workflow-corrections.component.html',styleUrl:'./workflow-corrections.component.css'})
export class WorkflowCorrectionsComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient);
  id=Number(this.route.snapshot.paramMap.get('id')); application?:Application; responses:Record<number,string>={}; busy=0; message=''; loading=true;
  async ngOnInit(){await this.load();}
  async load(){this.loading=true;try{this.application=await firstValueFrom(this.http.get<Application>(`/api/v1/applications/${this.id}/`));}catch(error:any){this.message=error.error?.detail||'Dossier introuvable ou non autorisé.';}finally{this.loading=false;}}
  async respond(item:NonConformity){const response=(this.responses[item.id]||'').trim();if(!response){this.message='Veuillez décrire l’action corrective mise en place.';return;}this.busy=item.id;this.message='';try{await firstValueFrom(this.http.post(`/api/v1/applications/${this.id}/respond-correction/`,{non_conformity_id:item.id,response}));await this.load();this.message='Réponse corrective transmise à l’équipe d’évaluation.';}catch(error:any){this.message=error.error?.response?.[0]||error.error?.detail||'Transmission impossible.';}finally{this.busy=0;}}
  label(status:string){return ({OPEN:'À traiter',CORRECTED:'Réponse envoyée',VALIDATED:'Clôturée'} as Record<string,string>)[status]||status;}
}

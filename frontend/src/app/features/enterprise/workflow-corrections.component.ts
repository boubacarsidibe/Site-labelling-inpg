import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiError, AutoRefresh } from '../../core/api';

type NonConformity={id:number;reference:string;domain:string;description:string;severity:string;severity_label:string;status:string;status_label:string;response:string;rejection_reason:string;due_date:string|null};
type Application={id:number;reference:string;status:string;updated_at:string;non_conformities:NonConformity[]};

@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./workflow-corrections.component.html',styleUrl:'./workflow-corrections.component.css'})
export class WorkflowCorrectionsComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient);
  id=Number(this.route.snapshot.paramMap.get('id')); application?:Application; responses:Record<number,string>={}; busy=0; message=''; error=false; loading=true; changed=false;
  private refresher=new AutoRefresh(()=>this.load(true));
  async ngOnInit(){await this.load();this.refresher.start();}
  ngOnDestroy(){this.refresher.stop();}
  async load(silent=false){try{const fresh=await firstValueFrom(this.http.get<Application>(`/api/v1/applications/${this.id}/`));if(silent&&this.application&&fresh.updated_at!==this.application.updated_at)this.changed=true;this.application=fresh;}catch(error){if(!silent){this.message=apiError(error,'Dossier introuvable ou non autorisé.');this.error=true;}}finally{this.loading=false;}}
  overdue(item:NonConformity){return item.status==='OPEN'&&!!item.due_date&&new Date(item.due_date+'T23:59:59')<new Date();}
  async respond(item:NonConformity){const response=(this.responses[item.id]||'').trim();if(!response){this.message='Veuillez décrire l’action corrective mise en place.';this.error=true;return;}this.busy=item.id;this.message='';this.error=false;try{await firstValueFrom(this.http.post(`/api/v1/applications/${this.id}/respond-correction/`,{non_conformity_id:item.id,response}));this.responses[item.id]='';await this.load(true);this.changed=false;this.message='Réponse corrective transmise à l’équipe d’évaluation.';}catch(error){this.message=apiError(error,'Transmission impossible.');this.error=true;}finally{this.busy=0;}}
}

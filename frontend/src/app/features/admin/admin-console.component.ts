import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../shared/components/icon.component';
import { AuthService } from '../../core/services/auth.service';

type Application={id:number;reference:string;organization:number;level:string;status:string;created_at:string;domains:string[]};
type Certificate={id:number;number:string;issued_at:string;status:string;application_id:number;application_reference:string;organization_name:string;label_level:string;domains:string[]};
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent],templateUrl:'./admin-console.component.html',styleUrl:'./admin-console.component.css'})
export class AdminConsoleComponent {
  private route=inject(ActivatedRoute); private http=inject(HttpClient); readonly auth=inject(AuthService);
  applications:Application[]=[]; certificates:Certificate[]=[]; loading=false; error=''; query=''; created=''; accountError=''; username=''; email=''; password=''; role='MANAGER';
  readonly sectionInfo:Record<string,{title:string;subtitle:string;icon:string;description:string}>={
    dashboard:{title:'Tableau de bord',subtitle:'Vue opérationnelle des dossiers autorisés.',icon:'chart',description:'Retrouvez les dossiers accessibles à votre rôle et priorisez les actions nécessaires. Les indicateurs apparaîtront lorsque les données de gestion seront consolidées.'},
    dossiers:{title:'Dossiers',subtitle:'Consultez et orientez les demandes de certification.',icon:'shield',description:'Les dossiers proviennent directement de l’API. Ouvrez un dossier pour examiner son périmètre, ses documents et son avancement.'},
    evaluations:{title:'Évaluations',subtitle:'Organiser l’analyse des exigences.',icon:'check',description:'Le module d’évaluation détaillée sera connecté ici. Il devra conserver les exigences, preuves, constats et la séparation avec la décision.'},
    audits:{title:'Audits',subtitle:'Préparer et tracer les interventions sur site.',icon:'building',description:'Cette page accueillera les plans d’audit, les intervenants, les constats et les comptes rendus reliés à un dossier autorisé.'},
    'non-conformites':{title:'Non-conformités',subtitle:'Suivre les écarts et les actions correctives.',icon:'tool',description:'Les écarts devront être reliés à un dossier, un volet, un responsable, une échéance et des preuves de clôture.'},
    certificats:{title:'Certifications par Label',subtitle:'Registre des certificats délivrés et suivi de leur validité.',icon:'medal',description:'Le Label est attribué lors de la décision sur un dossier certifié. Seul l’administrateur peut suspendre ou réactiver un certificat.'},
    formations:{title:'Formations',subtitle:'Administrer les programmes et les sessions.',icon:'people',description:'Les programmes, sessions, inscriptions et attestations seront gérés ici. Le catalogue public ne présente actuellement que des programmes informatifs.'},
    referentiels:{title:'Référentiels',subtitle:'Gérer les exigences et leurs versions.',icon:'flask',description:'Les administrateurs pourront versionner les volets, exigences, documents attendus et règles de checklist sans modifier les dossiers historiques.'},
    utilisateurs:{title:'Utilisateurs',subtitle:'Créer les comptes internes sous contrôle du superutilisateur.',icon:'people',description:'Les administrateurs, gestionnaires, évaluateurs, auditeurs et décideurs sont des comptes internes. Ils ne peuvent pas être créés par inscription publique.'},
    decisions:{title:'Décision',subtitle:'Préparer la décision de certification.',icon:'medal',description:'La décision doit rester distincte de l’évaluation. La synthèse, les écarts et les éléments de preuve seront disponibles ici lorsque le module de décision sera raccordé.'}
  };
  get path(){const raw=this.route.snapshot.routeConfig?.path||'dashboard'; return raw.startsWith('dossiers')?'dossiers':raw.startsWith('decisions')?'decisions':raw;}
  get section(){return this.sectionInfo[this.path]||this.sectionInfo.dashboard;}
  get filtered(){const q=this.query.trim().toLowerCase();return !q?this.applications:this.applications.filter(a=>[a.reference,a.level,a.status,...a.domains].join(' ').toLowerCase().includes(q));}
  async ngOnInit(){if(['dashboard','dossiers'].includes(this.path))await this.loadApplications();if(this.path==='certificats')await this.loadCertificates();}
  async loadApplications(){this.loading=true;this.error='';try{this.applications=await firstValueFrom(this.http.get<Application[]>('/api/v1/applications/'));}catch(e:any){this.error=e.status===403?'Votre rôle ne permet pas de consulter les dossiers.':'Impossible de charger les dossiers. Vérifiez la connexion à l’API.';}finally{this.loading=false;}}
  async loadCertificates(){this.loading=true;this.error='';try{this.certificates=await firstValueFrom(this.http.get<Certificate[]>('/api/v1/certificates/'));}catch(e:any){this.error=e.status===403?'Votre rôle ne permet pas de gérer les certifications.':'Impossible de charger le registre des certificats.';}finally{this.loading=false;}}
  async updateCertificate(certificate:Certificate,status:string){this.loading=true;this.error='';try{await firstValueFrom(this.http.post(`/api/v1/certificates/${certificate.id}/update-status/`,{status}));await this.loadCertificates();}catch(e:any){this.error=e.error?.detail||'Mise à jour du certificat impossible.';}finally{this.loading=false;}}
  async createAccount(){if(!this.username||!this.email||!this.password)return;this.created='';this.accountError='';try{const response=await firstValueFrom(this.http.post<{username:string;role:string}>('/api/v1/admin/accounts/',{username:this.username,email:this.email,password:this.password,role:this.role}));this.created=`Compte ${response.username} créé avec le rôle ${response.role}.`;this.username='';this.email='';this.password='';}catch(e:any){this.accountError=e.status===403?'Seul un superutilisateur peut créer des comptes internes.':e.error?.detail||'Création impossible.';}}
}

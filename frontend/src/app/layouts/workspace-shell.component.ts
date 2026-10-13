import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { adminAccess, enterpriseAccess } from '../core/auth.guard';
import { IconComponent } from '../shared/components/icon.component';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type Notification={id:number;title:string;body:string;url:string;read_at:string|null;created_at:string};

@Component({selector:'app-workspace-shell',standalone:true,imports:[RouterOutlet,RouterLink,RouterLinkActive,IconComponent],templateUrl:'./workspace-shell-v2.component.html',styleUrl:'./workspace-shell-v2.component.css',styles:['.portal-topbar{height:72px;padding:0 34px}.account-controls{gap:12px}.company-ident{gap:10px;padding:7px 16px 7px 0}.company-ident span{min-width:0}.company-ident strong{font-size:14px}.company-ident small{font-size:11px}.company-ident>app-icon:last-child{display:none}.avatar{width:42px;height:42px;background:#edf5fb;color:#075e9f}.logout{min-height:38px;padding:0 12px;border:1px solid transparent;border-radius:8px;font-size:12px}.logout:hover{border-color:#d7e4ef;background:#f5f9fc}@media(max-width:760px){.portal-topbar{height:64px;padding:0 16px}.account-controls{gap:7px}.company-ident{display:flex;max-width:150px;padding-right:8px;border-right:0}.company-ident>app-icon:first-child{width:20px}.company-ident span{overflow:hidden}.company-ident strong,.company-ident small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.logout{padding:0 7px;font-size:11px}}']})
export class WorkspaceShellComponent {
  auth=inject(AuthService);router=inject(Router);private http=inject(HttpClient);logoutError='';companyName='';
  notifications:Notification[]=[];notificationsOpen=false;notificationsLoading=false;
  async logout(){try{await this.auth.logout();await this.router.navigateByUrl('/connexion');}catch{this.logoutError='Déconnexion impossible. Réessayez.';}}
  @Input() admin=false;
  menuOpen=false;
  companyLinks=[
    {label:'Tableau de bord',path:'tableau-de-bord',icon:'chart'},
    {label:'Mon entreprise',path:'entreprise',icon:'building'},
    {label:'Mes demandes',path:'dossiers',icon:'tool'},
    {label:'Formations',path:'formations',icon:'people'},
    {label:'Mes certifications',path:'certifications',icon:'medal'}
  ];
  adminLinks=[
    {label:'Tableau de bord',path:'dashboard',icon:'chart'},
    {label:'Dossiers',path:'dossiers',icon:'shield'},
    {label:'Évaluations',path:'evaluations',icon:'check'},
    {label:'Audits',path:'audits',icon:'building'},
    {label:'Non-conformités',path:'non-conformites',icon:'tool'},
    {label:'Décisions',path:'decisions',icon:'medal'},
    {label:'Certificats',path:'certificats',icon:'medal'},
    {label:'Formations',path:'formations',icon:'people'},
    {label:'Référentiels',path:'referentiels',icon:'flask'},
    {label:'Utilisateurs',path:'utilisateurs',icon:'people'}
  ];
  get links(){return (this.admin?this.adminLinks:this.companyLinks).filter(link=>this.auth.has((this.admin?adminAccess:enterpriseAccess)[link.path.startsWith('dossiers/')&&link.path!=='dossiers/nouveau'?'dossiers/:id':link.path]));}
  get prefix(){return this.admin?'/admin/':'/espace/'}
  get initials(){return (this.companyName||this.auth.user()?.username||'IN').split(/\s+/).map(item=>item[0]).join('').slice(0,2).toUpperCase();}
  get unreadCount(){return this.notifications.filter(item=>!item.read_at).length;}
  get roleLabel(){return ({ADMIN:'Administrateur',MANAGER:'Gestionnaire',EVALUATOR:'Évaluateur',AUDITOR:'Auditeur',DECISION_MAKER:'Décideur',ENTERPRISE:'Entreprise pétrolière et gazière'} as Record<string,string>)[this.auth.user()?.role||'']||'Compte INPG';}
  async ngOnInit(){
    if(!this.admin){try{const data:any=await firstValueFrom(this.http.get('/api/v1/organizations/'));this.companyName=Array.isArray(data)?data[0]?.legal_name||'':data?.results?.[0]?.legal_name||'';}catch{this.companyName='';}}
    if(this.auth.has('applications.read'))await this.loadNotifications();
  }
  async loadNotifications(){this.notificationsLoading=true;try{this.notifications=await firstValueFrom(this.http.get<Notification[]>('/api/v1/notifications/'));}catch{this.notifications=[];}finally{this.notificationsLoading=false;}}
  async toggleNotifications(){this.notificationsOpen=!this.notificationsOpen;if(this.notificationsOpen)await this.loadNotifications();}
  async openNotification(item:Notification){
    try{if(!item.read_at)await firstValueFrom(this.http.post(`/api/v1/notifications/${item.id}/mark-read/`,{}));}catch{}
    item.read_at=item.read_at||new Date().toISOString();this.notificationsOpen=false;
    let target=item.url;
    if(this.admin&&target.startsWith('/espace/dossiers/'))target=target.replace('/espace/dossiers/','/admin/dossiers/');
    if(target.startsWith('/')&&!target.startsWith('//')&&!target.includes('\\'))await this.router.navigateByUrl(target);
  }
}

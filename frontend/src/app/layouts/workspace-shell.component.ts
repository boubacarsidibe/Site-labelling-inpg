import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { adminAccess, enterpriseAccess } from '../core/auth.guard';
import { IconComponent } from '../shared/components/icon.component';

@Component({selector:'app-workspace-shell',standalone:true,imports:[RouterOutlet,RouterLink,RouterLinkActive,IconComponent],templateUrl:'./workspace-shell.component.html',styleUrl:'./workspace-shell.component.css'})
export class WorkspaceShellComponent {
  auth=inject(AuthService);router=inject(Router);logoutError='';
  async logout(){try{await this.auth.logout();await this.router.navigateByUrl('/connexion');}catch{this.logoutError='Déconnexion impossible. Réessayez.';}}
  @Input() admin=false;
  menuOpen=false;
  companyLinks=[
    {label:'Tableau de bord',path:'tableau-de-bord',icon:'chart'},
    {label:'Mon entreprise',path:'entreprise',icon:'building'},
    {label:'Nouvelle demande',path:'dossiers/nouveau',icon:'tool'},
    {label:'Formations',path:'formations',icon:'people'},
    {label:'Mes certifications',path:'certifications',icon:'medal'}
  ];
  adminLinks=[
    {label:'Tableau de bord',path:'dashboard',icon:'chart'},
    {label:'Dossiers',path:'dossiers',icon:'shield'},
    {label:'Évaluations',path:'evaluations',icon:'check'},
    {label:'Audits',path:'audits',icon:'building'},
    {label:'Non-conformités',path:'non-conformites',icon:'tool'},
    {label:'Certificats',path:'certificats',icon:'medal'},
    {label:'Formations',path:'formations',icon:'people'},
    {label:'Référentiels',path:'referentiels',icon:'flask'},
    {label:'Utilisateurs',path:'utilisateurs',icon:'people'}
  ];
  get links(){return (this.admin?this.adminLinks:this.companyLinks).filter(link=>this.auth.has((this.admin?adminAccess:enterpriseAccess)[link.path.startsWith('dossiers/')&&link.path!=='dossiers/nouveau'?'dossiers/:id':link.path]));}
  get prefix(){return this.admin?'/admin/':'/espace/'}
}

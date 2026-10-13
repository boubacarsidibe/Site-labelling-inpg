import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../shared/components/icon.component';
import { AuthService } from '../core/services/auth.service';
@Component({
  standalone:true, imports:[RouterOutlet,RouterLink,RouterLinkActive,IconComponent],
  templateUrl:'./public-shell.component.html', styleUrl:'./public-shell.component.css',
  styles:['@media(max-width:390px){.auth-register{display:block!important}}']
})
export class PublicShellComponent {
  auth=inject(AuthService); private router=inject(Router); menuOpen=false; logoutError='';
  ngOnInit(){void this.auth.refresh();}
  async logout(){this.logoutError='';try{await this.auth.logout();this.menuOpen=false;await this.router.navigateByUrl('/');}catch{this.logoutError='Déconnexion indisponible. Réessayez.';}}
}

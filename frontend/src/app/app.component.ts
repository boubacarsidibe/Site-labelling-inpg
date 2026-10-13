import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({ selector: 'app-root', standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
export class AppComponent {
  private router=inject(Router);
  private route=inject(ActivatedRoute);
  private title=inject(Title);
  constructor(){
    this.router.events.pipe(filter(event=>event instanceof NavigationEnd)).subscribe(()=>{
      let current=this.route;
      while(current.firstChild)current=current.firstChild;
      const label=current.snapshot.data['title']||this.routeTitle(this.router.url);
      this.title.setTitle(label?`${label} · Label INPG`:'Label INPG');
    });
  }
  private routeTitle(url:string){
    if(url.startsWith('/admin'))return 'Administration';
    if(url.startsWith('/espace'))return 'Espace entreprise';
    if(url.startsWith('/professionnel'))return 'Espace professionnel';
    if(url.startsWith('/connexion'))return 'Connexion';
    if(url.startsWith('/inscription'))return 'Inscription';
    return url==='/'?'Accueil':'';
  }
}

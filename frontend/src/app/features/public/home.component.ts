import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

@Component({standalone:true,imports:[RouterLink,IconComponent],templateUrl:'./home.component.html',styleUrl:'./home.component.css'})
export class HomeComponent {
  stepSlug(title:string){return ({'Demande':'demande','Dossier':'dossier','Évaluation':'evaluation','Correction':'correction','Décision':'decision','Certification':'certification','Suivi':'suivi'} as Record<string,string>)[title]||'';}
  actorSlug(name:string){return name.toLowerCase().replaceAll(' ','-');}
  domains=[
    {name:'Sécurité',slug:'securite',icon:'shield',tone:'blue',text:'Prévenir les risques, protéger les personnes et les biens, garantir des opérations sûres et maîtrisées.'},
    {name:'Qualité',slug:'qualite',icon:'medal',tone:'gold',text:'Des processus fiables pour une meilleure performance et une relation de confiance avec vos partenaires.'},
    {name:'Environnement',slug:'environnement',icon:'leaf',tone:'green',text:'Réduire les impacts, préserver les ressources et contribuer à une activité plus responsable.'}
  ];
  levels=[
    {name:'Standard',tone:'standard',text:'Une première reconnaissance de vos engagements.',count:'1 volet certifié',tag:'Engagement'},
    {name:'Gold',tone:'gold',text:'Une démarche étendue à deux volets complémentaires.',count:'2 volets certifiés',tag:'Performance'},
    {name:'Platinum',tone:'platinum',text:'Un engagement sur l’ensemble des volets du Label.',count:'3 volets certifiés',tag:'Excellence'}
  ];
  steps=[{title:'Demande',text:'Définition de votre périmètre'},{title:'Dossier',text:'Dépôt des pièces justificatives'},{title:'Évaluation',text:'Analyse et audit de conformité'},{title:'Correction',text:'Traitement des écarts relevés'},{title:'Décision',text:'Examen du dossier par l’INPG'},{title:'Certification',text:'Attribution du niveau de label'},{title:'Suivi',text:'Contrôles et renouvellement'}];
  actors=[{name:'Raffinage',icon:'building'},{name:'Transport',icon:'truck'},{name:'Stockage',icon:'building'},{name:'Distribution',icon:'chart'},{name:'Laboratoires',icon:'flask'},{name:'Prestataires techniques',icon:'tool'}];
}

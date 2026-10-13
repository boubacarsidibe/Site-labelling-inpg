import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/components/icon.component';

@Component({standalone:true,imports:[RouterLink,IconComponent],templateUrl:'./explore-v2.component.html',styleUrl:'./explore.component.css'})
export class ExploreComponent {
  private route=inject(ActivatedRoute); private params=toSignal(this.route.paramMap);
  readonly steps=[
    {slug:'demande',name:'Demande',icon:'people',summary:'Présentez l’entreprise, l’activité et le périmètre de votre démarche.',detail:'Cette étape clarifie les sites concernés, les activités couvertes et les volets recherchés. Ces informations servent à proposer un parcours adapté et à éviter que le certificat ne couvre un périmètre non évalué.'},
    {slug:'dossier',name:'Dossier',icon:'building',summary:'Rassemblez les documents et preuves attendus.',detail:'Le dossier regroupe les politiques, procédures, enregistrements et éléments de preuve liés aux volets choisis. Une documentation utile est actuelle, lisible, attribuée à un responsable et reliée aux pratiques réelles.'},
    {slug:'evaluation',name:'Évaluation',icon:'chart',summary:'Les éléments transmis sont examinés au regard du référentiel.',detail:'L’évaluation analyse la cohérence des documents, leur mise en œuvre et la capacité de l’organisation à démontrer ses pratiques. Des échanges ou un audit peuvent compléter l’examen documentaire.'},
    {slug:'correction',name:'Correction',icon:'tool',summary:'Traitez les écarts et présentez vos preuves de correction.',detail:'Chaque écart doit être compris, traité et suivi. L’entreprise formule des actions réalistes, désigne un responsable et fournit les éléments permettant de constater la mise en œuvre.'},
    {slug:'decision',name:'Décision',icon:'medal',summary:'Une décision est prise à partir de la synthèse du dossier.',detail:'La décision examine les résultats de l’évaluation et le traitement des écarts. Elle est distincte de l’évaluation afin que la reconnaissance repose sur une appréciation impartiale.'},
    {slug:'certification',name:'Certification',icon:'check',summary:'Le certificat formalise le niveau et le périmètre reconnus.',detail:'Après une décision favorable, le certificat doit préciser le niveau obtenu et le périmètre auquel il se rapporte. Il ne vaut pas pour les activités ou sites qui n’ont pas été évalués.'},
    {slug:'suivi',name:'Suivi',icon:'leaf',summary:'Maintenez vos pratiques et préparez le renouvellement.',detail:'Le suivi permet de vérifier que la démarche reste vivante malgré les évolutions de l’entreprise. Il encourage le suivi des actions, des incidents, des changements et des opportunités d’amélioration.'}
  ];
  readonly actors=[
    {slug:'raffinage',name:'Raffinage',icon:'building',summary:'Transformation, unités de production et maintenance.',points:['Maîtrise des procédés et de l’intégrité des installations','Prévention des risques industriels et préparation aux urgences','Gestion des émissions, effluents et déchets']},
    {slug:'transport',name:'Transport',icon:'truck',summary:'Déplacement de produits et matières dans la chaîne logistique.',points:['Compétences des équipes et préparation des trajets','Entretien, contrôle et traçabilité des équipements','Gestion des incidents et des situations d’urgence']},
    {slug:'stockage',name:'Stockage',icon:'building',summary:'Dépôts, terminaux et opérations d’expédition.',points:['Prévention des fuites et maîtrise des zones sensibles','Plans d’urgence et exercices adaptés au site','Contrôles des accès, équipements et opérations']},
    {slug:'distribution',name:'Distribution',icon:'chart',summary:'Réseaux, points de vente et mise à disposition des produits.',points:['Sécurité et qualité du service rendu','Gestion des stocks, équipements et produits','Protection des équipes, des clients et de l’environnement']},
    {slug:'laboratoires',name:'Laboratoires',icon:'flask',summary:'Analyse, contrôle et essais au sein de la filière.',points:['Compétences techniques et fiabilité des méthodes','Traçabilité des échantillons, équipements et résultats','Communication claire des résultats d’analyse']},
    {slug:'prestataires-techniques',name:'Prestataires techniques',icon:'tool',summary:'Interventions spécialisées auprès des opérateurs.',points:['Habilitations, compétences et supervision','Préparation des interventions et maîtrise de la coactivité','Retour d’expérience et amélioration des pratiques']}
  ];
  readonly courses=[
    {slug:'hse',name:'Management Santé, Sécurité et Environnement',tag:'HSE',icon:'shield',summary:'Prévenir les risques et piloter une démarche HSE structurée.',modules:['Identifier les dangers et évaluer les risques','Organiser la prévention et les responsabilités','Préparer les réponses aux situations d’urgence']},
    {slug:'qualite',name:'Management de la qualité',tag:'QUALITÉ',icon:'medal',summary:'Structurer les processus et l’amélioration continue.',modules:['Cartographier les processus essentiels','Mettre en place des indicateurs utiles','Traiter les anomalies et les actions correctives']},
    {slug:'environnement',name:'Management environnemental',tag:'ENVIRONNEMENT',icon:'leaf',summary:'Réduire les impacts liés aux activités professionnelles.',modules:['Identifier les aspects et impacts','Gérer les déchets, rejets et consommations','Suivre les plans d’action environnementaux']},
    {slug:'audit',name:'Pratique de l’audit interne',tag:'AUDIT',icon:'chart',summary:'Conduire un audit utile et restituer des constats clairs.',modules:['Préparer le plan d’audit','Recueillir des preuves et mener les entretiens','Suivre les constats et les actions']}
    ,{slug:'incendie',name:'Sécurité incendie et première intervention',tag:'SÉCURITÉ',icon:'shield',summary:'Préparer les équipes à prévenir et maîtriser un départ de feu.',modules:['Prévention et conduite à tenir en cas d’alerte','Choix et utilisation des moyens de première intervention','Organisation des consignes et exercices sur site']}
    ,{slug:'atex',name:'Zones ATEX et opérations de dépotage',tag:'SÉCURITÉ',icon:'tool',summary:'Maîtriser les risques d’atmosphères explosives pendant les opérations sensibles.',modules:['Identifier les zones et sources d’inflammation','Préparer et sécuriser le dépotage','Appliquer la signalisation et les mesures de prévention']}
    ,{slug:'metrologie',name:'Métrologie, contrôle des produits et traçabilité',tag:'QUALITÉ',icon:'flask',summary:'Fiabiliser les mesures, les analyses et les enregistrements de contrôle.',modules:['Étalonnage et suivi des équipements de mesure','Contrôle et analyse des produits pétroliers','Traçabilité des échantillons, résultats et décisions']}
    ,{slug:'iso-17025',name:'Exigences ISO/IEC 17025',tag:'QUALITÉ',icon:'medal',summary:'Structurer la compétence des laboratoires d’essais et d’étalonnages.',modules:['Impartialité et compétences techniques','Maîtrise des méthodes, équipements et données','Traitement des écarts et assurance qualité des résultats']}
    ,{slug:'pollution',name:'Prévention de la pollution et plan d’urgence',tag:'ENVIRONNEMENT',icon:'leaf',summary:'Réduire les impacts, réagir aux déversements et organiser le retour à la normale.',modules:['Kits anti-pollution et premiers gestes','Plan d’opération interne et simulations','Gestion des déchets, eaux souillées et séparateurs']}
    ,{slug:'transport-dangerous',name:'Transport des matières dangereuses',tag:'ENVIRONNEMENT',icon:'truck',summary:'Sécuriser le transport des produits et la gestion des incidents de route.',modules:['Préparation du véhicule, du trajet et des documents','Consignes de conduite et de chargement','Réponse aux incidents et protection de l’environnement']}
  ];
  get type(){return this.route.snapshot.routeConfig?.path?.split('/:')[0]||'demarche';} get key(){return this.params()?.get(this.type==='demarche'?'step':this.type==='acteurs'?'actor':'course');}
  get selected():any{const list=this.type==='demarche'?this.steps:this.type==='acteurs'?this.actors:this.courses;return list.find(item=>item.slug===this.key);}
  get title(){return this.selected?.name||({demarche:'Démarche de certification',acteurs:'Acteurs concernés',formations:'Formations INPG'}[this.type]||'Label INPG');}
  get list():any[]{return this.type==='demarche'?this.steps:this.type==='acteurs'?this.actors:this.courses;}
  scrollToDetail(){
    if(this.type!=='demarche')return;
    setTimeout(()=>document.getElementById('detail-etape')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
  }
}

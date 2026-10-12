import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/components/icon.component';
import { HomeComponent } from './home.component';

@Component({standalone:true,imports:[RouterLink,IconComponent],templateUrl:'./public-detail.component.html',styleUrl:'./public-detail.component.css'})
export class PublicDetailComponent {
  private route=inject(ActivatedRoute);
  private params=toSignal(this.route.paramMap);
  private routeData=toSignal(this.route.data);
  readonly catalog=new HomeComponent();
  readonly faqs=[
    {q:'À qui s’adresse le Label INPG ?',a:'Aux acteurs de l’aval pétrolier et gazier : raffinage, transport, stockage, distribution, laboratoires et prestataires techniques.'},
    {q:'Quelle différence entre Standard, Gold et Platinum ?',a:'Standard correspond à un volet certifié, Gold à deux volets et Platinum aux trois volets : Sécurité, Qualité et Environnement.'},
    {q:'Quelles pièces dois-je préparer ?',a:'La checklist dépend de votre activité et des volets demandés. Elle est présentée pendant la constitution de votre dossier.'},
    {q:'Comment se déroule la certification ?',a:'Le parcours comprend sept étapes : demande, dossier, évaluation, correction, décision, certification et suivi.'},
    {q:'Quelle est la durée de validité ?',a:'Un certificat est valable un an. Avant l’échéance, l’entreprise dépose une demande de renouvellement depuis « Mes certifications ». Un certificat peut être suspendu ou révoqué par l’INPG ; son statut est consultable publiquement.'},
    {q:'Comment vérifier un certificat ?',a:'Saisissez son numéro sur la page « Vérification de certificat » : le registre indique l’entreprise, le niveau, les volets et la validité à ce jour.'}
  ];
  get domain(){return this.catalog.domains.find(d=>d.slug===this.params()?.get('domain'))}
  get title(){return this.domain?.name ?? this.routeData()?.['title'] ?? 'Le Label INPG'}
  get kind(){return this.route.snapshot.url[0]?.path ?? 'label'}
  get description(){
    if(this.domain)return this.domain.text;
    const descriptions:Record<string,string>={
      label:'Une démarche de certification pour des entreprises plus sûres, plus performantes et plus respectueuses de l’environnement.',
      'niveaux-certification':'Trois niveaux de reconnaissance, selon les volets certifiés de votre entreprise.',
      demarche:'De la demande au renouvellement, retrouvez les étapes de votre parcours de certification.',
      acteurs:'Un référentiel adapté aux métiers de l’aval pétrolier et gazier.',
      formations:'Développer les compétences utiles à votre démarche de certification.',
      certifies:'Consultez les certifications publiées et vérifiez leur statut.',
            faq:'Les réponses aux questions essentielles avant de commencer.',
      contact:'Échangez avec l’Institut National du Pétrole et du Gaz.'
    };return descriptions[this.kind] ?? descriptions['label'];
  }
}

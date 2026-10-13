import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/components/icon.component';
import { HomeComponent } from './home.component';

@Component({standalone:true,imports:[RouterLink,IconComponent,FormsModule,DatePipe],templateUrl:'./public-detail-v2.component.html',styleUrl:'./public-detail-v2.component.css'})
export class PublicDetailComponent {
  private route=inject(ActivatedRoute);
  private http=inject(HttpClient);
  private params=toSignal(this.route.paramMap);
  private routeData=toSignal(this.route.data);
  readonly catalog=new HomeComponent();
  readonly faqs=[
    {q:'À qui s’adresse le Label INPG ?',a:'Aux acteurs de l’aval pétrolier et gazier : raffinage, transport, stockage, distribution, laboratoires et prestataires techniques.'},
    {q:'Quelle différence entre Standard, Gold et Platinum ?',a:'Standard correspond à un volet certifié, Gold à deux volets et Platinum aux trois volets : Sécurité, Qualité et Environnement.'},
    {q:'Quelles pièces dois-je préparer ?',a:'La checklist dépend de votre activité et des volets demandés. Elle est présentée pendant la constitution de votre dossier.'},
    {q:'Comment se déroule la certification ?',a:'Le parcours comprend sept étapes : demande, dossier, évaluation, correction, décision, certification et suivi.'},
    {q:'Quelle est la durée de validité ?',a:'Le Label est valable trois ans à compter de sa délivrance. Sa date d’expiration figure sur chaque certificat émis.'}
  ];
  readonly definitions=[
    {title:'Le Label INPG',text:'Un signe distinctif apposé auprès d’une entreprise ou d’un professionnel pour attester la conformité aux exigences de Sécurité, Qualité et Environnement applicables aux activités aval pétrolières et gazières.',icon:'medal'},
    {title:'La certification',text:'La décision formelle prise par l’INPG après l’analyse du dossier, l’évaluation et, si nécessaire, l’audit. Elle attribue, refuse, suspend ou renouvelle le Label.',icon:'check'}
  ];
  readonly responsibilities=[
    {name:'INPG',icon:'building',items:['Publie et maintient le référentiel et les règles applicables.','Organise la revue, l’évaluation, l’audit et la décision.','Délivre, suit, suspend ou renouvelle les certificats.','Propose des formations et reconnaît les compétences.']},
    {name:'Entreprise',icon:'shield',items:['Définit son activité, son périmètre et les volets demandés.','Dépose des preuves exactes et maintient leur validité.','Facilite les audits et traite les non-conformités.','Maintient la conformité pendant toute la durée du Label.']},
    {name:'Professionnel',icon:'people',items:['Suit les formations adaptées à son métier et à ses risques.','Conserve ses attestations, habilitations et certificats nominatifs.','Applique les procédures et contribue aux preuves de l’entreprise.','Actualise ses compétences selon les exigences INPG.']}
  ];
  readonly evidenceByDomain:Record<string,string[]>={
    securite:['Évaluation des risques et plan de prévention à jour.','Registres de formation, habilitations et attestations SST / PSC1.','Procédures d’urgence, rapports d’inspection et suivi de maintenance.','Politique HSE ou SST et preuves de traitement des incidents.'],
    qualite:['Politique, manuel ou procédures qualité applicables.','Fiches d’analyse, contrôles des produits et enregistrements de traçabilité.','Étalonnage des moyens de mesure et suivi des équipements.','Rapports d’audit, non-conformités et actions correctives.'],
    environnement:['Autorisations ICPE, EIE / PGES lorsque le site est concerné.','Registres des déchets, eaux, effluents, rejets et émissions.','Plan anti-pollution, plan d’opération interne et exercices.','Audits environnementaux, analyses et entretien des séparateurs.']
  };
  certificateNumber=''; certificate:any=null; verificationError=''; verifying=false;
  ngOnInit(){
    if(this.kind!=='verification-certificat')return;
    this.certificateNumber=this.route.snapshot.queryParamMap.get('number')?.trim()||'';
    if(this.certificateNumber)void this.verifyCertificate();
  }
  async verifyCertificate(){
    const number=this.certificateNumber.trim();
    if(!number){this.verificationError='Saisissez le numéro du certificat.';return;}
    this.verifying=true;this.verificationError='';this.certificate=null;
    try{const result=await firstValueFrom(this.http.get<any>('/api/v1/certificates/verify/',{params:{number}}));if(!result.found)this.verificationError='Aucun certificat ne correspond à ce numéro.';else this.certificate=result;}
    catch{this.verificationError='La vérification est momentanément indisponible.';}
    finally{this.verifying=false;}
  }
  get domain(){return this.catalog.domains.find(d=>d.slug===this.params()?.get('domain'))}
  get evidence(){return this.domain?this.evidenceByDomain[this.domain.slug]??[]:[]}
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
      'verification-certificat':'Vérifiez le statut d’un certificat à partir de son numéro ou de son QR code.',
      faq:'Les réponses aux questions essentielles avant de commencer.',
      contact:'Échangez avec l’Institut National du Pétrole et du Gaz.'
    };return descriptions[this.kind] ?? descriptions['label'];
  }
}

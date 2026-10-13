import { Injectable } from '@angular/core';
import { Domain } from '../models/platform.models';

export type ActorType = 'Raffinage' | 'Transport' | 'Stockage' | 'Distribution' | 'Laboratoire' | 'Prestataire technique';
export interface RequiredDocument { name: string; domain: Domain; mandatory: boolean; status: 'Non déposé' | 'Déposé' | 'Validé'; }

@Injectable({ providedIn: 'root' })
export class ReferentialService {
  checklist(actor: ActorType, domains: Domain[]): RequiredDocument[] {
    const common: Record<Domain, string[]> = {
      'Sécurité': ['Évaluation des risques professionnels', 'Registre de formation et information du personnel', 'Certificat SST ou PSC1 en cours de validité', 'Politique SST ou procédures HSE documentées'],
      'Qualité': ['Politique qualité', 'Procédures et modes opératoires', 'Registre de traçabilité des produits et opérations', 'Registre des non-conformités et actions correctives', 'Rapport d’audit interne'],
      'Environnement': ['Registre de gestion des déchets dangereux', 'Plan d’urgence anti-pollution', 'Rapport d’audit environnemental ou suivi environnemental', 'Registre de suivi des eaux, effluents ou rejets']
    };
    const conditional: Partial<Record<ActorType,Partial<Record<Domain,string[]>>>> = {
      Raffinage:{'Sécurité':['Preuve ISO 45001 ou système SST documenté'],'Qualité':['Certificats d’analyse des produits et fiches techniques'],'Environnement':['Autorisation ICPE et EIE PGES si applicable','Plan d’opération interne POI et comptes rendus d’exercices']},
      Transport:{'Sécurité':['Attestation de sensibilisation ATEX'],'Qualité':['Certificat de conformité du véhicule citerne'],'Environnement':['Inventaire du kit anti-pollution embarqué','Attestation de formation au transport de matières dangereuses']},
      Stockage:{'Sécurité':['Certificat d’étanchéité des réservoirs'],'Qualité':['Registre métrologique et certificats d’étalonnage'],'Environnement':['Plan technique et certificat d’entretien du séparateur d’hydrocarbures']},
      Distribution:{'Sécurité':['Autorisation d’exploitation en cours de validité','Certificat de conformité des installations','Attestation de sensibilisation ATEX'],'Qualité':['Certificats d’analyse ou rapports d’essais des produits'],'Environnement':['Certificat d’installation des cuves et registre du séparateur d’hydrocarbures']},
      Laboratoire:{'Qualité':['Accréditation ISO IEC 17025 ou rapports d’essais','Certificats d’étalonnage des équipements de mesure']},
      'Prestataire technique':{'Sécurité':['Attestation d’habilitation technique'],'Qualité':['Preuve de compétence et procédures de prestation']}
    };
    return domains.flatMap(domain=>[...common[domain],...(conditional[actor]?.[domain]||[])].map(name=>({name,domain,mandatory:true,status:'Non déposé' as const})));
  }
}

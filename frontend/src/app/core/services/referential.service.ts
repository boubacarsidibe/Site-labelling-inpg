import { Injectable } from '@angular/core';
import { Domain } from '../models/platform.models';

export type ActorType = 'Raffinage' | 'Transport' | 'Stockage' | 'Distribution' | 'Laboratoire' | 'Prestataire technique';
export interface RequiredDocument { name: string; domain: Domain; mandatory: boolean; status: 'Non déposé' | 'Déposé' | 'Validé'; }

@Injectable({ providedIn: 'root' })
export class ReferentialService {
  checklist(actor: ActorType, domains: Domain[]): RequiredDocument[] {
    const common: Record<Domain, string[]> = {
      'Sécurité': ['Politique HSE signée', 'Plan de prévention des risques', 'Rapport d’audit interne'],
      'Qualité': ['Politique qualité', 'Procédure de contrôle', 'Registre des non-conformités'],
      'Environnement': ['Plan de gestion environnementale', 'Suivi des déchets', 'Plan d’urgence environnemental']
    };
    const conditional: Partial<Record<ActorType, string>> = { Distribution: 'Autorisation réglementaire de distribution', Transport: 'Attestation transport de matières dangereuses', Laboratoire: 'Certificat ISO/IEC 17025', Stockage: 'Étude de dangers du site', Raffinage: 'Plan de maîtrise des procédés', 'Prestataire technique': 'Attestation d’habilitation technique' };
    return domains.flatMap(domain => common[domain].map(name => ({ name, domain, mandatory: true, status: (name.includes('Politique') ? 'Validé' : 'Non déposé') as RequiredDocument['status'] }))).concat(conditional[actor] ? [{ name: conditional[actor]!, domain: domains[0], mandatory: true, status: 'Non déposé' as const }] : []);
  }
}

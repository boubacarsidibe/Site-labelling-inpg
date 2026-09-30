import { Injectable } from '@angular/core';
import { Application, Certificate, NonConformity } from '../models/platform.models';
@Injectable({ providedIn: 'root' })
export class MockDataService {
  readonly applications: Application[] = [{ reference: 'INPG-2026-001', type: 'Certification initiale', level: 'Gold', status: 'En évaluation', submittedAt: '10/03/2026', domains: ['Sécurité', 'Qualité'] }, { reference: 'INPG-2025-012', type: 'Renouvellement', level: 'Standard', status: 'Certifié', submittedAt: '15/10/2025', domains: ['Sécurité'] }];
  readonly certificates: Certificate[] = [{ number: 'CERT-INPG-2025-012', level: 'Gold', issuedAt: '25/04/2025', expiresAt: '25/04/2028', status: 'Valide', domains: ['Sécurité', 'Qualité'] }];
  readonly nonConformities: NonConformity[] = [{ reference: 'NC-01', domain: 'Sécurité', description: 'Plan d’évacuation à compléter', severity: 'Majeure', dueAt: '18/05/2026', status: 'En correction' }, { reference: 'NC-02', domain: 'Qualité', description: 'Procédure de contrôle à formaliser', severity: 'Mineure', dueAt: '28/05/2026', status: 'Ouverte' }];
}

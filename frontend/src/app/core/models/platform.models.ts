export type ApplicationStatus = 'Brouillon' | 'Soumis' | 'En évaluation' | 'Complément demandé' | 'Correction' | 'En décision' | 'Certifié' | 'Refusé';
export type Domain = 'Sécurité' | 'Qualité' | 'Environnement';
export interface Application { reference: string; type: string; level: 'Standard' | 'Gold' | 'Platinum'; status: ApplicationStatus; submittedAt: string; domains: Domain[]; }
export interface Certificate { number: string; level: Application['level']; issuedAt: string; expiresAt: string; status: 'Valide' | 'Expire bientôt'; domains: Domain[]; }
export interface NonConformity { reference: string; domain: Domain; description: string; severity: 'Mineure' | 'Majeure' | 'Critique'; dueAt: string; status: string; }

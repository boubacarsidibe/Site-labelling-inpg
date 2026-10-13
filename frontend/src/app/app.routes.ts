import { Routes } from '@angular/router';
import { RegisterV2Component } from './features/public/register-v2.component';
import { ProfessionalComponent } from './features/public/professional.component';
import { sessionGuard, childAccessGuard } from './core/auth.guard';
import { LoginComponent, ForbiddenComponent } from './features/public/login.component';
import { PublicShellComponent } from './layouts/public-shell.component';
import { EnterpriseShellComponent } from './layouts/enterprise-shell.component';
import { AdminShellComponent } from './layouts/admin-shell.component';
import { PublicDetailComponent } from './features/public/public-pages.component';
import { ExploreComponent } from './features/public/explore.component';
import { HomeComponent } from './features/public/home.component';
import { CertificationFormComponent, CertificationTrackingComponent } from './features/enterprise/certification-pages.component';
import { WorkflowDocumentsComponent } from './features/enterprise/workflow-documents.component';
import { WorkflowCorrectionsComponent } from './features/enterprise/workflow-corrections.component';
import { EnterpriseDashboardComponent } from './features/enterprise/enterprise-dashboard.component';
import { EnterpriseProfileComponent } from './features/enterprise/enterprise-profile.component';
import { EnterpriseCertificatesComponent } from './features/enterprise/enterprise-certificates.component';
import { EnterpriseTrainingsComponent } from './features/enterprise/enterprise-trainings.component';
import { AdminConsoleComponent } from './features/admin/admin-console.component';
import { AdminWorkflowComponent } from './features/admin/admin-workflow.component';
import { ReferentialsComponent } from './features/admin/referentials.component';
import { EvaluationsComponent } from './features/admin/evaluations.component';
import { TrainingCreateComponent } from './features/admin/training-create.component';

export const routes: Routes = [
  {path:'inscription',component:RegisterV2Component},
  {path:'professionnel/formations',component:EnterpriseTrainingsComponent,canActivate:[sessionGuard],data:{capability:'trainings.read'}},
  {path:'professionnel',component:ProfessionalComponent,canActivate:[sessionGuard],data:{capability:'portal.professional'}},
  {path:'connexion',component:LoginComponent},
  {path:'acces-refuse',component:ForbiddenComponent},
  { path: '', component: PublicShellComponent, children: [
    { path: '', component: HomeComponent },
    { path: 'label', component: PublicDetailComponent, data: { title: 'Le Label INPG' } },
    { path: 'label/:domain', component: PublicDetailComponent, data: { title: 'Volet du Label' } },
    { path: 'niveaux-certification', component: PublicDetailComponent, data: { title: 'Niveaux de certification' } },
    { path: 'demarche', component: ExploreComponent },
    { path: 'demarche/:step', component: ExploreComponent },
    { path: 'acteurs', component: ExploreComponent },
    { path: 'acteurs/:actor', component: ExploreComponent },
    { path: 'formations', component: ExploreComponent },
    { path: 'formations/:course', component: ExploreComponent },
    { path: 'verification-certificat', component: PublicDetailComponent, data: { title: 'Vérification de certificat' } },
    { path: 'faq', component: PublicDetailComponent, data: { title: 'Questions fréquentes' } },
    { path: 'contact', component: PublicDetailComponent, data: { title: 'Contact' } }
  ] },
  { path: 'espace', component: EnterpriseShellComponent, canActivate:[sessionGuard],canActivateChild:[childAccessGuard],data:{capability:'portal.enterprise'}, children: [
    { path: 'tableau-de-bord', component: EnterpriseDashboardComponent }, { path: 'entreprise', component: EnterpriseProfileComponent },
    { path: 'dossiers', component: EnterpriseDashboardComponent }, { path: 'dossiers/nouveau', component: CertificationFormComponent }, { path: 'dossiers/:id/documents', component: WorkflowDocumentsComponent },
    { path: 'dossiers/:id/non-conformites', component: WorkflowCorrectionsComponent }, { path: 'dossiers/:id', component: CertificationTrackingComponent },
    { path: 'certifications', component: EnterpriseCertificatesComponent }, { path: 'formations', component: EnterpriseTrainingsComponent }, { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' }
  ] },
  { path: 'admin', component: AdminShellComponent, canActivate:[sessionGuard],canActivateChild:[childAccessGuard],data:{capability:'portal.admin'}, children: [
    { path: 'dashboard', component: AdminConsoleComponent }, { path: 'dossiers', component: AdminConsoleComponent },
    { path: 'dossiers/:id', component: AdminWorkflowComponent }, { path: 'evaluations', component: EvaluationsComponent },
    { path: 'audits', component: AdminConsoleComponent }, { path: 'non-conformites', component: AdminConsoleComponent },
    { path: 'decisions', component: AdminConsoleComponent }, { path: 'decisions/:id', component: AdminWorkflowComponent }, { path: 'certificats', component: AdminConsoleComponent },
    { path: 'formations/nouvelle', component: TrainingCreateComponent }, { path: 'formations', component: AdminConsoleComponent }, { path: 'referentiels', component: ReferentialsComponent },
    { path: 'utilisateurs', component: AdminConsoleComponent }, { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
  ] }, { path: '**', redirectTo: '' }
];

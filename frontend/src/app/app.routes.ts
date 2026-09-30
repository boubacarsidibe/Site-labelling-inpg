import { Routes } from '@angular/router';
import { RegisterComponent } from './features/public/register.component';
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
import { DashboardComponent, EnterpriseDetailComponent, DocumentsComponent, NonConformitiesComponent, CertificatesComponent, TrainingsComponent } from './features/enterprise/enterprise-pages.component';
import { AdminConsoleComponent } from './features/admin/admin-console.component';
import { AdminWorkflowComponent } from './features/admin/admin-workflow.component';

export const routes: Routes = [
  {path:'inscription',component:RegisterComponent},
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
    { path: 'tableau-de-bord', component: EnterpriseDashboardComponent }, { path: 'entreprise', component: EnterpriseDetailComponent },
    { path: 'dossiers/nouveau', component: CertificationFormComponent }, { path: 'dossiers/:id/documents', component: WorkflowDocumentsComponent },
    { path: 'dossiers/:id/non-conformites', component: WorkflowCorrectionsComponent }, { path: 'dossiers/:id', component: CertificationTrackingComponent },
    { path: 'certifications', component: CertificatesComponent }, { path: 'formations', component: TrainingsComponent }, { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' }
  ] },
  { path: 'admin', component: AdminShellComponent, canActivate:[sessionGuard],canActivateChild:[childAccessGuard],data:{capability:'portal.admin'}, children: [
    { path: 'dashboard', component: AdminConsoleComponent }, { path: 'dossiers', component: AdminConsoleComponent },
    { path: 'dossiers/:id', component: AdminWorkflowComponent }, { path: 'evaluations', component: AdminConsoleComponent },
    { path: 'audits', component: AdminConsoleComponent }, { path: 'non-conformites', component: AdminConsoleComponent },
    { path: 'decisions/:id', component: AdminConsoleComponent }, { path: 'certificats', component: AdminConsoleComponent },
    { path: 'formations', component: AdminConsoleComponent }, { path: 'referentiels', component: AdminConsoleComponent },
    { path: 'utilisateurs', component: AdminConsoleComponent }, { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
  ] }, { path: '**', redirectTo: '' }
];

import { test, expect, Page } from '@playwright/test';
import { actor, login, PASSWORD, PDF } from './helpers';

// Parcours complet, chaque acteur dans sa propre session :
// inscription → brouillon et pièces → vérification et revue → soumission → évaluation, audit,
// non-conformité → décision partielle (niveau calculé) → registre public.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const company = { user: `e2e.ent.${run}`, name: `Dépôt E2E ${run}`, ninea: `E2E${run}` };
let dossier = '';
let certificate = '';
let enterprise: Page, manager: Page, evaluator: Page, auditor: Page, decider: Page;

test.afterAll(async () => { for (const p of [enterprise, manager, evaluator, auditor, decider]) await p?.context().close(); });

test('une entreprise s’inscrit avec son activité', async ({ page }) => {
  await page.goto('/inscription');
  await page.locator('input[value=ENTERPRISE]').check();
  await page.locator('input[name=first_name]').fill('Awa');
  await page.locator('input[name=last_name]').fill('Ndiaye');
  await page.locator('input[name=email]').fill(`${company.user}@example.test`);
  await page.locator('input[name=username]').fill(company.user);
  await page.locator('input[name=legal_name]').fill(company.name);
  await page.locator('input[name=ninea]').fill(company.ninea);
  await page.locator('select[name=activity]').selectOption('Stockage');
  await expect(page.getByText('seront vérifiés par l’INPG')).toBeVisible();
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.locator('input[name=confirm]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Votre compte a été créé')).toBeVisible();
});

test('l’entreprise prépare un brouillon et dépose ses pièces', async ({ browser }) => {
  enterprise = await actor(browser, company.user);
  await expect(enterprise).toHaveURL(/\/espace\/tableau-de-bord/);
  await enterprise.goto('/espace/dossiers/nouveau');
  await expect(enterprise.getByText('n’est pas encore vérifiée')).toBeVisible();
  await enterprise.locator('select[name=activity]').selectOption('Stockage');
  await enterprise.locator('.domain-options label', { hasText: 'Sécurité' }).locator('input').check();
  await enterprise.locator('.domain-options label', { hasText: 'Qualité' }).locator('input').check();
  await expect(enterprise.locator('.level-summary')).toContainText('Gold');
  await expect(enterprise.locator('.document-list li').first()).toBeVisible();
  await enterprise.locator('input[name=scope]').fill('Dépôt de test');
  await enterprise.getByRole('button', { name: /Créer le brouillon/ }).click();
  await expect(enterprise).toHaveURL(/\/espace\/dossiers\/\d+\/documents/);
  dossier = enterprise.url().match(/dossiers\/(\d+)/)![1];

  const pieces = enterprise.locator('.documents article');
  const count = await pieces.count();
  expect(count).toBeGreaterThan(3);
  for (let i = 0; i < count; i++) {
    await pieces.nth(i).locator('input[type=file]').setInputFiles(PDF);
    await expect(pieces.nth(i).getByRole('link', { name: /Télécharger/ })).toBeVisible();
  }
  // Soumission impossible tant que l'organisation n'est pas vérifiée et les pièces validées.
  await expect(enterprise.getByRole('button', { name: /Soumettre le dossier/ })).toBeDisabled();
});

test('le gestionnaire vérifie l’organisation et valide les pièces du brouillon', async ({ browser }) => {
  manager = await actor(browser, 'e2e.gest');
  await manager.goto('/admin/dossiers');
  await manager.getByPlaceholder(/Rechercher/).fill(company.name);
  await manager.getByRole('link', { name: /Ouvrir/ }).click();
  await expect(manager).toHaveURL(new RegExp(`/admin/dossiers/${dossier}$`));
  await manager.getByRole('button', { name: 'Vérifier l’organisation' }).click();
  await expect(manager.getByText('Organisation vérifiée')).toBeVisible();
  const validate = manager.getByRole('button', { name: 'Valider', exact: true });
  while (await validate.count()) {
    const before = await validate.count();
    await validate.first().click();
    await expect(validate).toHaveCount(before - 1);
  }
  // Refuser une pièce sans commentaire est impossible : le bouton n'existe plus, toutes sont validées.
  await expect(manager.locator('.document-row .chip', { hasText: 'Validé' }).first()).toBeVisible();
});

test('l’entreprise est notifiée à l’écran et soumet son dossier', async () => {
  // Rafraîchissement automatique : la page ouverte voit les validations sans rechargement manuel.
  await expect(enterprise.getByText('L’INPG vient de mettre à jour ce dossier')).toBeVisible({ timeout: 45_000 });
  await enterprise.getByRole('button', { name: /Soumettre le dossier/ }).click();
  await expect(enterprise.locator('.page-head')).toContainText('Soumis');
});

test('le gestionnaire ouvre l’évaluation, affecte et planifie l’audit', async () => {
  await manager.reload();
  await manager.getByRole('button', { name: /Démarrer l’évaluation/ }).click();
  await expect(manager.locator('.state .chip')).toHaveText('En évaluation');
  const selects = manager.locator('.action-grid select');
  await selects.nth(0).selectOption({ label: 'e2e.eval' });
  await manager.getByRole('button', { name: 'Affecter' }).click();
  await expect(manager.getByText('Évaluateur affecté.')).toBeVisible();
  await selects.nth(1).selectOption({ label: 'e2e.audit' });
  await manager.getByLabel('Date et heure de l’audit').fill('2027-01-15T09:30');
  await manager.getByRole('button', { name: 'Planifier' }).click();
  await expect(manager.getByRole('status').filter({ hasText: 'Audit planifié' })).toBeVisible();
});

test('l’auditeur rédige le compte rendu', async ({ browser }) => {
  auditor = await actor(browser, 'e2e.audit');
  await auditor.goto(`/admin/dossiers/${dossier}`);
  await auditor.getByPlaceholder(/Constats/).fill('Visite du dépôt : bacs de rétention conformes.');
  await auditor.getByRole('button', { name: 'Enregistrer le compte rendu' }).click();
  await expect(auditor.getByText('Compte rendu d’audit enregistré.')).toBeVisible();
});

test('l’évaluateur signale une non-conformité, l’entreprise y répond', async ({ browser }) => {
  evaluator = await actor(browser, 'e2e.eval');
  await evaluator.goto(`/admin/dossiers/${dossier}`);
  await evaluator.getByPlaceholder(/Décrivez l’écart/).fill('Plan d’urgence non daté.');
  await evaluator.getByRole('button', { name: 'Créer la non-conformité' }).click();
  await expect(evaluator.locator('.state .chip')).toHaveText('Corrections demandées');

  await enterprise.goto(`/espace/dossiers/${dossier}/non-conformites`);
  await expect(enterprise.getByText('Plan d’urgence non daté.')).toBeVisible();
  await enterprise.getByPlaceholder(/Expliquez les mesures/).fill('Plan d’urgence daté et signé le 10/10.');
  await enterprise.getByRole('button', { name: 'Transmettre la correction' }).click();
  await expect(enterprise.locator('.correction .chip', { hasText: 'Corrigée' })).toBeVisible();
});

test('l’évaluateur clôture la correction et transmet en décision', async () => {
  await evaluator.reload();
  await evaluator.getByRole('button', { name: 'Clôturer' }).click();
  await expect(evaluator.locator('.state .chip')).toHaveText('En évaluation');
  await evaluator.getByRole('button', { name: /Transmettre en décision/ }).click();
  await expect(evaluator.locator('.state .chip')).toHaveText('En décision');
});

test('le décideur accorde un seul volet : niveau Standard, certificat d’un an', async ({ browser }) => {
  decider = await actor(browser, 'e2e.decid');
  await decider.goto(`/admin/dossiers/${dossier}`);
  await expect(decider.getByText('Niveau accordé : Gold')).toBeVisible();
  await decider.locator('label.chip', { hasText: 'Qualité' }).locator('input').uncheck();
  await expect(decider.getByText('Niveau accordé : Standard')).toBeVisible();
  // Un refus sans motif est bloqué côté interface.
  await decider.getByRole('button', { name: 'Refuser' }).click();
  await expect(decider.getByText('Le motif du refus est obligatoire')).toBeVisible();
  await decider.getByPlaceholder(/Synthèse de la décision/).fill('Volet Sécurité conforme ; Qualité à consolider.');
  await decider.getByRole('button', { name: 'Émettre le certificat Standard' }).click();
  await expect(decider.locator('.state .chip').first()).toHaveText('Certifié');
  certificate = (await decider.locator('.certificate strong').innerText()).match(/CERT-INPG-[0-9A-F]+/)![0];
  const expected = new Date(); expected.setFullYear(expected.getFullYear() + 1);
  await expect(decider.locator('.certificate')).toContainText(expected.getFullYear().toString());
});

test('le certificat est vérifiable publiquement et visible par l’entreprise', async ({ page }) => {
  await page.goto(`/verification-certificat?numero=${certificate}`);
  await expect(page.locator('.result')).toContainText(company.name);
  await expect(page.locator('.result')).toContainText('Standard');
  await expect(page.locator('.result .chip')).toHaveText('Valide');

  await enterprise.goto('/espace/certifications');
  await expect(enterprise.getByText(certificate)).toBeVisible();
  await enterprise.goto(`/espace/dossiers/${dossier}`);
  await expect(enterprise.locator('.notice.success')).toContainText('Volet Sécurité conforme');
});

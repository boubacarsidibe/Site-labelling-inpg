import { test, expect, Page } from '@playwright/test';
import { actor, login, PASSWORD } from './helpers';

// Audit rôle par rôle de l'interface : menus visibles et parcours propres à chaque compte.
const MENUS: Record<string, string[]> = {
  'e2e.gest': ['Tableau de bord', 'Dossiers', 'Évaluations', 'Audits', 'Non-conformités', 'Certificats'],
  'e2e.eval': ['Tableau de bord', 'Dossiers', 'Évaluations', 'Audits', 'Non-conformités'],
  'e2e.audit': ['Tableau de bord', 'Dossiers', 'Audits', 'Non-conformités'],
  'e2e.decid': ['Tableau de bord', 'Dossiers', 'Évaluations', 'Audits', 'Non-conformités', 'Certificats'],
  'e2e.admin': ['Tableau de bord', 'Dossiers', 'Évaluations', 'Audits', 'Non-conformités', 'Certificats', 'Référentiels', 'Utilisateurs'],
};
const menu = (page: Page) => page.locator('.portal-sidebar nav a');

for (const [user, links] of Object.entries(MENUS)) {
  test(`menu de ${user} : exactement ses pages, toutes accessibles`, async ({ browser }) => {
    const page = await actor(browser, user);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(menu(page)).toHaveText(links);
    for (const label of links) {
      await menu(page).filter({ hasText: label }).click();
      await expect(page).not.toHaveURL(/acces-refuse/);
      await expect(page.locator('.notice.error')).toHaveCount(0);
    }
    await page.context().close();
  });
}

test('l’entreprise modifie puis supprime un brouillon', async ({ page, request }) => {
  const run = Date.now().toString(36);
  await request.get('/api/v1/auth/csrf/');
  const token = (await request.storageState()).cookies.find(c => c.name === 'csrftoken')!.value;
  const r = await request.post('/api/v1/auth/register/', { headers: { 'X-CSRFToken': token }, data: { kind: 'ENTERPRISE', first_name: 'Moussa', last_name: 'Fall', email: `brouillon.${run}@example.test`, username: `e2e.brouillon.${run}`, password: PASSWORD, legal_name: `Brouillon ${run}`, ninea: `BR${run}`, activity: 'Transport' } });
  expect(r.ok()).toBeTruthy();
  await login(page, `e2e.brouillon.${run}`);
  await page.goto('/espace/dossiers/nouveau');
  await page.locator('.domain-options label', { hasText: 'Sécurité' }).locator('input').check();
  await page.locator('.domain-options label', { hasText: 'Environnement' }).locator('input').check();
  await page.getByRole('button', { name: /Créer le brouillon/ }).click();
  await expect(page).toHaveURL(/\/documents$/);
  const before = await page.locator('.documents article').count();

  await page.getByRole('link', { name: 'Modifier le brouillon' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modifier le brouillon');
  await expect(page.locator('.level-summary')).toContainText('Gold');
  await page.locator('.domain-options label', { hasText: 'Environnement' }).locator('input').uncheck();
  await expect(page.getByText('Volet(s) retiré(s) : Environnement')).toBeVisible();
  await page.getByRole('button', { name: /Enregistrer les modifications/ }).click();
  await expect(page).toHaveURL(/\/documents$/);
  await expect(page.locator('.documents article')).not.toHaveCount(before);
  await expect(page.locator('.doc-domain', { hasText: 'Environnement' })).toHaveCount(0);

  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Supprimer le brouillon' }).click();
  await expect(page).toHaveURL(/\/espace\/tableau-de-bord/);
});

test('chaque compte peut changer son mot de passe', async ({ page }) => {
  await login(page, 'e2e.mdp');
  await page.getByRole('link', { name: 'Mot de passe' }).click();
  await page.locator('input[name=current]').fill('pas-le-bon');
  await page.locator('input[name=password]').fill('Nouveau-e2e-2026!');
  await page.locator('input[name=confirm]').fill('Nouveau-e2e-2026!');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');
  await page.locator('input[name=current]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByRole('status')).toHaveText('Mot de passe modifié.');
  await page.context().clearCookies();
  await login(page, 'e2e.mdp', 'Nouveau-e2e-2026!');
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});

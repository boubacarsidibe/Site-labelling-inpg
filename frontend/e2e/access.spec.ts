import { test, expect } from '@playwright/test';
import { actor, login } from './helpers';

test('menus et accès selon le rôle', async ({ browser }) => {
  const manager = await actor(browser, 'e2e.gest');
  const menu = manager.locator('nav, aside').first();
  await expect(menu.getByRole('link', { name: 'Dossiers' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Référentiels' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Formations' })).toHaveCount(0);
  await manager.goto('/admin/referentiels');
  await expect(manager).toHaveURL(/\/acces-refuse/);
  await manager.context().close();

  const decider = await actor(browser, 'e2e.decid');
  await decider.goto('/espace/tableau-de-bord');
  await expect(decider).toHaveURL(/\/acces-refuse/);
  await decider.context().close();
});

test('retour à la page demandée après connexion', async ({ page }) => {
  await page.goto('/admin/audits');
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto('/connexion?returnUrl=%2Fadmin%2Faudits');
  await page.locator('input[name=username]').fill('e2e.audit');
  await page.locator('input[name=password]').fill(process.env['E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/admin\/audits$/);
});

test('une session expirée renvoie à la connexion avec un message', async ({ page }) => {
  await login(page, 'e2e.gest');
  await page.goto('/admin/dossiers');
  await expect(page.getByRole('heading', { name: 'Dossiers' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.context().clearCookies();
  await page.getByRole('link', { name: 'Audits' }).click();
  await expect(page).toHaveURL(/\/connexion\?.*expiree=1/);
  await expect(page.getByText('Votre session a expiré')).toBeVisible();
});

test('mauvais identifiants et mot de passe oublié', async ({ page }) => {
  await page.goto('/connexion');
  await page.locator('input[name=username]').fill('e2e.gest');
  await page.locator('input[name=password]').fill('pas-le-bon');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Identifiants incorrects.');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await page.locator('input[name=email]').fill('inconnu@example.test');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  await expect(page.getByText('Si un compte correspond')).toBeVisible();
});

test('registre public : numéro inconnu et invitation invalide', async ({ page }) => {
  await page.goto('/verification-certificat');
  await page.getByPlaceholder('Numéro du certificat').fill('CERT-INPG-INCONNU');
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page.getByRole('alert')).toHaveText('Aucun certificat ne porte ce numéro.');
  await page.goto('/invitation/jeton-invalide');
  await expect(page.getByRole('alert')).toContainText('Invitation invalide');
});

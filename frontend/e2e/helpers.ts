import { Browser, Page, expect } from '@playwright/test';

export const PASSWORD = process.env['E2E_PASSWORD'] as string;
export const INTERNAL = { 'e2e.gest': 'MANAGER', 'e2e.eval': 'EVALUATOR', 'e2e.audit': 'AUDITOR', 'e2e.decid': 'DECISION_MAKER', 'e2e.admin': 'ADMIN', 'e2e.mdp': 'AUDITOR' } as const;

export async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto('/connexion');
  await page.locator('input[name=username]').fill(username);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

/** Une session de navigateur par acteur, comme plusieurs personnes travaillant en parallèle. */
export async function actor(browser: Browser, username: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, username);
  return page;
}

export const PDF = { name: 'piece.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') };

import { expect, type Locator, type Page } from '@playwright/test';

export const DEMO_OTP = '123456';
export const DEMO_PIN = '1234';

/** Onboarding → connexion démo (OTP + PIN) → accueil. */
export async function login(page: Page) {
  await page.goto('/');
  await page.getByText('Déjà inscrit ?').click({ timeout: 15_000 });
  await page.getByLabel('Numéro de téléphone').fill('0707000000');
  await page.getByText('Recevoir le code OTP').click();
  await page.getByLabel('Code reçu par SMS').last().fill(DEMO_OTP);
  await page.getByLabel('Code PIN').last().fill(DEMO_PIN);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Bonjour, Awa 👋')).toBeVisible();
}

export async function openTab(page: Page, href: '/' | '/savings' | '/crowdfund' | '/credit' | '/profile') {
  await page.locator(`a[href="${href}"]`).last().click();
}

/** Saisie du PIN sur le clavier d'authentification forte. */
export async function typePin(page: Page, pin = DEMO_PIN) {
  await expect(page.getByText('Saisissez votre code PIN DALA').or(page.getByText('PIN incorrect, réessayez'))).toBeVisible();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
}

/** Les écrans déjà visités restent montés (cachés) dans la pile : on cible l'élément visible. */
export const shown = (locator: Locator) => locator.filter({ visible: true }).first();

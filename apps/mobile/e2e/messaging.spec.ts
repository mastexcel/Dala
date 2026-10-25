import { expect, test } from '@playwright/test';
import { login, shown } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("équipe commerciale : demande, accusé de réception puis réponse d'une conseillère", async ({ page }) => {
  await page.getByRole('button', { name: /Un conseiller/ }).click();
  // Sujets de la phase de test uniquement : ni placements ni levée de fonds.
  await expect(page.getByRole('button', { name: 'Crowdfunding en capital' })).toHaveCount(0);
  await shown(page.getByRole('button', { name: 'Micro-crédit' })).click();
  await shown(page.getByLabel('Votre message')).fill('Bonjour, combien puis-je emprunter ?');
  await shown(page.getByRole('button', { name: "Envoyer à l'équipe" })).click();

  await expect(shown(page.getByText(/Votre demande a bien été transmise/))).toBeVisible();
  // Réponse simulée en mode démo après quelques secondes.
  await expect(shown(page.getByText(/je suis Mariam, votre conseillère.*prêt est limité/))).toBeVisible({ timeout: 15_000 });

  await shown(page.getByLabel('Message')).fill('Merci, rappelez-moi demain svp');
  await shown(page.getByRole('button', { name: 'Envoyer' })).click();
  await expect(shown(page.getByText('Merci, rappelez-moi demain svp'))).toBeVisible();
  await expect(shown(page.getByText(/Je peux vous rappeler demain/))).toBeVisible({ timeout: 15_000 });
});

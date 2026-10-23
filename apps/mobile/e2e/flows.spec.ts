import { expect, test } from '@playwright/test';
import { login, openTab, shown, typePin } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('accueil : solde, piliers et masquage du solde', async ({ page }) => {
  await expect(page.getByText('1 397 500 FCFA').first()).toBeVisible();
  for (const pillar of ['Épargne', 'Investissement', 'Crowdfund', 'Crédit']) {
    await expect(page.getByText(pillar, { exact: true }).first()).toBeVisible();
  }
  await page.getByLabel('Masquer le solde').click();
  await expect(page.getByText('•••••• FCFA').first()).toBeVisible();
});

test('investissement dans un bon du Trésor avec authentification forte', async ({ page }) => {
  await page.getByText('Investissement', { exact: true }).first().click();
  await page.getByText('Trésor public du Sénégal').first().click();
  await page.getByText(/^Investir \d/).first().click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel("J'accepte les conditions").click();
  await page.getByRole('button', { name: "Confirmer l'investissement" }).click();
  // 100 000 FCFA > 50 000 : PIN exigé ; un mauvais PIN redemande la saisie.
  await typePin(page, '0000');
  await expect(page.getByText('PIN incorrect, réessayez')).toBeVisible();
  await typePin(page);
  await expect(page.getByText('Investissement réussi !')).toBeVisible();
});

test('crowdfunding : projet validé, ticket et part de capital', async ({ page }) => {
  await openTab(page, '/crowdfund');
  await page.getByText('AgriTech CI').first().click();
  await expect(shown(page.getByText('Validé par Bridge Investment Partners'))).toBeVisible();
  await expect(shown(page.getByText('Part du capital obtenue'))).toBeVisible();
  await page.getByLabel("J'accepte les risques").click();
  await page.getByRole('button', { name: /^Investir 25/ }).click();
  await expect(page.getByText(/Investissement enregistré/)).toBeVisible();
});

test('micro-crédit : devis TAEG puis prêt approuvé', async ({ page }) => {
  await openTab(page, '/credit');
  await expect(shown(page.getByText('Montant éligible'))).toBeVisible();
  await page.getByText('Demander un prêt').first().click();
  await expect(shown(page.getByText('TAEG', { exact: true }))).toBeVisible();
  await page.getByLabel("J'accepte les conditions du prêt").click();
  await page.getByRole('button', { name: 'Soumettre la demande' }).click();
  await expect(page.getByText('Prêt approuvé !')).toBeVisible();
});

test('épargne : création d’un objectif', async ({ page }) => {
  await openTab(page, '/savings');
  await page.getByRole('button', { name: 'Nouvel objectif' }).click();
  await page.getByLabel("Nom de l'objectif").fill('Moto pour livraisons');
  await page.getByLabel('Montant cible').fill('600000');
  await page.getByLabel('Montant par prélèvement').fill('20000');
  await expect(page.getByText(/Objectif atteint en 30 prélèvements/)).toBeVisible();
  await page.getByRole('button', { name: "Créer l'objectif" }).click();
  await expect(shown(page.getByText('Moto pour livraisons'))).toBeVisible();
});

test('transactions : filtre par catégorie', async ({ page }) => {
  await page.getByText('Voir tout').first().click();
  await page.getByRole('button', { name: 'Crowdfund' }).click();
  await expect(shown(page.getByText('Crowdfund · AgriTech CI'))).toBeVisible();
  await expect(page.getByText('Dépôt Orange Money').filter({ visible: true })).toHaveCount(0);
});

import { expect, test } from '@playwright/test';
import { login, openTab, shown } from './helpers';

const STATUS = 'Service en phase de test au sein du LIF-BCEAO';

test('statut réglementaire : phase de test au sein du LIF-BCEAO, jamais « établissement de paiement »', async ({ page }) => {
  await page.goto('/');
  // Splash puis écran de bienvenue / connexion : la mention est visible avant toute saisie.
  await expect(shown(page.getByText(STATUS).first())).toBeVisible({ timeout: 15_000 });

  await login(page);
  await expect(shown(page.getByText(STATUS, { exact: false }))).toBeVisible();
  await expect(page.getByText(/établissement de paiement/i)).toHaveCount(0);

  await openTab(page, '/profile');
  await shown(page.getByText('Mentions légales / CGU')).click();
  await expect(shown(page.getByText(/Version de démonstration : aucune opération réelle/))).toBeVisible();
  await expect(page.getByText(/établissement de paiement/i)).toHaveCount(0);
});

test("inscription : avertissement de phase de test accepté puis majorité vérifiée", async ({ page }) => {
  await page.goto('/');
  await page.getByText('Déjà inscrit ?').click({ timeout: 15_000 });
  await page.getByText('Créer un compte').click();

  // Écran d'avertissement : nature expérimentale, durée, plafonds, droits.
  for (const title of ['Un service expérimental', 'Durée du test', 'Plafonds', 'Vos droits']) {
    await expect(shown(page.getByText(title, { exact: true }))).toBeVisible();
  }
  await expect(shown(page.getByText(/Prêt : 100.000.FCFA au maximum/))).toBeVisible();
  const accept = shown(page.getByRole('button', { name: "J'accepte et je continue" }));
  await expect(accept).toBeDisabled();
  await shown(page.getByLabel("J'ai compris que le service est en phase de test")).click();
  await shown(page.getByLabel("J'accepte les conditions générales")).click();
  await accept.click();

  await shown(page.getByLabel('Prénom')).fill('Fatou');
  await shown(page.getByLabel('Nom', { exact: true })).fill('Diallo');
  await shown(page.getByLabel('Numéro de téléphone')).fill('0708091011');
  await shown(page.getByLabel('Date de naissance (JJ/MM/AAAA)')).fill('01012012');
  await shown(page.getByRole('button', { name: 'Recevoir le code OTP' })).click();
  await expect(shown(page.getByText(/réservé aux personnes de 18 ans ou plus/))).toBeVisible();
  await expect(shown(page.getByText(/Conditions de la phase de test acceptées le/))).toBeVisible();
});

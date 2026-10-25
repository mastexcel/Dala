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

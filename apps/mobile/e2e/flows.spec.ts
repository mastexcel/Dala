import { expect, test } from '@playwright/test';
import { login, openTab, shown, typePin } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('accueil : solde, piliers et masquage du solde', async ({ page }) => {
  await expect(page.getByText('1 197 500 FCFA').first()).toBeVisible();
  for (const pillar of ['Épargne', 'Crédit']) {
    await expect(page.getByText(pillar, { exact: true }).first()).toBeVisible();
  }
  // Phase de test : ni investissement ni crowdfunding (AMF-UMOA).
  for (const closed of ['Investissement', 'Crowdfund']) {
    await expect(page.getByText(closed, { exact: true }).filter({ visible: true })).toHaveCount(0);
  }
  await page.getByLabel('Masquer le solde').click();
  await expect(page.getByText('•••••• FCFA').first()).toBeVisible();
});

test('retrait de plus de 50 000 FCFA avec authentification forte (Wave indisponible)', async ({ page }) => {
  await page.getByRole('button', { name: 'Recevoir' }).click();
  await shown(page.getByText('Retirer', { exact: true })).click();
  await expect(page.getByText('Wave', { exact: true }).filter({ visible: true })).toHaveCount(0);
  await shown(page.getByText('Orange Money', { exact: true })).click();
  await shown(page.getByLabel('Montant')).fill('60000');
  await shown(page.getByRole('button', { name: 'Valider' })).click();
  // 60 000 FCFA > 50 000 : PIN exigé ; un mauvais PIN redemande la saisie.
  await typePin(page, '0000');
  await expect(page.getByText('PIN incorrect, réessayez')).toBeVisible();
  await typePin(page);
  await expect(shown(page.getByText(/envoyés vers votre compte Orange Money/))).toBeVisible();
});

test('envoi vers le mobile money d’un tiers : opérateur détecté d’après le numéro', async ({ page }) => {
  await page.getByRole('button', { name: 'Envoyer' }).first().click();
  await shown(page.getByText('Vers un mobile money')).click();
  await shown(page.getByLabel('Numéro mobile money du destinataire')).fill('0506070809');
  // Préfixe 05 : MTN MoMo est sélectionné automatiquement.
  await expect(shown(page.getByRole('radio', { name: 'MTN MoMo' }))).toBeChecked();
  await shown(page.getByRole('radio', { name: 'Orange Money' })).click();
  await expect(shown(page.getByText("Ce numéro n'est pas un numéro Orange Money."))).toBeVisible();
  await shown(page.getByRole('radio', { name: 'MTN MoMo' })).click();
  await shown(page.getByLabel('Montant')).fill('15000');
  await shown(page.getByRole('button', { name: 'Valider' })).click();
  await expect(shown(page.getByText(/envoyés vers le MTN MoMo du \+2250506070809/))).toBeVisible();
});

test('demande de paiement : lien et QR code à partager, payée depuis un autre opérateur', async ({ page }) => {
  await page.getByRole('button', { name: 'Recevoir' }).click();
  await shown(page.getByText('Demander', { exact: true })).click();
  await shown(page.getByLabel('Montant')).fill('12000');
  await shown(page.getByLabel('Motif (facultatif)')).fill('Commande de pagnes');
  await shown(page.getByRole('button', { name: 'Créer le lien de paiement' })).click();
  await expect(shown(page.getByLabel('QR code de la demande de paiement'))).toBeVisible();
  await expect(shown(page.getByText(/\/pay\/[A-Z0-9]{8}$/))).toBeVisible();
  await shown(page.getByRole('button', { name: 'Simuler le paiement (démo)' })).click();
  await expect(shown(page.getByText('Payée'))).toBeVisible();
});

test('scanner : QR d’un commerçant DALA payé avec le solde', async ({ page }) => {
  await page.getByRole('button', { name: 'Scanner' }).first().click();
  await shown(page.getByLabel('Ou collez le contenu du QR code / le lien')).fill('https://demo.dala.invalid/pay/DEMO2025');
  await shown(page.getByRole('button', { name: 'Analyser' })).click();
  await expect(shown(page.getByText('Maquis Chez Tantie'))).toBeVisible();
  await shown(page.getByRole('button', { name: /Payer 3\s?500 FCFA avec mon solde/ })).click();
  await expect(shown(page.getByText('Paiement effectué'))).toBeVisible();
});

test('scanner : QR interopérable (EMVCo) avec numéro MTN, envoi pré-rempli', async ({ page }) => {
  // Tag 26 (compte marchand) avec numéro MTN, montant 2 000 FCFA (devise 952), CRC valide.
  const qr = '00020101021226330011ci.mtn.momo0114+2250506070809520458125303952540420005802CI5912BOUTIQUE AYA6007ABIDJAN63045E60';
  await page.getByRole('button', { name: 'Scanner' }).first().click();
  await shown(page.getByLabel('Ou collez le contenu du QR code / le lien')).fill(qr);
  await shown(page.getByRole('button', { name: 'Analyser' })).click();
  await expect(shown(page.getByText('BOUTIQUE AYA'))).toBeVisible();
  await shown(page.getByRole('button', { name: /Envoyer 2\s?000 FCFA au \+2250506070809/ })).click();
  await expect(shown(page.getByRole('radio', { name: 'MTN MoMo' }))).toBeChecked();
  await expect(shown(page.getByLabel('Montant'))).toHaveValue('2000');
});

test('modules fermés pendant la phase de test : aucun accès par lien direct', async ({ page }) => {
  await page.goto('/crowdfund/p1');
  await expect(page.getByText('AgriTech CI').filter({ visible: true })).toHaveCount(0);
  await page.goto('/invest');
  await expect(page.getByText('Bons du Trésor').filter({ visible: true })).toHaveCount(0);
  await page.goto('/assistant');
  await expect(page.getByText('Connecter une IA').filter({ visible: true })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'Crowdfund' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Épargne' }).click();
  await expect(shown(page.getByText('Épargne auto · Mariage'))).toBeVisible();
  await expect(page.getByText('Dépôt Orange Money').filter({ visible: true })).toHaveCount(0);
});

test.describe('paysage (tablette / ordinateur)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('rail de navigation latéral et cartes sur deux colonnes', async ({ page }) => {
    const rail = page.getByRole('tablist').filter({ has: page.getByRole('tab', { name: 'Épargne' }) });
    await expect(rail).toBeVisible();
    const pillars = [/de vos objectifs/, /^Éligible/].map((t) => shown(page.getByText(t)));
    const [a, b] = await Promise.all(pillars.map((l) => l.boundingBox()));
    // Deux piliers côte à côte : même hauteur, colonnes différentes.
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeLessThan(5);
    expect((b?.x ?? 0) - (a?.x ?? 0)).toBeGreaterThan(200);
    await rail.getByRole('tab', { name: 'Épargne' }).click();
    await expect(shown(page.getByText('Total épargné'))).toBeVisible();
  });
});

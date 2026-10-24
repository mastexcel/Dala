import { expect, test, type Page, type Route } from '@playwright/test';
import { login, openTab, shown } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("équipe commerciale : demande, accusé de réception puis réponse d'une conseillère", async ({ page }) => {
  await page.getByRole('button', { name: /Un conseiller/ }).click();
  await shown(page.getByRole('button', { name: 'Crowdfunding en capital' })).click();
  await shown(page.getByLabel('Votre message')).fill('Bonjour, comment investir dans un projet ?');
  await shown(page.getByRole('button', { name: "Envoyer à l'équipe" })).click();

  await expect(shown(page.getByText(/Votre demande a bien été transmise/))).toBeVisible();
  // Réponse simulée en mode démo après quelques secondes.
  await expect(shown(page.getByText(/je suis Mariam, votre conseillère/))).toBeVisible({ timeout: 15_000 });

  await shown(page.getByLabel('Message')).fill('Merci, rappelez-moi demain svp');
  await shown(page.getByRole('button', { name: 'Envoyer' })).click();
  await expect(shown(page.getByText('Merci, rappelez-moi demain svp'))).toBeVisible();
  await expect(shown(page.getByText(/Je peux vous rappeler demain/))).toBeVisible({ timeout: 15_000 });
});

/** Simule l'API Anthropic (CORS compris : l'app web l'appelle directement depuis le navigateur). */
async function mockAnthropic(page: Page) {
  const requests: { url: string; body: Record<string, unknown> | null; headers: Record<string, string> }[] = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  await page.route('https://api.anthropic.com/**', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    requests.push({ url: req.url(), body: req.postDataJSON() as Record<string, unknown> | null, headers: req.headers() });
    if (req.url().includes('/v1/models/')) {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }) });
    }
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'msg_e2e',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: '## Synthèse\n- Les **bons du Trésor** offrent un rendement stable.\n- Le crowdfunding en capital est plus risqué.' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });
  return requests;
}

test("assistant IA : connexion d'une clé Claude puis analyse du marché", async ({ page }) => {
  const requests = await mockAnthropic(page);
  await page.getByRole('button', { name: /Assistant IA/ }).click();
  await shown(page.getByRole('button', { name: 'Connecter une IA' })).click();
  await shown(page.getByLabel('Clé API')).fill('sk-ant-e2e');
  await shown(page.getByRole('button', { name: 'Connecter', exact: true })).click();

  await shown(page.getByRole('button', { name: 'Analyse le marché des bons du Trésor UEMOA en ce moment' })).click();
  await expect(shown(page.getByText('Les bons du Trésor offrent un rendement stable.', { exact: false }))).toBeVisible();
  await expect(shown(page.getByText('Synthèse'))).toBeVisible();

  const call = requests.find((r) => r.url.includes('/v1/messages'))!;
  expect(call.headers.authorization).toBe('Bearer sk-ant-e2e');
  expect(call.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(call.body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default' });
  // Les offres DALA (titres, projets validés) accompagnent la question.
  const system = JSON.stringify(call.body!.system);
  expect(system).toContain('Bridge Investment Partners');
  expect(system).toContain('AgriTech CI');
  expect(system).toContain('FCFA');
});

test("assistant IA : question préremplie depuis la fiche d'un projet", async ({ page }) => {
  await mockAnthropic(page);
  await openTab(page, '/crowdfund');
  await page.getByText('AgriTech CI').first().click();
  await shown(page.getByText("Analyser avec l'assistant IA →")).click();
  // Pas encore de clé : l'assistant propose d'abord de connecter une IA.
  await shown(page.getByRole('button', { name: 'Connecter une IA' })).click();
  await shown(page.getByLabel('Clé API')).fill('sk-ant-e2e');
  await shown(page.getByRole('button', { name: 'Connecter', exact: true })).click();
  await expect(shown(page.getByText(/Bonjour ! Je peux analyser le marché/))).toBeVisible();
  await expect(shown(page.getByLabel('Message'))).toHaveValue(/Analyse le projet AgriTech CI/);
});

import { defineConfig } from 'vitest/config';

/**
 * Tests d'intégration : API complète contre une vraie base PostgreSQL.
 * La base désignée par TEST_DATABASE_URL est VIDÉE à chaque exécution — ne jamais pointer vers une base réelle.
 *   TEST_DATABASE_URL=postgresql://…/dala_test npm run test:integration
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL requis pour les tests d’intégration');
if (!/test/i.test(url)) throw new Error('TEST_DATABASE_URL doit désigner une base de test (son nom doit contenir « test »)');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: url,
      JWT_SECRET: 'integration-secret-integration-secret-xx',
      JWT_REFRESH_SECRET: 'integration-refresh-integration-refresh-x',
      ADMIN_API_KEY: 'integration-admin-key',
      ML_SERVICE_URL: 'http://127.0.0.1:18765',
      MOBILE_MONEY_MODE: 'sandbox',
      WAVE_API_KEY: 'wave-webhook-secret',
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['test/integration/**', 'node_modules/**'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-test-secret-test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
});

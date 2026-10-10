import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@acme/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      { test: { name: 'shared', root: 'packages/shared', environment: 'node' } },
      {
        test: { name: 'api', root: 'apps/api', environment: 'node', setupFiles: ['test/setup.ts'] },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          environment: 'jsdom',
          setupFiles: ['test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/shared/src/**/*.ts',
        'apps/api/src/**/*.ts',
        'apps/web/src/**/*.{ts,tsx}',
      ],
      thresholds: {
        'apps/api/src/domain/**': { lines: 90, branches: 85 },
        'packages/shared/src/**': { lines: 90, branches: 85 },
      },
    },
  },
});

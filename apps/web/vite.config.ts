import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@acme/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    // The API listens on PORT (default 3000, 03 section 8); the browser stays same-origin.
    proxy: { '/api': 'http://localhost:3000' },
  },
});

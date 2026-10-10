import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// D-051: time and randomness come from injected modules, never from globals.
const determinismBans = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Read the time from the injected Clock (domain/clock.ts), not new Date() (D-051).',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Read the time from the injected Clock (domain/clock.ts), not Date.now() (D-051).',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'Use the seeded random module (seed/random.ts), not Math.random() (D-051).',
  },
];

export default defineConfig(
  globalIgnores(['**/dist/', 'coverage/', '.claude/', '.ai-notes/', 'docs/', 'scripts/']),
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...determinismBans],
      // Red-step stubs keep their final signature with unused, underscore-prefixed parameters.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/api/src/domain/clock.ts', 'apps/api/src/seed/random.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // ADR 0004: domain/ is pure and imports nothing from db/, http/, modules/ or Node I/O.
    files: ['apps/api/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['fastify', '@libsql/client', 'drizzle-orm'],
          patterns: [
            {
              group: ['**/db', '**/db/**', '**/http', '**/http/**', '**/modules', '**/modules/**'],
              message: 'domain/ is pure: no imports from db/, http/ or modules/ (ADR 0004).',
            },
            { group: ['node:*'], message: 'domain/ is pure: no Node I/O (ADR 0004).' },
          ],
        },
      ],
    },
  },
);

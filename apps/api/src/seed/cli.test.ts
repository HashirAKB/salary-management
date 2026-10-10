import { describe, expect, it } from 'vitest';
import { runSeed } from './cli.ts';

const validEnv = {
  DATABASE_URL: ':memory:',
  DEMO_HR_ADMIN_PASSWORD: 'admin-password-1',
  DEMO_HR_VIEWER_PASSWORD: 'viewer-password-1',
  DEMO_FINANCE_PASSWORD: 'finance-password-1',
};

describe('seed CLI', () => {
  it.each([
    {
      case: 'HR admin password missing',
      env: { ...validEnv, DEMO_HR_ADMIN_PASSWORD: undefined },
      variables: ['DEMO_HR_ADMIN_PASSWORD'],
    },
    {
      case: 'finance password of 11 characters',
      env: { ...validEnv, DEMO_FINANCE_PASSWORD: 'eleven-char' },
      variables: ['DEMO_FINANCE_PASSWORD'],
    },
    {
      case: 'all three empty',
      env: {
        DATABASE_URL: ':memory:',
        DEMO_HR_ADMIN_PASSWORD: '',
        DEMO_HR_VIEWER_PASSWORD: '',
        DEMO_FINANCE_PASSWORD: '',
      },
      variables: ['DEMO_HR_ADMIN_PASSWORD', 'DEMO_HR_VIEWER_PASSWORD', 'DEMO_FINANCE_PASSWORD'],
    },
  ])(
    'the seed CLI exits with an error when a demo password variable is missing or shorter than 12 characters: $case',
    async ({ env, variables }) => {
      const errors: string[] = [];
      let opened = false;

      const exitCode = await runSeed(env, {
        openDb: () => {
          opened = true;
          throw new Error('the database must not be opened');
        },
        log: () => {},
        error: (line) => errors.push(line),
      });

      expect(exitCode).toBe(1);
      expect(opened).toBe(false);
      const output = errors.join('\n');
      for (const variable of variables) {
        expect(output).toContain(`${variable}: must be set and at least 12 characters`);
      }
      expect(output).not.toContain(validEnv.DEMO_HR_VIEWER_PASSWORD);
    },
  );
});

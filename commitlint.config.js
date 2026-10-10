// D-059 and 06 section 3.2: Conventional Commits, fixed scopes, header under 72 characters.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'web',
        'shared',
        'db',
        'seed',
        'auth',
        'employees',
        'salary',
        'insights',
        'export',
        'ask',
        'e2e',
        'deploy',
        'docs',
      ],
    ],
    'header-max-length': [2, 'always', 71],
  },
};

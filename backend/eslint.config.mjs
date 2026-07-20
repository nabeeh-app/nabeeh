import globals from 'globals';
import security from 'eslint-plugin-security';

export default [
  {
    ignores: ['node_modules/', 'logs/', 'auth_info_baileys/'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      security,
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-child-process': 'warn',
      'security/detect-eval-with-expression': 'error',
    },
  },
];

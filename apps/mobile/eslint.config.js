const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['.expo/', 'dist/', 'node_modules/'] },
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx'],
    ...i18next.configs['flat/recommended'],
    rules: {
      // Visible text must come from t(): JSX text plus the props a user can see or hear.
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: [
              'accessibilityLabel',
              'accessibilityHint',
              'aria-label',
              'placeholder',
              'title',
            ],
          },
        },
      ],
    },
  },
]);

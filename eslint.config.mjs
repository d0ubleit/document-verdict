// ESLint flat configuration for the whole repository.
// Rules follow CONTRIBUTING.md: strict TypeScript, no `any`, no unused variables.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', '**/dist/**', 'package-lock.json'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node scripts: console, process, URL and document (page.evaluate) are global there.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        document: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    // Server runs in Node: process and console are global.
    files: ['apps/server/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);

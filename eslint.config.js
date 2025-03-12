import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.browser } },
  { ignores: ['node_modules', 'dist', 'build', 'coverage', '**/*.test.ts'] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
];

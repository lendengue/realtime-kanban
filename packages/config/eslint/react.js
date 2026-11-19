import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { base } from './base.js';

/**
 * Flat config for React (Vite) apps: base rules plus hooks and fast-refresh checks.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function react({ tsconfigRootDir }) {
  const files = ['**/*.{ts,tsx}'];
  return tseslint.config(
    ...base({ tsconfigRootDir }),
    { files, languageOptions: { globals: { ...globals.browser } } },
    { ...reactHooks.configs.flat.recommended, files },
    { ...reactRefresh.configs.vite, files },
  );
}

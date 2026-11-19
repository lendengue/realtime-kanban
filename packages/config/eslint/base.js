import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Base flat config for every TypeScript package in the monorepo.
 * Uses type-aware linting through the TypeScript project service.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function base({ tsconfigRootDir }) {
  return tseslint.config(
    { ignores: ['dist/**', 'coverage/**', '**/*.d.ts'] },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        // Allows `onClick={() => setOpen(false)}`-style shorthands.
        '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      },
    },
    {
      // Vitest's asymmetric matchers (expect.any, expect.stringContaining...) are typed as `any`.
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    prettier,
  );
}

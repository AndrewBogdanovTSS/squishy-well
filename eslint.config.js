import tseslint from 'typescript-eslint'

/**
 * The only rule here that really matters is the import boundary on the core
 * package. The three-layer architecture is worth nothing if it is enforced by
 * good intentions — this makes a Vue or Three import inside the engine a
 * build error instead of a code review comment.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/*.vue',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['packages/tetris-core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'vue',
            'vue/*',
            'three',
            'three/*',
            '@tresjs/*',
            'pinia',
            '#app',
            '#imports',
            'node:*',
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'the engine must not touch the DOM' },
        { name: 'document', message: 'the engine must not touch the DOM' },
        { name: 'performance', message: 'the engine receives dt, it never reads a clock' },
        { name: 'requestAnimationFrame', message: 'the engine is ticked from outside' },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)

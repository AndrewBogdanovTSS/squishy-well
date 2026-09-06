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
      // Deliberately plain, deliberately CommonJS - the entire point of this
      // fixture is that it follows none of this repo's own conventions, to
      // prove evidence-layer/core does not secretly depend on them either.
      'packages/evidence-layer/examples/**',
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
    // The same enforcement pattern as the engine's own boundary above, applied
    // to the other package that claims to be portable: `evidence-layer/core`
    // is the part promised to work on any project, so a Tetris, Vue or Three
    // import inside it is a lie the next reader would have to discover by hand.
    // Node builtins are fine here - unlike the engine, this package is CLI
    // tooling and is expected to shell out and touch the filesystem; only the
    // adapters may know *which* project they are adapting to.
    files: ['packages/evidence-layer/src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@tetris/*',
            'vue',
            'vue/*',
            'three',
            'three/*',
            '@tresjs/*',
            'pinia',
            '#app',
            '#imports',
          ],
        },
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

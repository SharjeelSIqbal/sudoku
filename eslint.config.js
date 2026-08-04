// Flat config (ESLint 9). Note there is no `--ext` flag any more — the `files`
// globs below are what scope the run, so `npx eslint src` lints .ts and .tsx.
const expoFlatConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoFlatConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The house rule: every identifier says what it holds. `i`/`j` are
      // tolerated only as for-loop counters declared in the loop header, and
      // `_` for intentionally unused values. ESLint cannot express the
      // "loop header only" half, so that part is on review.
      'id-length': [
        'error',
        { min: 2, exceptions: ['_', 'i', 'j'], properties: 'never' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },
];

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Engine purity (CLAUDE.md hard rule): pure modules never touch Phaser,
    // the wall clock, or ambient randomness. Randomness/time reach them only
    // as injected parameters (see meta/progression.ts for the seam pattern).
    files: [
      'src/combat/**',
      'src/data/**',
      'src/tree/**',
      'src/meta/**',
      'src/save/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: 'Engine purity: no Phaser below scenes/ui.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Engine purity: inject randomness as a parameter; never call Math.random here.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Engine purity: simulation time only advances via advance(dtMs).',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Engine purity: simulation time only advances via advance(dtMs).',
        },
      ],
    },
  },
  {
    // Ratchet, not a target: scenes are supposed to be thin wiring over pure
    // modules. CombatScene is the current worst offender (~1150 lines); this
    // cap only blocks further growth. When a scene shrinks, lower the cap.
    // Never raise it to make lint pass — extract logic into ui/ instead.
    files: ['src/scenes/**'],
    rules: {
      'max-lines': ['error', { max: 1200, skipBlankLines: false, skipComments: false }],
    },
  },
);

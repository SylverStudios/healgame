import { describe, expect, it } from 'vitest';
import type { EncounterDef } from '../../combat/types';
import { CONTENT_CATALOGS } from './catalogs';
import {
  compileAllDungeons,
  compileDungeon,
  ContentValidationError,
} from './compile';
import { formatDungeonPreview } from './preview';
import type { ContentCatalogs, DungeonDef, EnemyAbilityDef, MobDef } from './types';
import { validateContent } from './validate';

const LEGACY_EQUIVALENT_ENCOUNTERS = [
  {
    id: 'ash-gate',
    name: 'Ash Gate',
    goldPerEnemy: 1,
    goldEveryKills: 2,
    xpPerEnemy: 1,
    rubyPerFirstClear: 1,
    waves: [
      {
        enemies: [
          {
            mobId: 'ash-husk',
            name: 'Ash Husk',
            hp: 11,
            count: 2,
            autoDamage: 1,
            swingIntervalMs: 3000,
          },
        ],
      },
      {
        enemies: [
          {
            mobId: 'ash-husk',
            name: 'Ash Husk',
            hp: 11,
            count: 3,
            autoDamage: 1,
            swingIntervalMs: 3000,
          },
        ],
      },
    ],
    boss: {
      id: 'gate-warden',
      name: 'Gate Warden',
      hp: 145,
      autoDamage: 4,
      swingIntervalMs: 3500,
      cast: {
        name: 'Bonehowl',
        castMs: 10_000,
        firstCastAtMs: 3000,
        intervalMs: 12_000,
        partyDamage: 4,
      },
    },
  },
  {
    id: 'iron-pass',
    name: 'Iron Pass',
    goldPerEnemy: 1,
    goldEveryKills: 2,
    xpPerEnemy: 1,
    rubyPerFirstClear: 0,
    waves: [
      {
        enemies: [
          {
            mobId: 'iron-husk',
            name: 'Iron Husk',
            hp: 9,
            count: 2,
            autoDamage: 2,
            swingIntervalMs: 3000,
          },
        ],
      },
      {
        enemies: [
          {
            mobId: 'iron-husk',
            name: 'Iron Husk',
            hp: 9,
            count: 3,
            autoDamage: 2,
            swingIntervalMs: 3000,
          },
        ],
      },
      {
        enemies: [
          {
            mobId: 'iron-husk',
            name: 'Iron Husk',
            hp: 10,
            count: 3,
            autoDamage: 2,
            swingIntervalMs: 3000,
          },
        ],
      },
      {
        enemies: [
          {
            mobId: 'iron-husk',
            name: 'Iron Husk',
            hp: 10,
            count: 4,
            autoDamage: 2,
            swingIntervalMs: 3000,
          },
        ],
      },
    ],
    boss: {
      id: 'spire-lancer',
      name: 'Spire Lancer',
      hp: 190,
      autoDamage: 3,
      swingIntervalMs: 3500,
      cast: {
        kind: 'tunnelVision',
        name: 'Tunnel Vision',
        telegraphMs: 3000,
        firstCastAtMs: 8000,
        intervalMs: 30_000,
        channelMs: 10_000,
        tickMs: 1000,
        damagePerTick: 2,
      },
    },
  },
  {
    id: 'the-maw',
    name: 'The Maw',
    goldPerEnemy: 1,
    goldEveryKills: 2,
    xpPerEnemy: 1,
    rubyPerFirstClear: 0,
    waves: [
      {
        enemies: [
          {
            mobId: 'ash-husk',
            name: 'Ash Husk',
            hp: 4,
            count: 2,
            autoDamage: 1,
            swingIntervalMs: 3000,
          },
        ],
      },
    ],
    boss: {
      id: 'hollow-king',
      name: 'Hollow King',
      hp: 999,
      autoDamage: 3,
      swingIntervalMs: 3500,
      cast: {
        name: 'Extinction',
        castMs: 10_000,
        firstCastAtMs: 15_000,
        intervalMs: 25_000,
        partyDamage: 10,
      },
    },
  },
] as const satisfies readonly EncounterDef[];

describe('live dungeon content', () => {
  it('is valid without warnings', () => {
    expect(validateContent(CONTENT_CATALOGS)).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it('compiles to explicit legacy-equivalent runtime values', () => {
    expect(compileDungeon('ash-gate', CONTENT_CATALOGS)).toEqual(LEGACY_EQUIVALENT_ENCOUNTERS[0]);
    expect(compileDungeon('iron-pass', CONTENT_CATALOGS)).toEqual(LEGACY_EQUIVALENT_ENCOUNTERS[1]);
    expect(compileDungeon('the-maw', CONTENT_CATALOGS)).toEqual(LEGACY_EQUIVALENT_ENCOUNTERS[2]);
    expect(compileAllDungeons(CONTENT_CATALOGS)).toEqual(LEGACY_EQUIVALENT_ENCOUNTERS);
  });

  it('assembles deterministically from explicit order, independent of catalog array order', () => {
    const reordered: ContentCatalogs = {
      ...CONTENT_CATALOGS,
      abilities: [...CONTENT_CATALOGS.abilities].reverse(),
      mobs: [...CONTENT_CATALOGS.mobs].reverse(),
      dungeons: [...CONTENT_CATALOGS.dungeons].reverse(),
    };
    expect(compileAllDungeons(reordered)).toEqual(LEGACY_EQUIVALENT_ENCOUNTERS);
    expect(compileAllDungeons(reordered)).toEqual(compileAllDungeons(reordered));
  });

  it('rejects a lookalike dungeon object that was not validated as part of the catalog', () => {
    const lookalike = { ...CONTENT_CATALOGS.dungeons[0] };
    expect(() => compileDungeon(lookalike, CONTENT_CATALOGS)).toThrow(
      'Cannot compile unknown dungeon',
    );
    expect(() => formatDungeonPreview(lookalike, CONTENT_CATALOGS)).toThrow(
      'Cannot compile unknown dungeon',
    );
  });

  it('formats a stable preview with effective overrides and ability cadence', () => {
    expect(formatDungeonPreview('the-maw', CONTENT_CATALOGS)).toBe(
      [
        'Dungeon 3: The Maw [the-maw]',
        'Unlock: clear iron-pass',
        'Rewards: gold 1/2 enemies, XP 1/enemy, ruby 0/first clear',
        'Visual: the-maw',
        'Wave 1:',
        '  2x Ash Husk [ash-husk] — HP 4, auto 1/3000ms, boss no, overrides hp=4',
        '    Abilities: none',
        'Wave 2 (boss):',
        '  1x Hollow King [hollow-king] — HP 999, auto 3/3500ms, boss yes, overrides none',
        '    Ability: Extinction [extinction] partyAoE — cast 10000ms, first 15000ms, interval 25000ms, party damage 10',
      ].join('\n'),
    );
  });
});

describe('content diagnostics', () => {
  it('accepts zero rewards and auto damage, including an auto-damage override', () => {
    const zeroValues: ContentCatalogs = {
      ...CONTENT_CATALOGS,
      mobs: [
        { ...CONTENT_CATALOGS.mobs[0], autoDamage: 0 },
        ...CONTENT_CATALOGS.mobs.slice(1),
      ],
      dungeons: [
        {
          ...CONTENT_CATALOGS.dungeons[0],
          rewards: { goldPerEnemy: 0, goldEveryKills: 2, xpPerEnemy: 0, rubyPerFirstClear: 0 },
          waves: [
            {
              enemies: [
                {
                  ...CONTENT_CATALOGS.dungeons[0].waves[0].enemies[0],
                  statOverrides: { autoDamage: 0 },
                },
              ],
            },
            CONTENT_CATALOGS.dungeons[0].waves[1],
            CONTENT_CATALOGS.dungeons[0].waves[2],
          ],
        },
        ...CONTENT_CATALOGS.dungeons.slice(1),
      ],
    };

    expect(validateContent(zeroValues).errors).toEqual([]);
    const compiled = compileDungeon('ash-gate', zeroValues);
    expect(compiled.goldPerEnemy).toBe(0);
    expect(compiled.xpPerEnemy).toBe(0);
    expect(compiled.rubyPerFirstClear).toBe(0);
    expect(compiled.waves[0]?.enemies[0]?.autoDamage).toBe(0);
  });

  it('rejects empty names, ambiguous mob tags, and trash abilities', () => {
    const malformed: ContentCatalogs = {
      ...CONTENT_CATALOGS,
      abilities: [
        { ...CONTENT_CATALOGS.abilities[0], name: '  ' },
        ...CONTENT_CATALOGS.abilities.slice(1),
      ],
      mobs: [
        {
          ...CONTENT_CATALOGS.mobs[0],
          name: '',
          tags: ['trash', 'boss'],
          abilityIds: ['bonehowl'],
        },
        ...CONTENT_CATALOGS.mobs.slice(1),
      ],
      dungeons: [
        { ...CONTENT_CATALOGS.dungeons[0], name: '\t' },
        ...CONTENT_CATALOGS.dungeons.slice(1),
      ],
    };

    const codes = validateContent(malformed).errors.map(({ code }) => code);
    expect(codes.filter((code) => code === 'empty-name')).toHaveLength(3);
    expect(codes).toEqual(
      expect.arrayContaining(['invalid-mob-tags', 'trash-abilities-unsupported']),
    );
  });

  it('returns all errors and unused-content warnings for an invalid fixture', () => {
    const abilities: readonly EnemyAbilityDef[] = [
      {
        id: 'Bad Ability',
        name: 'Bad Ability',
        kind: 'partyAoE',
        castMs: 10,
        firstCastAtMs: 0,
        intervalMs: 5,
        partyDamage: -1,
        visualKey: 'missing-ability-visual',
      },
      {
        id: 'unused',
        name: 'Unused',
        kind: 'partyAoE',
        castMs: 1,
        firstCastAtMs: 1,
        intervalMs: 1,
        partyDamage: 1,
        visualKey: 'unused',
      },
    ];
    const mobs: readonly MobDef[] = [
      {
        id: 'trash',
        name: 'Trash',
        tags: ['trash'],
        hp: 0,
        autoDamage: 1,
        swingIntervalMs: 1,
        abilityIds: ['missing', 'Bad Ability'],
        visualKey: 'ash-husk',
      },
      {
        id: 'boss',
        name: 'Boss',
        tags: ['boss'],
        hp: 1,
        autoDamage: 1,
        swingIntervalMs: 1,
        abilityIds: [],
        visualKey: 'gate-warden',
      },
      {
        id: 'orphan',
        name: 'Orphan',
        tags: ['trash'],
        hp: 1,
        autoDamage: 1,
        swingIntervalMs: 1,
        abilityIds: [],
        visualKey: 'hollow-king',
      },
    ];
    const dungeons: readonly DungeonDef[] = [
      {
        id: 'broken',
        name: 'Broken',
        order: 1,
        unlock: { kind: 'dungeonClear', dungeonId: 'broken' },
        rewards: { goldPerEnemy: 0, goldEveryKills: 2, xpPerEnemy: 1, rubyPerFirstClear: 1 },
        visualKey: 'broken',
        waves: [
          { enemies: [{ mobId: 'boss', count: 1 }] },
          { enemies: [] },
        ],
      },
    ];
    const invalid: ContentCatalogs = {
      abilities,
      mobs,
      dungeons,
      dungeonOrder: ['missing-dungeon'],
      visualKeys: ['unused', 'trash', 'boss', 'orphan', 'broken'],
    };

    const result = validateContent(invalid);
    const codes = result.errors.map(({ code }) => code);
    expect(result.valid).toBe(false);
    expect(codes).toEqual(
      expect.arrayContaining([
        'invalid-slug-id',
        'invalid-positive-integer',
        'invalid-cast-cadence',
        'unknown-visual-key',
        'runtime-ability-limit',
        'unknown-ability-ref',
        'unknown-dungeon-order-ref',
        'missing-dungeon-order-id',
        'boss-before-final-wave',
        'empty-wave',
        'invalid-boss-wave-size',
        'unlock-order-mismatch',
        'unlock-cycle',
      ]),
    );
    expect(result.errors.length).toBeGreaterThan(12);
    expect(result.warnings.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['unused-ability', 'unused-mob']),
    );
  });

  it('reports boss placement, references, counts, overrides, and order together', () => {
    const boss = CONTENT_CATALOGS.mobs.find(({ id }) => id === 'gate-warden');
    expect(boss).toBeDefined();
    const malformed: ContentCatalogs = {
      ...CONTENT_CATALOGS,
      dungeons: [
        {
          ...CONTENT_CATALOGS.dungeons[0],
          order: 2,
          waves: [
            { enemies: [{ mobId: 'gate-warden', count: 0 }] },
            {
              enemies: [
                { mobId: 'missing-mob', count: 2, statOverrides: { hp: -1 } },
                { mobId: 'ash-husk', count: 1 },
              ],
            },
          ],
        },
        ...CONTENT_CATALOGS.dungeons.slice(1),
      ],
    };
    const codes = validateContent(malformed).errors.map(({ code }) => code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'dungeon-order-mismatch',
        'boss-before-final-wave',
        'invalid-positive-integer',
        'unknown-mob-ref',
        'invalid-boss-wave-size',
        'unlock-order-mismatch',
      ]),
    );
  });

  it('enforces duplicate IDs, unlock refs, final boss count/tag, and integer overrides', () => {
    const malformed: ContentCatalogs = {
      ...CONTENT_CATALOGS,
      abilities: [...CONTENT_CATALOGS.abilities, CONTENT_CATALOGS.abilities[0]],
      dungeons: [
        {
          ...CONTENT_CATALOGS.dungeons[0],
          unlock: { kind: 'dungeonClear', dungeonId: 'not-a-dungeon' },
          waves: [
            CONTENT_CATALOGS.dungeons[0].waves[0],
            {
              enemies: [
                {
                  mobId: 'ash-husk',
                  count: 2,
                  statOverrides: { swingIntervalMs: 1.5 },
                },
              ],
            },
          ],
        },
        ...CONTENT_CATALOGS.dungeons.slice(1),
      ],
    };
    const codes = validateContent(malformed).errors.map(({ code }) => code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'duplicate-id',
        'unknown-unlock-ref',
        'invalid-positive-integer',
        'invalid-boss-count',
        'missing-boss-tag',
      ]),
    );
  });

  it('compiler throws one clear aggregate error containing every validation error', () => {
    const invalid: ContentCatalogs = {
      ...CONTENT_CATALOGS,
      abilities: [
        {
          ...CONTENT_CATALOGS.abilities[0],
          castMs: 0,
          intervalMs: 0,
          visualKey: 'not-registered',
        },
        ...CONTENT_CATALOGS.abilities.slice(1),
      ],
    };
    const expected = validateContent(invalid);

    try {
      compileAllDungeons(invalid);
      throw new Error('expected compilation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ContentValidationError);
      const contentError = error as ContentValidationError;
      expect(contentError.diagnostics.filter(({ severity }) => severity === 'error')).toEqual(
        expected.errors,
      );
      expect(contentError.message).toContain(`failed with ${expected.errors.length} errors`);
      expected.errors.forEach(({ code, path }) => {
        expect(contentError.message).toContain(`[${code}] ${path}`);
      });
    }
  });
});

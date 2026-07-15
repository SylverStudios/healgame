import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CONTENT_CATALOGS } from './catalogs';
import { ORDERED_DUNGEONS } from '../dungeons';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runContent(...args: string[]) {
  return spawnSync(npmCommand, ['run', '--silent', 'content', '--', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('content CLI', () => {
  it('validates and lists the live ordered catalog', () => {
    const validation = runContent('validate');
    expect(validation.status).toBe(0);
    expect(validation.stdout).toContain(
      `Content valid: ${CONTENT_CATALOGS.dungeons.length} dungeons, ${CONTENT_CATALOGS.mobs.length} mobs, ${CONTENT_CATALOGS.abilities.length} abilities`,
    );

    const list = runContent('list');
    expect(list.status).toBe(0);
    for (const dungeon of ORDERED_DUNGEONS) {
      const unlock =
        dungeon.unlock.kind === 'always'
          ? 'always unlocked'
          : `unlocks after ${dungeon.unlock.dungeonId}`;
      expect(list.stdout).toContain(
        `${dungeon.order}. ${dungeon.name} [${dungeon.id}] — ${unlock}`,
      );
    }
  });

  it('previews one dungeon or the complete catalog', () => {
    const first = ORDERED_DUNGEONS[0]!;
    const last = ORDERED_DUNGEONS[ORDERED_DUNGEONS.length - 1]!;
    const one = runContent('preview', last.id);
    expect(one.status).toBe(0);
    expect(one.stdout).toContain(`Dungeon ${last.order}: ${last.name} [${last.id}]`);

    const all = runContent('preview', '--all');
    expect(all.status).toBe(0);
    expect(all.stdout).toContain(`Dungeon ${first.order}: ${first.name} [${first.id}]`);
    expect(all.stdout).toContain(`Dungeon ${last.order}: ${last.name} [${last.id}]`);
    for (const dungeon of ORDERED_DUNGEONS) {
      expect(all.stdout).toContain(`[${dungeon.id}]`);
    }
  });

  it('runs the maxed-kit balance harness for a dungeon', () => {
    const sample = ORDERED_DUNGEONS[0]!;
    const one = runContent('balance', sample.id);
    expect(one.status).toBe(0);
    expect(one.stdout).toContain(`${sample.name} [${sample.id}]`);
    expect(one.stdout).toContain('Vigil × Virtue (Patient Crown):');
    expect(one.stdout).toContain('Zealot × Virtue (Crown):');

    const all = runContent('balance', '--all');
    expect(all.status).toBe(0);
    for (const dungeon of ORDERED_DUNGEONS) {
      expect(all.stdout).toContain(`[${dungeon.id}]`);
    }
  });

  it('exits nonzero for bad arguments and unknown dungeon ids', () => {
    const missingArgument = runContent('preview');
    expect(missingArgument.status).toBe(1);
    expect(missingArgument.stderr).toContain('Usage:');

    const unknown = runContent('preview', 'missing-dungeon');
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('Cannot preview unknown dungeon "missing-dungeon"');

    const unknownBalance = runContent('balance', 'missing-dungeon');
    expect(unknownBalance.status).toBe(1);
    expect(unknownBalance.stderr).toContain('Cannot balance unknown dungeon "missing-dungeon"');
  });
});

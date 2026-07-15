import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

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
    expect(validation.stdout).toContain('Content valid: 5 dungeons, 9 mobs, 5 abilities');

    const list = runContent('list');
    expect(list.status).toBe(0);
    expect(list.stdout).toContain('1. Ash Gate [ash-gate] — always unlocked');
    expect(list.stdout).toContain('2. Iron Pass [iron-pass] — unlocks after ash-gate');
    expect(list.stdout).toContain('3. Cinder Vault [cinder-vault] — unlocks after iron-pass');
    expect(list.stdout).toContain('4. Black Choir [black-choir] — unlocks after cinder-vault');
    expect(list.stdout).toContain('5. The Maw [the-maw] — unlocks after black-choir');
  });

  it('previews one dungeon or the complete catalog', () => {
    const one = runContent('preview', 'the-maw');
    expect(one.status).toBe(0);
    expect(one.stdout).toContain('Dungeon 5: The Maw [the-maw]');
    expect(one.stdout).toContain('Ability: Extinction [extinction] partyAoE');

    const all = runContent('preview', '--all');
    expect(all.status).toBe(0);
    expect(all.stdout).toContain('Dungeon 1: Ash Gate [ash-gate]');
    expect(all.stdout).toContain('Dungeon 2: Iron Pass [iron-pass]');
    expect(all.stdout).toContain('Ability: Tunnel Vision [tunnel-vision] tunnelVision');
    expect(all.stdout).toContain('Dungeon 3: Cinder Vault [cinder-vault]');
    expect(all.stdout).toContain('Ability: Emberfall [emberfall] partyDoT');
    expect(all.stdout).toContain('Dungeon 4: Black Choir [black-choir]');
    expect(all.stdout).toContain('Ability: Soul Toll [soul-toll] manaSiphon');
    expect(all.stdout).toContain('Dungeon 5: The Maw [the-maw]');
  });

  it('exits nonzero for bad arguments and unknown dungeon ids', () => {
    const missingArgument = runContent('preview');
    expect(missingArgument.status).toBe(1);
    expect(missingArgument.stderr).toContain('Usage:');

    const unknown = runContent('preview', 'missing-dungeon');
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('Cannot preview unknown dungeon "missing-dungeon"');
  });
});

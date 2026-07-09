import { describe, expect, it } from 'vitest';
import { TREE_NODES, treeNodeById } from './tree';
import { spellById } from './spells';

describe('tree data integrity', () => {
  it('has unique node ids', () => {
    const ids = TREE_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every requires entry references an existing node', () => {
    for (const node of TREE_NODES) {
      for (const req of node.requires) {
        expect(treeNodeById(req), `${node.id} requires missing node ${req}`).toBeDefined();
      }
    }
  });

  it('every spell id referenced by an effect exists in the catalog', () => {
    for (const node of TREE_NODES) {
      const e = node.effect;
      const spellIds =
        e.kind === 'grantSpell'
          ? [e.spellId]
          : e.kind === 'synergy'
            ? [e.triggerSpellId, e.buffedSpellId]
            : e.kind === 'missingHealthBonus' || e.kind === 'castMod'
              ? [e.spellId]
              : [];
      for (const id of spellIds) {
        expect(spellById(id), `${node.id} references missing spell ${id}`).toBeDefined();
      }
    }
  });

  it('costs and ranks are positive integers', () => {
    for (const node of TREE_NODES) {
      expect(Number.isInteger(node.cost.amount) && node.cost.amount > 0).toBe(true);
      expect(Number.isInteger(node.maxRanks) && node.maxRanks >= 1).toBe(true);
    }
  });

  it('exactly the two subclass oath nodes share the subclass exclusiveGroup', () => {
    const oaths = TREE_NODES.filter((n) => n.exclusiveGroup === 'subclass');
    expect(oaths.map((n) => n.id).sort()).toEqual(['vigil-oath', 'zealot-oath']);
    for (const oath of oaths) {
      expect(oath.cost.currency).toBe('ruby');
      expect(oath.subclass).toBeDefined();
    }
  });
});

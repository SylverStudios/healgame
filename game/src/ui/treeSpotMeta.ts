/**
 * Talent-tree tooltip meta: show rank capacity (owned/max), omit redundant
 * "1 point" talent costs (every live node costs one talent point).
 */

export interface SpotMetaInput {
  chainLength: number;
  ownedCount: number;
  /** Next purchasable node's cost, if any. */
  nextCost?: { currency: string; amount: number };
}

export function costLabel(currency: string, amount: number): string {
  if (currency === 'talent') return amount === 1 ? '1 point' : `${amount} points`;
  return `${amount} ${currency}`;
}

/** Suffix after the talent name: always `(owned/max)`; cost only when non-trivial. */
export function spotMetaSuffix(spot: SpotMetaInput): string {
  const rank = ` (${spot.ownedCount}/${spot.chainLength})`;
  if (!spot.nextCost) return rank;
  // Talent is always 1 per purchase — capacity is what the player needs to see.
  if (spot.nextCost.currency === 'talent' && spot.nextCost.amount === 1) return rank;
  return `${rank} — ${costLabel(spot.nextCost.currency, spot.nextCost.amount)}`;
}

/** Eyebrow above a grantSpell slot card. */
export function grantSpellEyebrow(
  spot: SpotMetaInput,
  talentName: string,
  spellName: string,
): string {
  const meta = spotMetaSuffix(spot);
  if (talentName !== spellName) return `${talentName}${meta}`;
  return meta.trim().length > 0 ? meta.replace(/^\s+/, '') : 'Spell unlock';
}

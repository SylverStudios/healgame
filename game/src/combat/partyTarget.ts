/**
 * Tab-cycle party heal targets. Order follows engine party array
 * (tank → dps1 → dps2 → healer); dead members are skipped; wraps.
 */

export interface PartyTargetUnit {
  id: string;
  alive: boolean;
}

/** Next living ally after `currentTargetId`, or first living if none/stale. */
export function nextPartyTargetId(
  party: readonly PartyTargetUnit[],
  currentTargetId: string | null,
): string | null {
  const livingIds = party.filter((u) => u.alive).map((u) => u.id);
  if (livingIds.length === 0) return null;
  const currentIndex = currentTargetId === null ? -1 : livingIds.indexOf(currentTargetId);
  if (currentIndex === -1) return livingIds[0]!;
  return livingIds[(currentIndex + 1) % livingIds.length]!;
}

/**
 * The nine ranks, Iron to Radiant. `t` places each one between 0 (Iron) and 1 (Radiant): the
 * engine leans on raw aim and simple agents at the low end and on team utility at the high end.
 */

export const RANKS = [
  { id: 'iron', name: 'Iron', t: 0 },
  { id: 'bronze', name: 'Bronze', t: 0.125 },
  { id: 'silver', name: 'Silver', t: 0.25 },
  { id: 'gold', name: 'Gold', t: 0.375 },
  { id: 'platinum', name: 'Platinum', t: 0.5 },
  { id: 'diamond', name: 'Diamond', t: 0.625 },
  { id: 'ascendant', name: 'Ascendant', t: 0.75 },
  { id: 'immortal', name: 'Immortal', t: 0.875 },
  { id: 'radiant', name: 'Radiant', t: 1 },
] as const;

export type RankId = (typeof RANKS)[number]['id'];
export const RANK_IDS: readonly RankId[] = RANKS.map((r) => r.id);
export const isRank = (v: unknown): v is RankId => typeof v === 'string' && (RANK_IDS as readonly string[]).includes(v);
export const rankOf = (id: RankId) => RANKS.find((r) => r.id === id)!;

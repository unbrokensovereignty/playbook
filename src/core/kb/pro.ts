/**
 * What pro teams play on each map: how often each agent was picked (percent of maps played), how
 * many maps that comes from, and the comps played most. The engine leans on this a little at high
 * ranks and hardly at all at low ranks, where pro coordination doesn't carry over.
 *
 * Everything here is worked out from the lineups played at this year's events (lineups.ts, from
 * vlr.gg): Champions 2026, Masters London 2026 and Masters Santiago 2026. On each map, the newest
 * event that played it counts in full and each one before it counts OLDER times as much as the
 * next, so the numbers follow the current way of playing while still taking in the earlier maps.
 * Bind and Corrode, played on few maps there, also take in the regional Kickoffs (REGIONAL).
 * Icebox wasn't played at this year's events, so its numbers come from Masters Toronto 2025, the
 * last top event that played it (`dated`), and agents released since count neither for nor
 * against. An agent missing from a map's list wasn't picked there.
 * Each map's numbers add up to about 500%, five agents a team (a little more where an agent released
 * during the year counts only the events since).
 */
import type { Role } from './roles.ts';
import { EVENTS, LINEUPS, pickable, RELEASED_DURING, won, type Lineup } from './lineups.ts';

export interface ProMap {
  /** Agent → percent of maps picked. */
  picks: Record<string, number>;
  /** How many maps of pro play the picks come from (left out for an earlier year's numbers). */
  games?: number;
  /** The comps played most, as agent ids, most played first. */
  comps: readonly (readonly string[])[];
  /** The numbers are from an earlier year's play. */
  dated?: boolean;
  /** For an earlier year's numbers, the day that play ended: an agent released after it couldn't be picked. */
  until?: string;
  /** For an earlier year's numbers, the event they're from. */
  event?: string;
  /** Maps of regional play blended into the picks, where the events above played the map too little (REGIONAL). */
  regional?: number;
}

/** On each map, each event before the newest one that played it counts this much of the one after it. */
export const OLDER = 0.25;
/** How many comps each map keeps, most played first. */
const COMPS = 3;

/**
 * A comp played at the events, on one map: its agents, how many maps it was played and won on, how
 * many teams played it, and `seen`, its maps weighted by OLDER (what orders the comps).
 */
export interface PlayedComp { agents: readonly string[]; maps: number; won: number; teams: number; seen: number }

const sortedKey = (agents: readonly string[]) => [...agents].sort().join(' ');

/** Each map's comps as they were played, most played first (by weighted count, then wins). */
export function playedComps(lineups: readonly Lineup[]): Record<string, PlayedComp[]> {
  const out: Record<string, PlayedComp[]> = {};
  for (const map of [...new Set(lineups.map((l) => l.map))]) {
    const weightOf = eventWeights(lineups, map);
    const by = new Map<string, PlayedComp & { who: Set<string> }>();
    for (const l of lineups.filter((x) => x.map === map)) for (const i of [0, 1] as const) {
      const k = sortedKey(l.teams[i].agents);
      const c = by.get(k) ?? { agents: l.teams[i].agents, maps: 0, won: 0, teams: 0, seen: 0, who: new Set<string>() };
      c.who.add(l.teams[i].team);
      by.set(k, { ...c, maps: c.maps + 1, won: c.won + Number(won(l, i)), teams: c.who.size, seen: c.seen + weightOf(l.event) });
    }
    out[map] = [...by.values()].map(({ who: _, ...c }) => c).sort((a, b) => b.seen - a.seen || b.won - a.won || sortedKey(a.agents).localeCompare(sortedKey(b.agents)));
  }
  return out;
}

/** How much each event counts on a map: 1 for the newest that played it, OLDER for the one before, and so on. */
function eventWeights(lineups: readonly Lineup[], map: string): (event: string) => number {
  const played = EVENTS.filter((e) => lineups.some((l) => l.map === map && l.event === e.id)).map((e) => e.id);
  return (event) => OLDER ** Math.max(0, played.indexOf(event));
}

/** Each map's pro numbers from a set of lineups (the checks build them without an event to test against it). */
export function proFrom(lineups: readonly Lineup[]): Record<string, ProMap> {
  const comps = playedComps(lineups);
  const out: Record<string, ProMap> = {};
  for (const map of Object.keys(comps)) {
    const weightOf = eventWeights(lineups, map);
    const counts = new Map<string, number>();
    // the teams that could have picked each agent released during the year, and those that could pick anyone
    const could = new Map<string, number>(Object.keys(RELEASED_DURING).map((id) => [id, 0]));
    let teams = 0, games = 0;
    for (const l of lineups.filter((x) => x.map === map)) {
      const w = weightOf(l.event), event = EVENTS.find((e) => e.id === l.event)!;
      games++;
      teams += 2 * w;
      for (const id of could.keys()) if (pickable(id, event)) could.set(id, could.get(id)! + 2 * w);
      for (const t of l.teams) for (const id of t.agents) counts.set(id, (counts.get(id) ?? 0) + w);
    }
    const share = (id: string, n: number) => (100 * n) / (could.get(id) ?? teams);
    const picks = Object.fromEntries([...counts.entries()].filter(([id, n]) => share(id, n) >= 0.5).sort((a, b) => share(b[0], b[1]) - share(a[0], a[1]) || a[0].localeCompare(b[0])).map(([id, n]) => [id, Math.round(share(id, n))]));
    out[map] = { games, picks, comps: comps[map]!.slice(0, COMPS).map((c) => c.agents) };
  }
  return out;
}

/**
 * Icebox wasn't in this year's pools, so its numbers come from Masters Toronto 2025 (7 to 22 June
 * 2025), the last top event that played it: its 11 Icebox maps, read from each series' page on
 * vlr.gg on 12 November 2026. The picks match vlr.gg's agent table for the event. A row is [map,
 * team, rounds, agents, other team, its rounds, its agents].
 */
const TORONTO_2025 = { name: 'Masters Toronto 2025', to: '2025-06-22', rows: [
  ['icebox', 'Paper Rex', 15, 'killjoy omen viper jett sova', 'FNATIC', 17, 'jett sova sage killjoy viper'],
  ['icebox', 'Paper Rex', 13, 'omen killjoy viper jett sova', 'Team Heretics', 9, 'gekko killjoy sova neon viper'],
  ['icebox', 'Bilibili Gaming', 13, 'harbor jett killjoy viper sova', 'Team Liquid', 10, 'harbor kayo clove omen gekko'],
  ['icebox', 'Bilibili Gaming', 13, 'harbor jett viper killjoy sova', 'Sentinels', 9, 'killjoy omen kayo viper gekko'],
  ['icebox', 'Gen.G', 13, 'jett viper killjoy sova omen', 'Paper Rex', 3, 'viper jett killjoy omen sova'],
  ['icebox', 'Team Liquid', 13, 'harbor viper jett sova chamber', 'MIBR', 6, 'sova harbor viper killjoy jett'],
  ['icebox', 'Rex Regum Qeon', 8, 'viper jett killjoy sova omen', 'Wolves Esports', 13, 'jett killjoy viper gekko sova'],
  ['icebox', 'G2 Esports', 13, 'killjoy sova sage viper omen', 'Xi Lai Gaming', 3, 'sova jett killjoy viper gekko'],
  ['icebox', 'Gen.G', 11, 'sova jett viper killjoy omen', 'G2 Esports', 13, 'killjoy sova sage omen viper'],
  ['icebox', 'Sentinels', 9, 'killjoy gekko omen kayo viper', 'FNATIC', 13, 'killjoy jett sova sage viper'],
  ['icebox', 'Wolves Esports', 4, 'viper killjoy sova jett gekko', 'FNATIC', 13, 'jett viper killjoy sage sova'],
] as const };

/** A map's numbers from an earlier year's lineups: each agent's share of the teams, and the comps played most. */
function earlier(play: { name: string; to: string; rows: readonly (readonly [string, string, number, string, string, number, string])[] }): Record<string, ProMap> {
  const lineups: Lineup[] = play.rows.map(([map, a, ra, aa, b, rb, ab]) => ({ event: 'earlier', map, teams: [{ team: a, rounds: ra, agents: aa.split(' ') }, { team: b, rounds: rb, agents: ab.split(' ') }] }));
  const comps = playedComps(lineups);
  return Object.fromEntries(Object.keys(comps).map((map) => {
    const teams = lineups.filter((l) => l.map === map).flatMap((l) => l.teams.map((t) => t.agents));
    const counts = new Map<string, number>();
    for (const t of teams) for (const id of t) counts.set(id, (counts.get(id) ?? 0) + 1);
    const picks = Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id, n]) => [id, Math.round((100 * n) / teams.length)]));
    return [map, { dated: true, until: play.to, event: play.name, picks, comps: comps[map]!.slice(0, COMPS).map((c) => c.agents) }];
  }));
}

const EARLIER: Record<string, ProMap> = earlier(TORONTO_2025);

/**
 * Regional play, for maps this year's international events played on fewer than REGIONAL_BELOW
 * maps: each region's pick rates on the map at the four VCT 2026 Kickoffs, as vlr.gg's agent table
 * for each event gives them (read 5 November 2026). They're older than the international events
 * and below their level, so each of their maps counts OLDER as much as an international one, and
 * they leave out agents released since (Miks): those keep their international numbers.
 */
export const REGIONAL = { name: 'the four VCT 2026 Kickoffs', from: '2026-01-15', read: '2026-11-05' };
export const REGIONAL_BELOW = 10;
const KICKOFFS: Record<string, readonly { region: string; games: number; picks: Record<string, number> }[]> = {
  bind: [
    { region: 'Americas', games: 12, picks: { viper: 100, brimstone: 96, waylay: 79, skye: 54, yoru: 50, fade: 46, chamber: 46, raze: 17, tejo: 8, astra: 4 } },
    { region: 'Pacific', games: 11, picks: { brimstone: 91, viper: 86, yoru: 68, fade: 68, raze: 64, waylay: 41, skye: 27, astra: 14, neon: 9, chamber: 9, veto: 9, kayo: 9, tejo: 5 } },
    { region: 'EMEA', games: 12, picks: { viper: 100, brimstone: 83, raze: 54, skye: 54, fade: 46, waylay: 42, yoru: 38, tejo: 21, astra: 17, neon: 13, sage: 13, gekko: 13, chamber: 4, veto: 4 } },
    { region: 'China', games: 11, picks: { viper: 95, brimstone: 91, fade: 73, raze: 64, yoru: 50, waylay: 36, skye: 27, chamber: 18, tejo: 9, kayo: 9, phoenix: 9, vyse: 9, cypher: 5, reyna: 5 } },
  ],
  corrode: [
    { region: 'Americas', games: 10, picks: { waylay: 95, omen: 85, viper: 80, fade: 50, sova: 40, yoru: 30, kayo: 25, veto: 20, sage: 20, astra: 15, tejo: 10, skye: 10, iso: 10, chamber: 5, neon: 5 } },
    { region: 'Pacific', games: 9, picks: { omen: 100, fade: 94, viper: 72, waylay: 61, yoru: 44, neon: 33, chamber: 22, phoenix: 22, cypher: 11, kayo: 11, sova: 6, raze: 6, brimstone: 6, veto: 6, sage: 6 } },
    { region: 'EMEA', games: 9, picks: { astra: 78, waylay: 72, sova: 56, yoru: 39, omen: 39, fade: 39, kayo: 39, viper: 22, vyse: 22, chamber: 17, phoenix: 17, neon: 11, brimstone: 11, tejo: 11, cypher: 6, jett: 6, skye: 6, breach: 6, sage: 6 } },
    { region: 'China', games: 10, picks: { omen: 85, yoru: 75, fade: 65, viper: 60, neon: 50, waylay: 35, kayo: 25, cypher: 20, gekko: 20, sova: 15, astra: 15, phoenix: 15, sage: 15, veto: 5 } },
  ],
};

/** A map's numbers with its regional play blended in, when the international events played it too little. */
export function withRegional(map: string, p: ProMap): ProMap {
  const regions = KICKOFFS[map];
  if (!regions || p.dated || (p.games ?? 0) >= REGIONAL_BELOW) return p;
  const games = p.games ?? 0, regional = regions.reduce((t, r) => t + r.games, 0);
  const later = (id: string) => RELEASED_DURING[id] !== undefined && RELEASED_DURING[id]! > REGIONAL.from;
  const ids = new Set([...Object.keys(p.picks), ...regions.flatMap((r) => Object.keys(r.picks))]);
  const picks: Record<string, number> = {};
  for (const id of ids) {
    const local = regions.reduce((t, r) => t + (r.picks[id] ?? 0) * r.games, 0) / regional;
    const pct = later(id) ? p.picks[id] ?? 0 : ((p.picks[id] ?? 0) * games + local * OLDER * regional) / (games + OLDER * regional);
    if (Math.round(pct) >= 1) picks[id] = Math.round(pct);
  }
  return { ...p, regional, picks: Object.fromEntries(Object.entries(picks).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) };
}

export const PRO: Record<string, ProMap> = { ...Object.fromEntries(Object.entries(proFrom(LINEUPS)).map(([m, p]) => [m, withRegional(m, p)])), ...EARLIER };

/** The comps played at the events, map by map (see playedComps). */
export const PLAYED: Record<string, PlayedComp[]> = playedComps(LINEUPS);

/** A comp counts as one pro teams play on a map once it was played on this many maps there. */
export const PLAYED_MIN = 2;

/**
 * The most agents a team shares with a comp pro teams play on a map: one played on PLAYED_MIN maps
 * or more there, or for a map with an earlier year's numbers, one of its typical comps.
 */
export function proOverlap(map: string, team: readonly string[]): number {
  const comps = PLAYED[map]?.filter((c) => c.maps >= PLAYED_MIN).map((c) => c.agents) ?? PRO[map]?.comps ?? [];
  return Math.max(0, ...comps.map((c) => c.filter((id) => team.includes(id)).length));
}

/**
 * Champions 2026, the last event these numbers come from, began on 24 September 2026. An agent
 * released after that hasn't had the chance to be picked by pro teams yet.
 */
export const PRO_CUTOFF = '2026-09-24';
/** Pro teams have had the chance to pick the agent (it isn't new since the events above). */
export const proKnown = (a: { released: string; estimate?: boolean }): boolean => !a.estimate && a.released < PRO_CUTOFF;

/** How many maps of pro play the picks above come from (an earlier year's numbers aside). */
export const PRO_MAPS_COUNTED = Object.values(PRO).reduce((sum, p) => sum + (p.dated ? 0 : p.games ?? 0), 0);

/** How often pro teams picked an agent across those maps, in percent (rounded). */
export function proOverall(agent: string): number {
  let picked = 0;
  for (const p of Object.values(PRO)) if (!p.dated) picked += ((p.picks[agent] ?? 0) / 100) * (p.games ?? 0);
  return PRO_MAPS_COUNTED ? Math.round((100 * picked) / PRO_MAPS_COUNTED) : 0;
}

/** How often pro teams pick an agent on a map, in percent (0 when rarely). */
export const proPick = (map: string, agent: string): number => PRO[map]?.picks[agent] ?? 0;

/**
 * How many agents of each role a pro team runs on a map, on average: each role's picks over all
 * the map's picks, times five. `roleOf` names each agent's role (kept out of here so this file
 * doesn't need the agent list).
 */
export function proRoleMix(map: string, roleOf: (id: string) => Role | undefined): Record<Role, number> | undefined {
  const p = PRO[map];
  if (!p) return undefined;
  const mix: Record<Role, number> = { duelist: 0, initiator: 0, controller: 0, sentinel: 0 };
  let all = 0;
  for (const [id, pct] of Object.entries(p.picks)) {
    const r = roleOf(id);
    if (!r) continue;
    mix[r] += pct;
    all += pct;
  }
  if (!all) return undefined;
  for (const r of Object.keys(mix) as Role[]) mix[r] = (5 * mix[r]) / all;
  return mix;
}

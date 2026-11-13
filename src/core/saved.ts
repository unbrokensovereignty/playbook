/**
 * What you keep: saved plans (a planner question, with the comp you picked if you picked one),
 * party presets (your usual duo, trio or five-stack, with the agents each of you plays), plays you
 * drew yourself and the games you logged. Every record read back from storage, a backup or an import
 * goes through a sanitizer here, so old or damaged data just works: a new field only needs a default.
 */
import { isAgent } from './kb/agents.ts';
import { mapById, type Side, type SiteId } from './kb/maps.ts';
import { isMoment, JOBS, SIDE_KINDS, stepOf, type Job, type Moment, type Play, type PlayKind } from './kb/plays.ts';
import { sanitizeComfort, sanitizeQuery, type Comfort, type Query } from './engine/query.ts';
import { clean } from './text.ts';
import { isRecord } from './util.ts';

export const LIMITS = { name: 60, note: 600, plans: 500, parties: 50, players: 5, pool: 30, plays: 100, games: 1000, gameNote: 200, steps: 8, route: 10, line: 200 };

export interface SavedPlan {
  id: string;
  name: string;
  note: string;
  query: Query;
  /** The comp picked from the answers, as agent ids (empty when none was picked). */
  team: string[];
  starred: boolean;
  created: number;
  updated: number;
}

export interface Player {
  name: string;
  /** The agents this player plays; empty for anyone. */
  agents: string[];
  /** How well they play those agents (an agent left out, or no list: comfortably). */
  comfort?: Record<string, Comfort>;
}

export interface Party {
  id: string;
  name: string;
  players: Player[];
  created: number;
  updated: number;
}

/** How a game you logged ended. */
export type GameResult = 'win' | 'loss' | 'draw';
export const GAME_RESULTS: readonly { id: GameResult; name: string }[] = [{ id: 'win', name: 'Won' }, { id: 'loss', name: 'Lost' }, { id: 'draw', name: 'Draw' }];
const isGameResult = (v: unknown): v is GameResult => v === 'win' || v === 'loss' || v === 'draw';

/** A game you logged: the map, the agent you played, your team's agents as far as you noted them, and how it ended. */
export interface Game {
  id: string;
  map: string;
  /** The agent you played. */
  agent: string;
  /** Your team's agents, yours among them (up to five). */
  team: string[];
  result: GameResult;
  note: string;
  /** When it was logged. */
  played: number;
}

/**
 * A play you drew: on a map and side, for a site or the whole map, its steps written like the
 * built-in plays' (kb/plays.ts) but kept as parts. Each step's jobs are one or two, five at most in
 * the play (one per player); its moment is yours to set, or worked out from its jobs and words.
 */
export interface MyPlay {
  id: string;
  map: string;
  side: Side;
  site: SiteId | null;
  kind: PlayKind;
  name: string;
  about: string;
  steps: MyStep[];
  created: number;
  updated: number;
}
export interface MyStep {
  jobs: Job[];
  /** Callouts on the play's map, from where the player starts to where they end up. */
  route: string[];
  text: string;
  /** Set by you, or null to work it out (kb/plays.ts, whenOf). */
  when: Moment | null;
}
/** One job for each of five players, at most. */
export const PLAY_JOBS = 5;

const text = (v: unknown, max: number): string => clean(typeof v === 'string' ? v : '').slice(0, max);
const time = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback);
const goodId = (v: unknown): v is string => typeof v === 'string' && /^[a-z]{1,3}_[a-z0-9]{4,24}$/.test(v);
const agents = (v: unknown, max: number): string[] => (Array.isArray(v) ? [...new Set(v.filter(isAgent))].slice(0, max) : []);

export function sanitizePlan(x: unknown, now = 0): SavedPlan | null {
  if (!isRecord(x) || !goodId(x.id)) return null;
  const query = sanitizeQuery(x.query);
  return {
    id: x.id,
    name: text(x.name, LIMITS.name) || 'Saved plan',
    note: text(x.note, LIMITS.note),
    query,
    team: agents(x.team, 5),
    starred: x.starred === true,
    created: time(x.created, now),
    updated: time(x.updated, time(x.created, now)),
  };
}

export function sanitizeParty(x: unknown, now = 0): Party | null {
  if (!isRecord(x) || !goodId(x.id)) return null;
  const players = (Array.isArray(x.players) ? x.players : []).slice(0, LIMITS.players).map((p, i): Player => {
    const pool = agents(isRecord(p) ? p.agents : [], LIMITS.pool);
    // only for agents in the player's pool
    const comfort = Object.entries(sanitizeComfort(isRecord(p) ? p.comfort : undefined)).filter(([id]) => pool.includes(id));
    return {
      name: text(isRecord(p) ? p.name : '', LIMITS.name) || `Player ${i + 1}`,
      agents: pool,
      ...(comfort.length ? { comfort: Object.fromEntries(comfort) } : {}),
    };
  });
  // a party is two, three or five players
  if (players.length < 2 || players.length === 4) return null;
  return { id: x.id, name: text(x.name, LIMITS.name) || 'My party', players, created: time(x.created, now), updated: time(x.updated, time(x.created, now)) };
}

export function sanitizeGame(x: unknown, now = 0): Game | null {
  if (!isRecord(x) || !goodId(x.id) || !mapById(x.map as string) || !isAgent(x.agent) || !isGameResult(x.result)) return null;
  const team = agents([x.agent, ...(Array.isArray(x.team) ? x.team : [])], 5);
  return { id: x.id, map: x.map as string, agent: x.agent, team, result: x.result, note: text(x.note, LIMITS.gameNote), played: time(x.played, now) };
}

/** Games read back from storage or a backup: the good ones, each once, newest first, up to the limit. */
export function sanitizeGames(v: unknown, now = 0): Game[] {
  const seen = new Set<string>();
  return (Array.isArray(v) ? v : []).map((x) => sanitizeGame(x, now)).filter((g): g is Game => !!g && !seen.has(g.id) && !!seen.add(g.id))
    .sort((a, b) => b.played - a.played || a.id.localeCompare(b.id)).slice(0, LIMITS.games);
}


export function sanitizeMyPlay(x: unknown, now = 0): MyPlay | null {
  if (!isRecord(x) || !goodId(x.id)) return null;
  const map = typeof x.map === 'string' ? mapById(x.map) : undefined;
  if (!map) return null;
  const side: Side = x.side === 'defense' ? 'defense' : 'attack';
  const site = map.sites.find((s) => s.id === x.site)?.id ?? null;
  const kind = SIDE_KINDS[side].includes(x.kind as PlayKind) ? (x.kind as PlayKind) : SIDE_KINDS[side][0]!;
  const callouts = new Set(map.callouts.map((c) => c.name));
  let jobsLeft = PLAY_JOBS;
  const steps: MyStep[] = [];
  for (const st of (Array.isArray(x.steps) ? x.steps : []).slice(0, LIMITS.steps)) {
    if (!isRecord(st)) continue;
    const jobs = [...new Set(Array.isArray(st.jobs) ? st.jobs.filter((j): j is Job => (JOBS as readonly unknown[]).includes(j)) : [])].slice(0, Math.min(2, jobsLeft));
    // a callout once in a row is a spot; the same one twice in a row says nothing more
    const route = (Array.isArray(st.route) ? st.route : []).filter((c): c is string => typeof c === 'string' && callouts.has(c))
      .filter((c, i, all) => i === 0 || all[i - 1] !== c).slice(0, LIMITS.route);
    if (!jobs.length || !route.length) continue;
    jobsLeft -= jobs.length;
    steps.push({ jobs, route, text: text(st.text, LIMITS.line), when: isMoment(st.when) ? st.when : null });
  }
  if (!steps.length) return null;
  return {
    id: x.id, map: map.id, side, site, kind,
    name: text(x.name, LIMITS.name) || 'My play',
    about: text(x.about, LIMITS.note),
    steps,
    created: time(x.created, now),
    updated: time(x.updated, time(x.created, now)),
  };
}

/** Plays you drew, read back from storage or a backup: the good ones, each once, newest first, up to the limit. */
export function sanitizeMyPlays(v: unknown, now = 0): MyPlay[] {
  const seen = new Set<string>();
  return (Array.isArray(v) ? v : []).map((x) => sanitizeMyPlay(x, now)).filter((p): p is MyPlay => !!p && !seen.has(p.id) && !!seen.add(p.id))
    .sort((a, b) => b.updated - a.updated || a.id.localeCompare(b.id)).slice(0, LIMITS.plays);
}

/** What every play code starts with, so a pasted code is easy to tell from other text. */
export const PLAY_CODE_PREFIX = 'PLAYBOOK-PLAY:';

/** A code to share a play you drew: its map, side, site, kind, name, note and steps, as text you can paste. */
export function playCode(p: MyPlay): string {
  const body = JSON.stringify([p.map, p.side, p.site ?? '', p.kind, p.name, p.about, p.steps.map((s) => [s.jobs.join(' '), s.route.join('>'), s.text, s.when ?? ''])]);
  let bin = '';
  for (const b of new TextEncoder().encode(body)) bin += String.fromCharCode(b);
  return PLAY_CODE_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Reads a play code (surrounding spaces and quotes are fine) into the parts of a play to save, checked
 * like any play read back (sanitizeMyPlay). Null when it isn't one or nothing in it is a play.
 */
export function parsePlayCode(code: string): Omit<MyPlay, 'id' | 'created' | 'updated'> | null {
  const s = code.trim().replace(/^["'“”]+|["'“”]+$/g, '');
  if (!s.startsWith(PLAY_CODE_PREFIX)) return null;
  try {
    const b64 = s.slice(PLAY_CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const v: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    if (!Array.isArray(v)) return null;
    const [map, side, site, kind, name, about, steps] = v;
    const read = (Array.isArray(steps) ? steps : []).map((st: unknown) => {
      const [jobs, route, text, when] = Array.isArray(st) ? st : [];
      return { jobs: typeof jobs === 'string' ? jobs.split(' ') : [], route: typeof route === 'string' ? route.split('>') : [], text, when: when || null };
    });
    const play = sanitizeMyPlay({ id: 'm_shared', map, side, site: site || null, kind, name, about, steps: read, created: 1, updated: 1 }, 1);
    if (!play) return null;
    const { id: _id, created: _c, updated: _u, ...rest } = play;
    return rest;
  } catch {
    return null;
  }
}

/** A play you drew, as the planner fills it: like a built-in play, its moments and where its utility lands worked out the same way. */
export function asPlay(p: MyPlay): Play {
  return {
    id: p.id, map: p.map, side: p.side, site: p.site, kind: p.kind, name: p.name, about: p.about, mine: true,
    steps: p.steps.map((s) => stepOf(p.map, p.side, p.site, p.kind, [...s.jobs], [...s.route], s.text, s.when ?? undefined)),
  };
}

/** A party's agent pools in player order, as the planner takes them. */
export const poolsOf = (p: Party): string[][] => p.players.map((x) => [...x.agents]);
/** How well a party plays its agents, as the planner takes it: an agent two players play counts as the better one plays it. */
export function comfortOf(p: Party): Record<string, Comfort> {
  const order = (c: Comfort | undefined) => (c === 'learning' ? 0 : c === 'main' ? 2 : 1);
  const out: Record<string, Comfort> = {};
  for (const id of new Set(p.players.flatMap((x) => x.agents))) {
    const best = Math.max(...p.players.filter((x) => x.agents.includes(id)).map((x) => order(x.comfort?.[id])));
    if (best !== 1) out[id] = best === 2 ? 'main' : 'learning';
  }
  return out;
}

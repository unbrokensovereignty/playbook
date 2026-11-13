/**
 * Fills a play with a team: every job goes to an agent so the team as a whole is as good at the
 * play as it can be, and the play's fit says how well the team can run it. Jobs draw on the same
 * strengths the engine measures agents by (kb/roles.ts), so a play's fit agrees with the team's.
 */
import { agentById, type Agent } from '../kb/agents.ts';
import { namedFor } from '../kb/effects.ts';
import { abilityNames } from '../kb/kits.ts';
import { plantSpots } from '../kb/features.ts';
import { hasFloor, onFloor, type Spot } from '../kb/floor.ts';
import { mapById, parseNeeds, type Side, type SiteId } from '../kb/maps.ts';
import { branchesOf, DEMANDS, demandOf, isRoundPlay, momentName, MOMENTS, playsOn, ROUND, type Demand, type Job, type Moment, type Play, type PlayStep } from '../kb/plays.ts';
import { RANK_IDS, rankOf, type RankId } from '../kb/ranks.ts';
import type { Dim } from '../kb/roles.ts';
import { listJoin } from '../text.ts';
import { coverage, fitText, needOf, usesFor, type UseKind } from './uses.ts';
import { PLAY_RANK } from './weights.ts';

/**
 * What each job draws on. Each line is one way to do the job, as strengths and how much each
 * counts; an agent does the job the best way they can. Stand-ins count for less: a smoke can
 * cover for a missing wall, but not as well. Utility that clears an area also slows a push into it
 * (a nade or a molly), a site setup can guard a planted Spike, a slow or a molly can hold a flank,
 * and a duelist's movement can lead a retake.
 */
export const JOB_SKILLS: Record<Job, readonly Partial<Record<Dim, number>>[]> = {
  smoke: [{ smoke: 1 }, { wall: 0.6 }],
  wall: [{ wall: 1 }, { smoke: 0.5 }],
  flash: [{ flash: 1 }, { disrupt: 0.75 }],
  recon: [{ recon: 1 }, { flank: 0.4 }],
  entry: [{ entry: 1 }, { duel: 0.6 }],
  clear: [{ clear: 1 }, { recon: 0.6 }, { disrupt: 0.5 }],
  anchor: [{ anchor: 1 }, { stall: 0.6 }],
  stall: [{ stall: 1 }, { anchor: 0.7 }, { wall: 0.5 }, { clear: 0.7 }],
  flank: [{ flank: 1 }, { anchor: 0.6 }, { stall: 0.6 }],
  lurk: [{ duel: 0.55, mobility: 0.45 }, { flank: 0.5, duel: 0.4 }],
  postplant: [{ postplant: 1 }, { stall: 0.6 }, { anchor: 0.5 }],
  retake: [{ retake: 1 }, { flash: 0.6 }, { disrupt: 0.6 }, { entry: 0.5 }],
  duel: [{ duel: 1 }],
};

/** What each job is called in a sentence: "Omen smokes". */
export const JOB_NAMES: Record<Job, string> = {
  smoke: 'Smokes', wall: 'Wall', flash: 'Flashes', recon: 'Information', entry: 'Entry', clear: 'Clearing',
  anchor: 'Anchor', stall: 'Delay', flank: 'Flank watch', lurk: 'Lurk', postplant: 'Post-plant', retake: 'Retake', duel: 'Duels',
};

/** Below this, a job is a stretch for whoever gets it. */
export const WEAK_JOB = 0.3;

/**
 * A play's fit in words: it fits well from `well` and works from `works`. A play with a job that's a
 * stretch for whoever gets it never fits well, however good the others are at theirs (a hit that
 * needs a flash, with no one to throw one, isn't the hit to run), and with two such jobs it's a stretch.
 */
export const PLAY_FIT = { well: 0.62, works: 0.45 };
/** The most a play can fit with this many jobs given to someone weak at them: below "fits well" with one, below "works" with two or more. */
const fitCap = (weakJobs: number): number => (weakJobs > 1 ? PLAY_FIT.works : weakJobs ? PLAY_FIT.well : Infinity) - 0.01;

/**
 * How good an agent is at a job (0 to 1), the strengths they'd use, and whether that's a stand-in
 * (any way but a job's first: a smoke for a missing wall, a stun for a missing flash). With `need`,
 * what the job's step asks for (engine/uses.ts, needOf), a way that leaves part of it undone counts
 * for less: Omen's one Paranoia does half of a step that flashes two corners, so it counts three
 * quarters, and Viper's wall does more of a step that smokes two spots than her one Poison Cloud.
 */
export function jobSkill(a: Agent, job: Job, need?: (kind: UseKind) => number): { value: number; dims: Dim[]; standIn: boolean } {
  let best = { value: 0, dims: [] as Dim[], standIn: false };
  JOB_SKILLS[job].forEach((way, i) => {
    const dims = (Object.keys(way) as Dim[]).filter((d) => a.caps[d] > 0);
    let value = 0;
    for (const [d, w] of Object.entries(way) as [Dim, number][]) value += w * a.caps[d];
    if (need && value > 0) value *= coverage(a, job, dims, need);
    if (value > best.value + 1e-9) best = { value, dims, standIn: i > 0 };
  });
  return best;
}

/**
 * The abilities an agent uses for a job, the ones that do it best first: "Dark Cover", "Slow Orb and
 * Barrier Orb" (and "gun play" when the gun is all there is).
 */
function abilitiesFor(a: Agent, dims: readonly Dim[]): string[] {
  const out: string[] = [];
  for (const d of dims) for (const n of abilityNames(a.id, namedFor(a.id, a.via[d] ?? '', d))) if (!out.includes(n)) out.push(n);
  if (!out.length && dims.some((d) => a.via[d]?.includes('G'))) out.push('gun play');
  return out;
}

/**
 * Someone's job in a play. `standIn` is set when they do it another way than the job asks, so the
 * job isn't named for what they don't have: Veto has no flash, so his Chokehold stands in for one.
 */
export interface Doer { id: string; job: Job; value: number; abilities: string[]; standIn: boolean; dims: Dim[] }

/**
 * A job as said beside the agent: "Smokes with Dark Cover", "Chokehold in place of flashes", or, for
 * an agent with nothing for the job, "Smokes, without the utility for it".
 */
export function jobWords(d: Doer): string {
  if (d.value <= 0) return `${JOB_NAMES[d.job]}, without the utility for it`;
  if (d.standIn) return `${d.abilities.length ? listJoin(d.abilities) : 'Nothing'} in place of ${JOB_NAMES[d.job].toLowerCase()}`;
  return `${JOB_NAMES[d.job]}${d.abilities.length ? ` with ${listJoin(d.abilities)}` : ''}`;
}
/**
 * Utility drawn where it lands on the minimap: a smoke, a wall (from `at` to `to`), a flash, a stun
 * or concussion in place of one, or information (a dart, a drone, a reveal).
 */
export const THROW_KINDS = ['smoke', 'wall', 'flash', 'stun', 'recon'] as const;
export type ThrowKind = (typeof THROW_KINDS)[number];
export interface Throw { kind: ThrowKind; who: string; at: Spot; to?: Spot }

/** How many of each throw a step draws, at most: one per target, up to a kit's usual number, and never more than the player has (engine/uses.ts). */
export const THROW_MOST: Record<ThrowKind, number> = { smoke: 3, wall: 1, flash: 2, stun: 1, recon: 1 };
/** How long a wall is drawn (shares of the map): past its lane by `past` of the way there, between `least` and `most` long. */
export const WALL_LENGTH = { past: 0.4, least: 0.2, most: 0.4 };

/** A step filled with players; `at` is its place in the play as written (steps are shown in the order they happen). */
export interface FilledStep { jobs: Job[]; route: string[]; text: string; when: Moment; at: number; who: Doer[]; throws: Throw[] }
export interface FilledPlay {
  play: Play;
  /**
   * How well the team can run it, 0 to 1: the average of how good each player is at their job, held
   * below fitting well with one job that's a stretch, and below working with two (see PLAY_FIT), less
   * the cost of asking for more teamwork than the rank has (`short`) or of being read there (`read`).
   */
  fit: number;
  /** How much teamwork the play asks for, and what makes it so (kb/plays.ts, demandOf). */
  demand: Demand;
  needs: string[];
  /** How many ranks below the play's demand the rank it was filled for is (PLAY_RANK); 0 when none was given. */
  short: number;
  /** For a simple attack, how many ranks at or above PLAY_RANK.read.from the rank is, where defenders read it (for a simple hold, PLAY_RANK.read.defense). */
  read: number;
  /** The rank it was filled for, when one was given (it sets the round clock, see momentClock). */
  rank?: RankId;
  /** That average before it's held, which still orders plays held to the same fit. */
  average: number;
  steps: FilledStep[];
  /**
   * For a play that reads and reacts, set by playsFor: every branch, filled the same way, in the
   * order written. The play itself is the branch that fits best, and stands for them all in a list.
   */
  branches?: readonly FilledPlay[];
  /** Jobs nobody on the team is good at. */
  weak: Doer[];
  /** Where the Spike goes down, for a play on one site (see plantOf). */
  plant?: Plant;
}

/**
 * Where a play has the Spike planted: on one of its site's plant spots (kb/features.ts), the safe
 * one or the default, what that spot is, and from when it's down: a moment of the play, from its
 * start or (`end`) once that moment's players get there.
 */
export interface Plant { site: SiteId; at: Spot; safe: boolean; about: string; when: Moment; end: boolean }

/** What an agent throws for a job, by the strength they do it with: a smoke for a wall they don't have, a stun for a flash. */
function throwKind(job: Job, dims: readonly Dim[]): ThrowKind | undefined {
  const by: Partial<Record<Dim, ThrowKind>> = job === 'smoke' || job === 'wall' ? { smoke: 'smoke', wall: 'wall' }
    : job === 'flash' || job === 'clear' || job === 'retake' ? { flash: 'flash', disrupt: 'stun', recon: 'recon' }
    : job === 'recon' ? { recon: 'recon' } : {};
  return dims.map((d) => by[d]).find((k) => !!k);
}

/**
 * Where a player's utility for their job lands, on the map: smokes, flashes, stuns and information
 * on the callouts the step names (kb/plays.ts, landsOf); a wall from where they stand down or across
 * its lane, or toward what it cuts off. A wall's job done with smokes smokes off what it cuts off.
 */
export function throwsOf(mapId: string, step: PlayStep, d: Doer, dims: readonly Dim[], uses = Infinity): Throw[] {
  const map = mapById(mapId);
  const kind = d.value > 0 ? throwKind(d.job, dims) : undefined;
  if (!map || !kind || (d.job === 'retake' && kind !== 'flash' && kind !== 'stun')) return [];
  const spot = (name: string | undefined): Spot | undefined => { const c = name ? map.callouts.find((x) => x.name === name) : undefined; return c && [c.x, c.y]; };
  const targets = (names: readonly string[]) => names.map(spot).filter((x): x is Spot => !!x);
  const end = step.route[step.route.length - 1]!;
  if (kind === 'wall') {
    const lane = step.lane ?? step.on[0];
    // thrown from the end of the route, or from the spot before it when the wall runs down the lane the route ends in
    const from = spot(lane === end && step.route.length > 1 ? step.route[step.route.length - 2] : end), through = spot(lane);
    if (!from || !through) return [];
    const [dx, dy] = [through[0] - from[0], through[1] - from[1]], dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return [];
    const [ux, uy] = [dx / dist, dy / dist];
    // as long as it should be, but never off the edge of the map
    const room = Math.min(...([[ux, from[0]], [uy, from[1]]] as const).map(([u, v]) => (u > 0 ? (1 - v) / u : u < 0 ? -v / u : Infinity)));
    const length = Math.min(room, d.job === 'wall' ? Math.min(WALL_LENGTH.most, Math.max(WALL_LENGTH.least, dist * (1 + WALL_LENGTH.past))) : Math.max(WALL_LENGTH.least / 2, dist));
    // and ending on the floor, not out in the void past the map's edge
    let reach = length;
    while (reach > dist && hasFloor(mapId) && !onFloor(mapId, [from[0] + ux * reach, from[1] + uy * reach])) reach -= 0.005;
    return [{ kind, who: d.id, at: from, to: [from[0] + ux * reach, from[1] + uy * reach] }];
  }
  const on = kind === 'smoke' && d.job === 'wall' ? (step.on.length ? step.on : step.lane ? [step.lane] : []) : step.on;
  return targets(on).slice(0, Math.min(THROW_MOST[kind], uses)).map((at) => ({ kind, who: d.id, at }));
}

/** How many ranks below the rank a demand runs from (PLAY_RANK) a rank is. */
export function ranksShort(demand: Demand, rank: RankId): number {
  return Math.max(0, RANK_IDS.indexOf(PLAY_RANK.from[demand]) - RANK_IDS.indexOf(rank));
}
/**
 * For a simple attack, how many ranks at or above the one where defenders start to read it
 * (PLAY_RANK.read) a rank is; for a simple hold or a stack on defense, the same from where attackers
 * start to take mid and fake.
 */
export function ranksRead(play: Pick<Play, 'side' | 'kind'>, demand: Demand, rank: RankId): number {
  if (demand !== 1) return 0;
  const from = play.side === 'attack' ? PLAY_RANK.read.from : play.kind === 'setup' || play.kind === 'stack' ? PLAY_RANK.read.defense : undefined;
  return from ? Math.max(0, RANK_IDS.indexOf(rank) - RANK_IDS.indexOf(from) + 1) : 0;
}

/**
 * Gives each job of a play to a different agent of the team, so the play fits as well as it can (a
 * job given to someone weak at it holds the fit down, PLAY_FIT, so the most done overall isn't always
 * best), and of the ways that fit as well, the one that does the jobs best overall (all ways of
 * sharing out five jobs are tried, which is quick). With `rank`,
 * a play that asks for more teamwork than most teams there have fits that much less, and so does a
 * simple attack where defenders read it (PLAY_RANK).
 */
export function fillPlay(play: Play, team: readonly string[], rank?: RankId): FilledPlay {
  const agents = team.map((id) => agentById(id)).filter((a): a is Agent => !!a);
  const slots = play.steps.flatMap((s, step) => s.jobs.map((job) => ({ step, job })));
  const skill = slots.map((s) => { const need = needOf(play.map, play.steps[s.step]!, s.job); return agents.map((a) => jobSkill(a, s.job, need)); });
  let best: number[] = [], bestFit = -1, bestSum = -1;
  const pick: number[] = [], used = new Array<boolean>(agents.length).fill(false);
  const place = (k: number, sum: number, weakJobs: number) => {
    if (k === slots.length || pick.length === agents.length) {
      const fit = Math.min(sum / Math.max(1, slots.length), fitCap(weakJobs));
      if (fit > bestFit + 1e-9 || (fit > bestFit - 1e-9 && sum > bestSum + 1e-9)) { bestFit = fit; bestSum = sum; best = pick.slice(); }
      return;
    }
    for (let i = 0; i < agents.length; i++) {
      if (used[i]) continue;
      used[i] = true; pick.push(i);
      const v = skill[k]![i]!.value;
      place(k + 1, sum + v, weakJobs + Number(v < WEAK_JOB));
      used[i] = false; pick.pop();
    }
  };
  place(0, 0, 0);
  const steps: FilledStep[] = play.steps.map((s, at) => ({ jobs: s.jobs, route: s.route, text: s.text, when: s.when, at, who: [], throws: [] }));
  const weak: Doer[] = [];
  best.forEach((i, k) => {
    const a = agents[i]!, { job } = slots[k]!, sk = skill[k]![i]!;
    const doer: Doer = { id: a.id, job, value: sk.value, abilities: abilitiesFor(a, sk.dims), standIn: sk.standIn, dims: sk.dims };
    const step = steps[slots[k]!.step]!, written = play.steps[slots[k]!.step]!;
    step.who.push(doer);
    step.throws.push(...throwsOf(play.map, written, doer, sk.dims, usesFor(a, job, sk.dims)));
    // what this player does with what they have, when the step asks for more
    if (sk.value > 0) step.text = fitText({ jobs: written.jobs, text: step.text }, play.map, a, job, sk.dims);
    if (sk.value < WEAK_JOB) weak.push(doer);
  });
  // in the order they happen, so the play reads and runs like a replay (written order within a moment)
  const at = (m: Moment) => MOMENTS.indexOf(m);
  steps.sort((x, y) => at(x.when) - at(y.when));
  const average = slots.length ? Math.max(0, bestSum) / slots.length : 0;
  const { level: demand, needs } = demandOf(play);
  const short = rank ? ranksShort(demand, rank) : 0, read = rank ? ranksRead(play, demand, rank) : 0;
  const fit = Math.max(0, Math.min(average, fitCap(weak.length)) - short * PLAY_RANK.cost - read * PLAY_RANK.read.cost);
  const plant = plantOf(play, steps, paceOf({ play, demand }));
  return { play, fit, demand, needs, short, read, average, steps, weak, ...(rank ? { rank } : {}), ...(plant ? { plant } : {}) };
}

/** The jobs of players who go onto a site on a hit or a retake. */
const ONTO: readonly Job[] = ['entry', 'duel', 'clear', 'flash', 'retake', 'lurk'];

/**
 * How fast an attack goes: a simple hit or split, a pistol round and an eco go early and fast; a
 * default, a fake and an anti-eco round take their time over information first; anything else is a
 * set play.
 */
export function paceOf(f: Pick<FilledPlay, 'play' | 'demand'>): 'fast' | 'set' | 'slow' {
  const { kind } = f.play;
  return kind === 'pistol' || kind === 'eco' || ((kind === 'hit' || kind === 'split') && f.demand === 1) ? 'fast' : kind === 'default' || kind === 'fake' || kind === 'antieco' ? 'slow' : 'set';
}

/**
 * Where the Spike goes down in a play, from its site's plant spots. An attack plants once its
 * players are on the site: on the safe plant when it goes fast (paceOf) and comes in the way the
 * safe plant is by, since there's no time to clear the whole site first; otherwise on the default
 * plant, in the middle of the site, where the post-plant can see it from more spots. It's down
 * after the plant, or as the hit ends for a play with no steps after it; a play where nobody goes
 * onto the site (an eco that only looks for a close fight) shows none. A retake wins back a Spike
 * on the default plant, down from the start; a retake setup gives the site up and wins it back, so
 * the Spike is down on the retake. Other plays, and sites with no spots marked, have none.
 */
export function plantOf(play: Play, steps: readonly Pick<FilledStep, 'jobs' | 'route' | 'when'>[], pace: 'fast' | 'set' | 'slow'): Plant | undefined {
  const map = mapById(play.map);
  if (!map) return undefined;
  const has = (m: Moment) => steps.some((s) => s.when === m);
  // the steps that go onto a site on the hit (or the retake), and the ways they come in by
  const onto = steps.filter((s) => s.when === 'hit' && s.route.length > 1 && s.jobs.some((j) => ONTO.includes(j)) && / Site$/.test(s.route[s.route.length - 1]!));
  const site = play.site ?? mostOf(onto.map((s) => s.route[s.route.length - 1]!.charAt(0) as SiteId));
  if (!site) return undefined;
  const { plant, safe } = plantSpots(play.map, site);
  if (!plant) return undefined;
  const spot = (f: { at: Spot; about: string }, q: boolean, when: Moment, end: boolean): Plant => ({ site, at: f.at, safe: q, about: f.about, when, end });
  if (play.side === 'defense') {
    if (play.kind === 'retake') return spot(plant, false, MOMENTS.find(has) ?? 'early', false);
    return play.kind === 'fallback' && has('late') ? spot(plant, false, 'late', false) : undefined;
  }
  // an attack where nobody goes onto the site (an eco that only looks for a fight) has no plant to show
  const way = mostOf(onto.filter((s) => s.route[s.route.length - 1] === `${site} Site`).map((s) => s.route[s.route.length - 2]!));
  const w = way ? map.callouts.find((c) => c.name === way) : undefined;
  if (!w) return undefined;
  const when: Moment = has('late') ? 'late' : 'hit', end = when === 'hit';
  const far = (p: Spot) => Math.hypot(w.x - p[0], w.y - p[1]);
  return safe && pace === 'fast' && far(safe.at) < far(plant.at) ? spot(safe, true, when, end) : spot(plant, false, when, end);
}

/** Where the Spike is in a play, in a sentence: "The Spike goes down on the safe plant on B Site, just in from B Main." */
export function plantLine(play: Pick<Play, 'side'>, p: Plant): string {
  const spot = p.about.charAt(0).toLowerCase() + p.about.slice(1);
  return play.side === 'attack' ? `The Spike goes down on the ${spot}.` : `The Spike is down on the ${spot}.`;
}

/** The value that comes up most often (the first of equals), or undefined for none. */
function mostOf<T>(list: readonly T[]): T | undefined {
  const n = new Map<T, number>();
  for (const v of list) n.set(v, (n.get(v) ?? 0) + 1);
  let best: T | undefined, most = 0;
  for (const [v, k] of n) if (k > most) { best = v; most = k; }
  return best;
}

/**
 * When an attack hits, in seconds left on the round clock: a simple hit goes early, before the
 * defenders have set up their utility; a set execute at about a minute; a default or a fake waits
 * for its information. From `laterFrom` up, teams take longer over a set play and a default, since
 * they can hold space without losing players for it.
 */
export const HIT_AT = { fast: 75, set: 60, slow: 45, later: 10, laterFrom: 'ascendant' as RankId };

/** "1:05". */
export const clockTime = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Where a moment of a play falls on the round clock, in a few words ("about 1:00"), or undefined
 * when a play can't say (when the attackers hit, for a defense). A rank moves a set hit and a default later.
 */
export function momentClock(f: Pick<FilledPlay, 'play' | 'demand' | 'rank'>, m: Moment): string | undefined {
  const { side, kind } = f.play;
  const spike = `${ROUND.spike} seconds on the Spike`;
  const start = `from ${clockTime(ROUND.length)}`;
  if (side === 'defense') return kind === 'retake' ? (m === 'early' ? spike : undefined) : m === 'early' ? start : m === 'late' ? spike : undefined;
  if (m === 'early') return start;
  if (m === 'late') return spike;
  const pace = paceOf(f);
  const later = pace !== 'fast' && f.rank && RANK_IDS.indexOf(f.rank) >= RANK_IDS.indexOf(HIT_AT.laterFrom) ? HIT_AT.later : 0;
  return `about ${clockTime(HIT_AT[pace] - later)}`;
}

/** A moment's name with its place on the clock: "On the hit, about 1:00". */
export function momentLabel(f: Pick<FilledPlay, 'play' | 'demand' | 'rank'>, m: Moment): string {
  const clock = momentClock(f, m);
  return clock ? `${momentName(f.play, m)}, ${clock}` : momentName(f.play, m);
}

/**
 * What a play asks of a team, in a line: "Coordinated, since it needs two groups arriving from
 * different ways at the same moment." With a rank it's short of, it says from which rank most teams
 * run it.
 */
export function demandLine(f: Pick<FilledPlay, 'play' | 'demand' | 'needs' | 'short' | 'read'>, rank?: RankId): string {
  const d = DEMANDS[f.demand];
  const line = `${d.name}, ${f.needs.length ? `since it needs ${listJoin(f.needs)}` : d.about}.`;
  const less = `so it fits ${f.read > 2 ? 'a good deal' : 'a little'} less`;
  if (rank && f.read > 0 && f.play.side === 'attack') return `${line} From ${rankOf(PLAY_RANK.read.from).name} up, defenders hear a plan this plain coming and stack against it, ${less}.`;
  if (rank && f.read > 0) return `${line} From ${rankOf(PLAY_RANK.read.defense).name} up, attackers take mid and fake before they commit, and a hold that only waits on the sites gives them that for free, ${less}.`;
  if (!rank || f.short <= 0) return line;
  return `${line} Most teams run it well from ${rankOf(PLAY_RANK.from[f.demand]).name}. At ${rankOf(rank).name} it’s harder to pull off, so it fits ${f.short > 2 ? 'a good deal' : 'a little'} less.`;
}

/**
 * The plays a team can run on a map and side, best fit first. With sites, only plays for those
 * sites and plays for the whole map, the sites' own first (they're what was asked about), apart
 * from a stack where attackers fake (PLAY_RANK.read.defense), which waits with the whole map's; without,
 * at equal fit the simpler play comes first, then site plays before whole-map ones, except that a
 * stack (a guess at where the attackers go) comes after the setups that hold every site. On defense
 * the holds come before the retakes, because a team settles how to hold before it ever has to win a
 * site back. These are the plays for a bought round; with
 * `low`, the plays for one kind of round instead (pistol, eco and anti-eco), whatever the sites (the round decides those).
 * `more` are the plays you drew, filled and ranked the same way. With `rank`, plays that ask for
 * more teamwork than teams there usually have fit less (PLAY_RANK). A play that reads and reacts
 * comes once, as its best branch, with every branch under `branches`.
 */
/** How much bigger `x` is than `y`, with fits that differ only by rounding (sums of the same parts in another order) counted equal. */
const ahead = (x: number, y: number): number => (Math.abs(x - y) < 1e-9 ? 0 : x - y);

export function playsFor(team: readonly string[], map: string, side: Side, sites: readonly SiteId[] = [], low = false, more: readonly Play[] = [], rank?: RankId): FilledPlay[] {
  const wide = (f: FilledPlay) => Number(!f.play.site);
  // where attackers start to fake (PLAY_RANK.read.defense), a stack on the site asked is a guess at where they'll hit, so it waits with the whole map's plays
  const away = (f: FilledPlay) => Number(!f.play.site || (f.play.kind === 'stack' && f.read > 0));
  const stack = (f: FilledPlay) => Number(f.play.kind === 'stack');
  const retake = (f: FilledPlay) => Number(f.play.kind === 'retake');
  const suits = siteSuits(team, map, side);
  const on = low ? [] : sites;
  const filled = playsOn(map, side, on, more)
    .filter((p) => isRoundPlay(p.kind) === low)
    .map((p) => fillPlay(p, team, rank))
    .sort((a, b) => (on.length ? away(a) - away(b) : 0) || retake(a) - retake(b) || ahead(b.fit, a.fit) || a.demand - b.demand || ahead(b.average, a.average) || stack(a) - stack(b) || wide(a) - wide(b)
      || suits(b.play.site) - suits(a.play.site) || a.play.name.localeCompare(b.play.name));
  // a play that reads and reacts is listed once, as its best branch, carrying the others
  const out: FilledPlay[] = [];
  for (const f of filled) {
    if (!f.play.branch) { out.push(f); continue; }
    if (out.some((o) => o.play.branch && o.play.name === f.play.name)) continue;
    const ids = branchesOf(f.play).map((p) => p.id);
    out.push({ ...f, branches: filled.filter((o) => ids.includes(o.play.id)).sort((x, y) => ids.indexOf(x.play.id) - ids.indexOf(y.play.id)) });
  }
  return out;
}

/**
 * How well a team's kits meet what each site of a map asks for on a side (its needs in maps.ts), so
 * of two plays that fit the team equally, the one on the site that suits it more comes first.
 */
function siteSuits(team: readonly string[], map: string, side: Side): (site: SiteId | null) => number {
  const info = mapById(map), agents = team.map((id) => agentById(id)).filter((a) => !!a);
  const of = new Map<SiteId, number>();
  for (const s of info?.sites ?? []) {
    const needs = { ...parseNeeds(s.needs.both, s.id) };
    for (const [d, v] of Object.entries(parseNeeds(s.needs[side], s.id)) as [Dim, number][]) needs[d] = (needs[d] ?? 0) + v;
    of.set(s.id, (Object.entries(needs) as [Dim, number][]).reduce((t, [d, v]) => t + v * Math.max(0, ...agents.map((a) => a.caps[d] ?? 0)), 0));
  }
  return (site) => (site ? of.get(site) ?? 0 : 0);
}

/** A fit in words, for a play. */
export function playFitLabel(fit: number): 'Fits well' | 'Works' | 'A stretch' {
  return fit >= PLAY_FIT.well ? 'Fits well' : fit >= PLAY_FIT.works ? 'Works' : 'A stretch';
}

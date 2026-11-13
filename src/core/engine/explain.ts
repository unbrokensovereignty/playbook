/**
 * Why a team scores as it does, in plain words: its strengths and gaps for the situation, the
 * pairs that help or clash, role counts, rank and how close it is to what pros play. Everything
 * here comes from the same numbers the score does, so the reasons always match the ranking.
 */
import { AGENTS, agentById, type Agent } from '../kb/agents.ts';
import { PLAIN, fitOf, namedFor, plainKeys, type Fit } from '../kb/effects.ts';
import { PLURAL_ABILITIES, abilityNames, kitOf } from '../kb/kits.ts';
import { mapById, parseNeeds, type Side } from '../kb/maps.ts';
import { MAP_WINS } from '../kb/mapwins.ts';
import { PRO, proOverlap } from '../kb/pro.ts';
import { RADIANT } from '../kb/ranked.ts';
import { RANK_IDS, rankOf } from '../kb/ranks.ts';
import { DIMS, DIM_INFO, ROLE_IDS, roleOf, type Dim, type Role } from '../kb/roles.ts';
import { pairOf } from '../kb/synergy.ts';
import { escapeRegExp, listJoin } from '../text.ts';
import { D, N, atRank, kitShare, needsFor, viaIn, type Model, type Situation } from './model.ts';
import { BELOW_NOTE, COMFORT, KIT_NOTE, KIT_RULE_NOTE, MIX_NOTE, OPERATOR_NOTE, PLAN_NOTE, PLAY_RANK, SECOND_CONTROLLER, THREAT_NOTE, WIN_NOTE } from './weights.ts';
import { ruleWhy } from '../kb/kitfit.ts';
import { threatLine } from '../kb/counters.ts';

export interface StrengthRow {
  dim: Dim;
  /** How much the situation needs it, relative to an even share (1 = average). */
  need: number;
  /** How well the team covers it, 0 to 1. */
  cover: number;
  /** The agents who bring it, strongest first. */
  by: { id: string; value: number; abilities: string[] }[];
}

/** One thing the other team makes you play around, and how much of the answer a comp has. */
export interface AgainstRow {
  id: string;
  /** "Their Chamber holds long angles with the Operator". */
  threat: string;
  /** How far the threat goes, 0 to 1. */
  level: number;
  /** How much of what answers it the comp covers, 0 to 1, as much as each strength counts. */
  answered: number;
  /** answered, as a word: the comp has the answer, part of it or little of it (see THREAT_NOTE), or no kit answers it and it's played around. */
  verdict: 'answered' | 'partly' | 'little' | 'around';
  /** Who in the comp answers it, by the ability that does: "Omen’s Dark Cover", strongest first. */
  by: string[];
  /** How to play around it, for the rank. */
  advice: string;
  /** What the answering utility does, in place of "answers it" (ThreatDef.does). */
  does?: { one: string; many: string };
}

export interface Explanation {
  /** How the comp wins, in a sentence or two, from the strengths it covers best ("Omen smokes off angles with Dark Cover …"), or '' when nothing stands out. */
  plan: string;
  /** What the plan says, part by part (each strength, who brings it and the ability). */
  planParts: PlanPart[];
  strengths: StrengthRow[];
  pros: string[];
  cons: string[];
  /** Things worth knowing that aren't good or bad (a new agent's numbers, say). */
  notes: string[];
  /** What the other team makes you play around, most first (empty when their agents aren't known). */
  against: AgainstRow[];
}

/**
 * How to play around a gap, by strength. It's for a team short of that strength, so it never asks
 * for it. Advice that leans on another strength (`with`) has a second form for a team that's short
 * of that one too (`or`), so a comp with no flashes is never told to lean on them. `{with}` names the
 * ability of the team's that brings the most of it ("Omen’s Paranoia"), so the advice says what to use.
 * Advice that only makes sense on one side has a form for each (`attack`, `defense`, and `both` for a
 * question about both sides).
 */
type Words = string | readonly string[];
type Advice = Words | { text: Words; with: Dim; or: Words };
const MAKE_UP: Record<Dim, Advice | { attack: Advice; defense: Advice; both: Advice }> = {
  smoke: {
    attack: ['take fights from cover and avoid crossing open ground', 'cross open ground fast and together, or take a covered way in'],
    defense: ['hold from cover, and fall back to retake when the attackers’ utility lands', 'hold from cover, and rotate along covered paths instead of across open ground'],
    both: 'take fights from cover and avoid crossing open ground',
  },
  wall: { text: 'cross long sightlines one at a time, or block them with {with}', with: 'smoke', or: 'cross long sightlines one at a time, or take another way in' },
  flash: ['jiggle-peek for information and trade each other closely', 'shoulder-peek corners before anyone swings, and stay close enough to trade', 'swing in pairs, ready to trade whoever gets caught off guard'],
  recon: ['clear corners together and don’t rush in blind', 'take ground slowly and listen for footsteps before anyone commits', 'check the common spots in pairs before committing to a site'],
  entry: { text: 'use {with} to take space instead of taking the first fight', with: 'flash', or: 'take space together, a step at a time, instead of one player rushing in' },
  clear: {
    attack: ['check close corners one by one before planting', 'clear the site corner by corner, in pairs, before the plant'],
    defense: ['check close corners one by one when you retake', 'retake corner by corner, in pairs, instead of sweeping the whole site at once'],
    both: 'check close corners one by one when you take a site',
  },
  disrupt: {
    text: ['lean on {with} and close trades to win the first fight', 'open the first fight with {with} and keep a teammate close enough to trade'], with: 'flash',
    or: ['play close enough together to trade the first fight', 'take the first fight in pairs and trade a lost duel straight away'],
  },
  stall: {
    attack: 'hold the planted Spike from further back, out of a retake’s reach',
    defense: ['play a little further back, out of a rush’s reach', 'hold a step further back than usual, where a rush can’t run you over'],
    both: 'play a little further back, out of a rush’s reach',
  },
  anchor: { attack: 'hold the planted Spike in pairs', defense: ['hold sites in pairs and rotate early', 'play sites in pairs and give ground early rather than holding alone'], both: 'hold sites in pairs' },
  flank: {
    attack: 'leave one player to watch the flank', defense: 'have whoever plays nearest the rotate path listen for a push coming in behind',
    both: 'leave one player to watch the flank',
  },
  retake: {
    attack: 'fight as a group when you have to take ground back', defense: 'stop the plant where you can, and retake together with the numbers on your side',
    both: 'fight as a group when you have to take a site back',
  },
  postplant: ['play crossfires on the Spike after planting', 'set up crossfires on the Spike after planting, where a defuse means facing two of you'],
  sustain: 'play for trades and keep anyone low on health out of the next fight',
  duel: ['play together and trade every fight', 'stay close and trade every fight'],
  angles: { text: 'take long fights with a rifle from cover, or block the long sightlines with {with}', with: 'smoke', or: 'take long fights with a rifle from cover, or keep off the longest sightlines' },
  mobility: { attack: 'commit to a site early instead of rotating late', defense: 'rotate early on information instead of late', both: 'commit early instead of moving late' },
};

/**
 * One of a few ways to say the same advice, the same one every time for the same comp in the same
 * situation, so one answer reads the same on every visit while two answers don't read word for word alike.
 */
function wordsFor(w: Words, key: string): string {
  if (typeof w === 'string') return w;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return w[(h >>> 0) % w.length]!;
}

/** How much of a strength a team needs before advice can lean on it: the most a "few" gap covers. */
const LEANS_ON = 0.55;

/**
 * What having none of a role costs a team (`none`, and `so`, what follows when there's no advice to
 * give instead), the strengths whose gaps that already covers, and what three or more of it costs.
 */
const ROLE_GAP: Record<Role, { none: string; so?: string; dims: readonly Dim[]; many: string }> = {
  controller: {
    none: 'nothing smokes off the sightlines', so: 'pushes walk into open angles', dims: ['smoke', 'wall'],
    many: 'leave the rest of the team short of firepower and information',
  },
  duelist: { none: 'someone has to take the first fight without the tools for it', dims: ['entry'], many: 'leave the rest of the team short of smokes and information' },
  initiator: { none: 'nobody sets up fights with flashes and information', dims: ['flash', 'recon'], many: 'leave the rest of the team short of smokes and entry' },
  sentinel: { none: 'nobody watches the flank or holds a site alone', dims: ['anchor', 'flank'], many: 'make the team slow to take space' },
};

/**
 * A pro for a strength the comp has plenty of: what the agents who bring it do, after their names
 * or abilities ("Omen’s Dark Cover gives the team all the smokes it needs"), for one and for more.
 */
export const STRONG: Record<Dim, { one: string; many: string }> = {
  smoke: { one: 'gives the team all the smokes it needs', many: 'give the team all the smokes it needs' },
  wall: { one: 'cuts off the long sightlines', many: 'cut off the long sightlines' },
  flash: { one: 'flashes the team into its fights', many: 'flash the team into its fights' },
  recon: { one: 'finds enemies before anyone peeks', many: 'find enemies before anyone peeks' },
  entry: { one: 'makes the space to get onto a site', many: 'make the space to get onto a site' },
  clear: { one: 'clears the close corners', many: 'clear the close corners' },
  disrupt: { one: 'keeps enemies from fighting back', many: 'keep enemies from fighting back' },
  stall: { one: 'slows a push to a crawl', many: 'slow a push to a crawl' },
  anchor: { one: 'lets one player hold a site', many: 'let one player hold a site' },
  flank: { one: 'watches the flank', many: 'watch the flank' },
  retake: { one: 'takes a planted site back', many: 'take a planted site back' },
  postplant: { one: 'stops a defuse from a distance', many: 'stop a defuse from a distance' },
  sustain: { one: 'keeps players in the round', many: 'keep players in the round' },
  duel: { one: 'wins plenty of fights alone', many: 'win plenty of fights alone' },
  angles: { one: 'holds the long angles', many: 'hold the long angles' },
  mobility: { one: 'gets the team where it needs to be, fast', many: 'get the team where it needs to be, fast' },
};

const nameOf = (a: Agent) => a.name;
const sideWord = (s: Side) => (s === 'attack' ? 'attack' : 'defense');

/** Where a situation is, after other words: "on Lotus attack", "on Lotus", "on the maps in the pool". */
export function whereWords(s: Situation): string {
  const map = mapById(s.map);
  return map ? `on ${map.name}${s.side === 'both' ? '' : ` ${s.side}`}` : 'on the maps in the pool';
}

/** An ability as the agent's own: "Omen’s Paranoia", and "Viper’s Pit" as it is (its name has the agent's in it). */
export const owned = (a: Agent, name: string): string => (name.startsWith(`${a.name}’s `) ? name : `${a.name}’s ${name}`);

/**
 * The ability keys an agent brings a strength with here, in the order to name them: the ones that
 * do it first, the gun (G) last, and none that don't do it at all (kb/effects.ts, namedFor).
 */
const keysIn = (m: Model, a: Agent, d: Dim): string => namedFor(a.id, viaIn(m, a, d), d);

/** The same, for words that say what the agent brings: a way out after an Operator shot isn't Operator play, so it's left out. */
const bringsIn = (m: Model, a: Agent, d: Dim): string => [...keysIn(m, a, d)].filter((k) => k === 'G' || fitOf(a.id, k, d) !== 'escape').join('');

/** How the first ability named for a strength works for it: whether it does it, or is a way out ('escape') or a heal of the agent's own ('self'). */
function howIn(m: Model, a: Agent, d: Dim): Fit | undefined {
  const k = keysIn(m, a, d).replace('G', '')[0];
  return k ? fitOf(a.id, k, d) : undefined;
}

/**
 * An agent's main ability for a strength here, as the game names it: "Omen’s Paranoia" (or "Jett’s
 * gun play"). A strength that rests on the player more than the kit (Operator play) is just the agent.
 */
export function abilityOf(m: Model, a: Agent, dim: Dim): string {
  if (DIM_INFO[dim].unnamed) return a.name;
  const keys = bringsIn(m, a, dim);
  return owned(a, abilityNames(a.id, keys)[0] ?? (keys.includes('G') ? 'gun play' : DIM_INFO[dim].has));
}

/**
 * Every ability an agent brings a strength with here, so a list of what a team has misses none:
 * "Vyse’s Razorvine and Shear". Smokes count a controller's long wall too (Viper’s Toxic Screen is
 * a wall of smoke), and a plain strength every ability that does it (Harbor’s Storm Surge is a
 * flash). Firepower is mostly the gun, so the agent's name says it.
 */
function abilitiesOf(m: Model, a: Agent, dim: Dim): string {
  if (dim === 'duel') return a.name;
  const wall = dim === 'smoke' && a.role === 'controller' && 1 - m.miss[a.index * D + DIMS.indexOf('wall')]! > 1e-9 ? namedFor(a.id, viaIn(m, a, 'wall'), 'smoke') : '';
  const keys = [...new Set(namedFor(a.id, bringsIn(m, a, dim) + plainKeys(a.id, dim), dim) + wall)].join('');
  const names = [...new Set(abilityNames(a.id, keys))];
  if (!names.length) return abilityOf(m, a, dim);
  const [first, ...rest] = names;
  return listJoin([owned(a, first!), ...rest]);
}

/** A list whose items may have an "and" of their own: "Vyse’s Razorvine and Shear, and Cypher’s Trapwire". */
function joinGroups(items: readonly string[]): string {
  if (!items.some((x) => x.includes(' and '))) return listJoin(items);
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

/**
 * Who brings a strength, as a pro names them: "Omen’s Dark Cover", or just "Jett" for firepower, gun
 * play and the long angles her Tailwind only gets her away from. A heal of the agent's own (`self`,
 * Reyna's Devour) keeps only them in the round, so a pro says that on its own.
 */
function bringerOf(m: Model, a: Agent, dim: Dim): { words: string; plural: boolean; self?: string } {
  // firepower is mostly the gun, so the agent's name says it
  if (dim === 'duel') return { words: a.name, plural: false };
  const name = abilityNames(a.id, keysIn(m, a, dim))[0], how = howIn(m, a, dim);
  if (!name || how === 'escape') return { words: a.name, plural: false };
  if (how === 'self') return { words: a.name, plural: false, self: name };
  return { words: owned(a, name), plural: PLURAL_ABILITIES.has(name) };
}

/** Each agent's abilities and how to find them in a line, plural or not ("Brimstone’s Sky Smokes"). */
const FINDS = new Map<string, { key: string; re: RegExp }[]>();
function abilitiesIn(line: string, a: Agent): string[] {
  let finds = FINDS.get(a.id);
  if (!finds) {
    finds = (kitOf(a.id)?.abilities ?? []).filter((x) => x.key !== 'Passive')
      .map((x) => ({ key: x.key, re: new RegExp(`(?<![\\w’])${escapeRegExp(x.name)}s?(?![\\w])`) }));
    FINDS.set(a.id, finds);
  }
  return finds.filter((f) => f.re.test(line)).map((f) => `${a.id}|${f.key}`);
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What fewer or more of a role than pros run on a map costs a team; `one` is for a single one of a
 * role most pro teams there play without, where there's no "extra" one to speak of. `defense` is
 * what an extra one costs a defense, where it differs.
 */
const MIX_GAP: Record<Role, { fewer: string; more: string; one: string; defense?: string }> = {
  controller: { fewer: 'there are fewer smokes to go around', more: 'the extra smokes here cost firepower or information', one: 'firepower or information' },
  duelist: { fewer: 'there’s less firepower to take space', more: 'the extra duelist here costs utility', one: 'more utility' },
  initiator: { fewer: 'there’s less information and fewer flashes to set up fights', more: 'the extra initiator here costs firepower', one: 'more firepower' },
  sentinel: {
    fewer: 'nobody is free to watch the flank or hold a site alone', more: 'the extra sentinel here makes the team slower to take space', one: 'more smokes, information or firepower',
    defense: 'the extra sentinel here leaves less utility to retake with',
  },
};

/**
 * How the cons put a share of the pro teams on a map: under `rarely` they rarely do a thing, under
 * `few` few of them do, under `most` about half do, and from `most` most of them do.
 */
const MIX_SHARE = { rarely: 0.3, few: 0.4, most: 0.6 };
/** The share of pro teams that play a map without a role, in words. */
const withoutOne = (x: number) => (x >= MIX_SHARE.most ? 'most' : x >= MIX_SHARE.few ? 'about half the' : 'some');

/** Who the reasons are for, beyond the team itself (all optional). */
export interface ExplainFor {
  /** A solo player's, duo's or trio's own agents: the rest of the team are random teammates or locked in. */
  party?: readonly string[];
  /** Agents the player chose (must-plays) or found locked in: the cons don't argue against picking them. */
  chosen?: readonly string[];
  /** Role counts the player asked for: the cons don't argue against those either. */
  roles?: Partial<Record<Role, number>>;
  /** Agents a solo player, duo or trio won't play: a random teammate may still pick them, which a note says. */
  skipped?: readonly string[];
}

/** What a question says about who the reasons are for (see ExplainFor). */
export const explainFor = (q: { party: number; include: readonly string[]; exclude: readonly string[]; locked: readonly string[]; roles: Partial<Record<Role, number>> }, c: { party: readonly string[] }): ExplainFor =>
  ({ party: q.party < 5 ? c.party : undefined, chosen: [...q.include, ...q.locked], roles: q.roles, skipped: q.party < 5 ? q.exclude : undefined });

/** Explains a team (agent ids) in a situation's model. */
export function explainTeam(m: Model, ids: readonly string[], who: ExplainFor = {}): Explanation {
  const team = ids.map((id) => agentById(id)).filter((a): a is Agent => !!a);
  // a party's own agents; with random teammates, what only they bring or lack is theirs to choose
  const mine = who.party?.length ? team.filter((a) => who.party!.includes(a.id)) : [];
  const chosen = new Set(who.chosen ?? []);
  // which agents a con is about, where it's about agents in particular (a kit, a pair, a rate)
  const about = new Map<string, Agent[]>();
  const conAbout = (line: string, agents: Agent[]) => { cons.push(line); about.set(line, agents); };
  const s = m.situation;
  const t = rankOf(s.rank).t;
  const map = mapById(s.map);
  const sides: Side[] = s.side === 'both' ? ['attack', 'defense'] : [s.side];
  // what this map, side and site ask for beyond the usual
  const bumps = map ? sides.map((side) => needsFor(map, side, s.sites)) : [];
  const bump = (d: Dim) => (bumps.length ? bumps.reduce((acc, b) => acc + b[d], 0) / bumps.length : 0);

  const strengths: StrengthRow[] = DIMS.map((dim, j) => {
    let miss = 1;
    for (const a of team) miss *= m.miss[a.index * D + j]!;
    // what each agent brings to it at this rank, as the score counts it
    const by = team.map((a) => ({ a, value: 1 - m.miss[a.index * D + j]! })).filter((x) => x.value >= 0.3).sort((x, y) => y.value - x.value)
      .map(({ a, value }) => {
        const keys = keysIn(m, a, dim);
        return { id: a.id, value, abilities: [...abilityNames(a.id, keys), ...(keys.includes('G') ? ['gun play'] : [])] };
      });
    return { dim, need: m.weight[j]! * D, cover: 1 - miss, by };
  });

  const pros: string[] = [], cons: string[] = [], notes: string[] = [];
  // no two pros make the same point: once a pro names an ability, the others leave it be
  const praised = new Set<string>();
  const fresh = (line: string) => !team.some((a) => abilitiesIn(line, a).some((k) => praised.has(k)));
  const praise = (line: string) => { for (const a of team) for (const k of abilitiesIn(line, a)) praised.add(k); pros.push(line); };
  /** The first lines, up to a number, that name nothing an earlier pro named. */
  const praiseSome = (lines: readonly string[], most: number) => {
    let n = 0;
    for (const line of lines) if (n < most && fresh(line)) { praise(line); n++; }
  };
  const where = map ? map.name : 'most maps';
  // how to play around a gap, for the side, without leaning on a strength the team is short of too
  const key = `${s.map}|${s.side}|${s.rank}|${ids.join()}`;
  const makeUp = (d: Dim): string => {
    const entry = MAKE_UP[d];
    const x = typeof entry === 'object' && 'both' in entry ? entry[s.side] : entry;
    if (typeof x === 'string' || Array.isArray(x)) return wordsFor(x as Words, `${key}|${d}`);
    const lean = x as { text: Words; with: Dim; or: Words };
    const row = strengths.find((r) => r.dim === lean.with)!;
    if (row.cover < LEANS_ON || !row.by.length) return wordsFor(lean.or, `${key}|${d}`);
    return wordsFor(lean.text, `${key}|${d}`).replace('{with}', abilityOf(m, agentById(row.by[0]!.id)!, lean.with));
  };
  // how to play a role most pro teams on the map play without (see MIX_SHARE): a sentinel's setup
  // frees the rest of the team, and with two of them, one of them plays with the rest
  const aroundMix = (r: Role, c: number): string => {
    if (r !== 'sentinel') return '';
    const one = team.find((a) => a.role === r)!;
    if (c >= 2) return s.side === 'attack' ? 'Have one watch the flank, and bring the other along on the hit.' : s.side === 'defense' ? 'Have one hold a site alone, and play the other with the rest of the team.' : 'Have one watch the flank or hold a site alone, and play the other with the rest of the team.';
    // a sentinel with nothing in the kit for it (Sage on the flank) does it as a player
    const by = (d: Dim) => { const x = abilityOf(m, one, d); return x === owned(one, DIM_INFO[d].has) ? one.name : x; };
    const flank = by('flank'), anchor = by('anchor');
    if (s.side === 'attack') return `Let ${flank} watch the flank, so the other four can hit together.`;
    if (s.side === 'defense') return `Let ${anchor} hold a site alone, so the other four can stack the other site or rotate early.`;
    return `Let ${flank} watch the flank on attack and ${anchor === flank ? '' : `${anchor} `}hold a site alone on defense, so the other four can play together.`;
  };
  // a gap worth saying here: not flank watch on defense unless the map asks for it (defenders play
  // in front of their sites, so a flank there is a rotate path), not smokes when a long wall
  // already cuts the sightlines they would, and not stuns when the team's flashes win the first
  // fight anyway
  const coverOf = (d: Dim) => strengths.find((r) => r.dim === d)!.cover;
  // Operator play is worth a con only where the map's long angles call for it (OPERATOR_NOTE)
  const operator = !!map && bump('angles') >= OPERATOR_NOTE.map
    && (RANK_IDS.indexOf(s.rank) >= RANK_IDS.indexOf(OPERATOR_NOTE.from) || (parseNeeds(map.needs.both, map.name).angles ?? 0) >= OPERATOR_NOTE.low);
  const worthSaying = (r: StrengthRow) =>
    !(r.dim === 'flank' && s.side === 'defense' && bump('flank') < 0.15) && !(r.dim === 'smoke' && coverOf('wall') >= 0.8) && !(r.dim === 'disrupt' && coverOf('flash') >= 0.7)
    && !(r.dim === 'angles' && !operator);
  // gaps the situation would punish, biggest first
  const gaps = strengths.filter((r) => r.need >= 0.9 && r.cover < 0.55 && worthSaying(r)).sort((a, b) => b.need * (1 - b.cover) - a.need * (1 - a.cover));
  // role counts first: missing a controller matters more than anything else
  const counts = Object.fromEntries(ROLE_IDS.map((r) => [r, team.filter((a) => a.role === r).length])) as Record<Role, number>;
  ROLE_IDS.forEach((r, ri) => {
    const gap = ROLE_GAP[r];
    // (only where the score pays for having none: random teams without an initiator win as often as any, RANKED_ROLE)
    if (counts[r] === 0 && m.roleCost[ri * 5]! < 0 && (r !== 'sentinel' || s.side !== 'attack') && (r !== 'duelist' || s.side !== 'defense')) {
      // where pro teams on the map mostly play without the role, say so (see the relaxed cost in model.ts)
      const asPros = map && m.mix.relax[ri]! >= MIX_NOTE.relax ? ` (${withoutOne(1 - m.mix.want[ri]!)} pro teams play ${map.name} without one too)` : '';
      // the gaps this leaves are said here once, with how to play around them
      const left = gaps.filter((g) => gap.dims.includes(g.dim));
      for (const g of left) gaps.splice(gaps.indexOf(g), 1);
      const so = left.length ? left.map((g) => makeUp(g.dim)).join(', and ') : gap.so;
      const role = roleOf(r).name.toLowerCase();
      // random teammates may still pick one, so a party hears it as what to do if they don't
      const lead = mine.length ? `If no one picks ${/^[aeiou]/.test(role) ? 'an' : 'a'} ${role}${asPros}` : `With no ${role}${asPros}`;
      cons.push(`${lead}, ${gap.none}${so ? `, so ${so}` : ''}.`);
    } else if (counts[r] >= 3) cons.push(`${capital(numberWord(counts[r]))} ${roleOf(r).plural.toLowerCase()} ${gap.many}.`);
  });
  // a second controller needs teamwork that most teams below the top ranks don't bring (see SECOND_CONTROLLER),
  // which a team that asked for two has already weighed; a party playing both itself brings as much
  // of it as a five-stack at its rank (Model.ownSecond)
  const ownControllers = mine.filter((a) => a.role === 'controller').length;
  const paid = m.secondController - (ownControllers >= 2 ? m.ownSecond : 0);
  if (counts.controller === 2 && paid >= SECOND_CONTROLLER.note && who.roles?.controller !== 2) {
    cons.push(`Two controllers pay off only when the team plays its smokes together, and most teams at ${rankOf(s.rank).name} don’t, so the second one costs firepower or information.`);
  }
  // straying from the map's pro role mix, where it costs enough to matter (see ROLE_MIX)
  if (map) {
    ROLE_IDS.forEach((r, ri) => {
      const want = m.mix.want[ri]!, c = counts[r];
      // (none, or three or more, has its own con above)
      if (Number.isNaN(want) || c === 0 || c >= 3 || Math.abs(c - want) < MIX_NOTE.off) return;
      const costs = Array.from(m.mix.cost.subarray(ri * 5, ri * 5 + 5));
      if (Math.max(...costs) - costs[Math.min(c, 4)]! < MIX_NOTE.cost) return;
      // below Platinum, a defense's second sentinel locks a site down, which wins rounds there (claim gold-sentinel)
      if (r === 'sentinel' && c > want && s.side === 'defense' && RANK_IDS.indexOf(s.rank) < RANK_IDS.indexOf(MIX_NOTE.sentinels)) return;
      const more = (s.side === 'defense' && MIX_GAP[r].defense) || MIX_GAP[r].more;
      const role = roleOf(r);
      const n = Math.round(want), word = (k: number) => (k === 1 ? role.name : role.plural).toLowerCase();
      if (want < MIX_SHARE.most) {
        // most pro teams there run none or one, so about `want` of them run one
        const one = `${/^[aeiou]/i.test(role.name) ? 'an' : 'a'} ${role.name.toLowerCase()}`;
        const lead = want < MIX_SHARE.rarely ? `Pro teams on ${map.name} rarely run ${one}` : `${want < MIX_SHARE.few ? 'Few' : 'Only about half the'} pro teams on ${map.name} run ${one}`;
        const line = c >= 2 ? `${lead} at all, so ${more}.`
          : want < MIX_SHARE.rarely ? `${lead} and give that place to ${MIX_GAP[r].one} instead.` : `${lead}, and the rest give that place to ${MIX_GAP[r].one}.`;
        cons.push([line, aroundMix(r, c)].filter(Boolean).join(' '));
      } else cons.push(`Pro teams on ${map.name} usually run ${numberWord(n)} ${word(n)}, so ${c < want ? `with ${numberWord(c)}, ${MIX_GAP[r].fewer}` : more}.`);
    });
  }
  // what these kits do on this map, side or site in particular (kb/kitfit.ts), biggest first, and
  // what a con says the map takes from whose kit ("agent|dim"), so no pro credits them with it
  const sapped = new Set<string>(), hampered: { agent: Agent; line: string }[] = [];
  if (map) {
    const rules = team.flatMap((a) => m.kit[a.index]!).filter((k) => Math.abs(k.gain) >= KIT_RULE_NOTE.gain);
    praiseSome(rules.filter((x) => x.gain > 0).sort((a, b) => b.gain - a.gain).map((k) => ruleWhy(k.rule, map.id, s.sites)), KIT_RULE_NOTE.most);
    // one con per agent: two reasons why the same pick struggles here read as the planner arguing with itself
    const worst = rules.filter((x) => x.gain < 0).sort((a, b) => a.gain - b.gain).filter((k, i, all) => all.findIndex((x) => x.rule.agent === k.rule.agent) === i);
    for (const k of worst.slice(0, KIT_RULE_NOTE.most)) {
      conAbout(`${ruleWhy(k.rule, map.id, s.sites)} ${k.rule.around}`, [agentById(k.rule.agent)!]);
      hampered.push({ agent: agentById(k.rule.agent)!, line: ruleWhy(k.rule, map.id, s.sites) });
      for (const [d, v] of Object.entries(k.rule.bumps)) if (v < 0) sapped.add(`${k.rule.agent}|${d}`);
    }
  }
  // strengths the situation needs and the team has
  const saidMap = { pro: false, con: false };
  // (the agents a pro says win fights alone, so another doesn't say they need no help)
  const alone = new Set<string>();
  let strong = 0;
  for (const row of strengths.filter((r) => r.need >= 1 && r.cover >= 0.8).sort((a, b) => b.need * b.cover - a.need * a.cover)) {
    if (strong >= 3) break;
    // (a party's own agents named first, as its pros come first)
    let top = row.by.filter((b) => b.value >= 0.45).slice(0, 2).sort((x, y) => Number(mine.some((a) => a.id === y.id)) - Number(mine.some((a) => a.id === x.id)));
    // winning fights alone is the gun or a basic ability: an ultimate (Veto's Evolution) isn't there most rounds
    if (row.dim === 'duel') {
      top = top.filter((b) => /[^X]/.test(viaIn(m, agentById(b.id)!, 'duel')));
      if (!top.length) continue;
    }
    // an agent a con says the map takes this from isn't credited with it: the others still win their
    // own fights, but for the rest the pro stands only if whoever's left brings plenty alone
    if (top.some((b) => sapped.has(`${b.id}|${row.dim}`))) {
      top = top.filter((b) => !sapped.has(`${b.id}|${row.dim}`) && (row.dim === 'duel' || b.value >= 0.8));
      if (!top.length) continue;
    }
    const all = top.map((b) => ({ id: b.id, ...bringerOf(m, agentById(b.id)!, row.dim) }));
    // an ability another pro already named would make the same point twice, and a strength left with nobody new to name goes unsaid
    const bringers = all.filter((w) => fresh(`${w.words} ${w.self ?? ''}`));
    if (all.length && !bringers.length) continue;
    strong++;
    if (row.dim === 'duel') for (const w of bringers) alone.add(w.id);
    const who = bringers.filter((w) => !w.self), self = bringers.find((w) => w.self);
    const many = who.length > 1 || who[0]?.plural;
    // the map is named once: three pros in a row that each end on it read as a formula
    const rewarded = bump(row.dim) >= 0.15 && !saidMap.pro
      ? wordsFor([`, which ${where} rewards`, `, and ${where} rewards that`, `, which counts for a lot on ${where}`, `, which pays off on ${where}`], `${key}|${row.dim}|map`)
      : '';
    if (rewarded) saidMap.pro = true;
    // when nobody brings much of it alone, it's the team together that does
    if (who.length) praise(`${listJoin(who.map((w) => w.words))} ${many ? STRONG[row.dim].many : STRONG[row.dim].one}${rewarded}.`);
    else if (self) praise(`${self.words} ${SELF_HEAL} ${self.self}${rewarded}.`);
    else praise(`Between them, the team has plenty of ${DIM_INFO[row.dim].has}${rewarded}.`);
  }
  // the other gaps
  for (const row of gaps.slice(0, 3)) {
    const info = DIM_INFO[row.dim];
    // everyone who brings any of it, by the ability that does, so a team with a little doesn't read
    // as having none, nor as having more than it does ("only Omen’s Paranoia"); for a plain strength
    // that's everyone with an ability that does it, however little the numbers make of it
    const j = DIMS.indexOf(row.dim), brings = (a: Agent) => 1 - m.miss[a.index * D + j]!;
    const some = team.filter((a) => brings(a) > 1e-9 || plainKeys(a.id, row.dim)).sort((a, b) => brings(b) - brings(a))
      .slice(0, PLAIN.has(row.dim) ? undefined : 3).map((a) => abilitiesOf(m, a, row.dim));
    const needs = bump(row.dim) >= 0.15 && !saidMap.con;
    if (needs) saidMap.con = true;
    // nobody means nobody: an ultimate that does it still brings some, in the rounds it's ready
    const ults = some.length || !PLAIN.has(row.dim) ? [] : team.filter((a) => fitOf(a.id, 'X', row.dim) === 'does').map((a) => owned(a, abilityNames(a.id, 'X')[0]!));
    if (ults.length) cons.push(`${capital(info.has)} ${info.few ? 'come' : 'comes'} only from ${listJoin(ults)}, ${ults.length > 1 ? 'ultimates' : 'an ultimate'} most rounds don’t have${needs ? `. ${where} needs more` : ''}, so ${makeUp(row.dim)}.`);
    else if (!some.length) cons.push(`Nobody brings ${info.lacks}${needs ? `, which ${where} needs` : ''}, so ${makeUp(row.dim)}.`);
    else if (info.unnamed) cons.push(`The comp is light on ${info.lacks}${needs ? `, which ${where} needs` : ''}, so ${makeUp(row.dim)}.`);
    // three small sources aren't "only" anything: what they add up to is still a little
    // (what the map needs on top is a sentence of its own, after a list that may have an "and" or two)
    else if (some.length >= 3) cons.push(`${joinGroups(some)} bring only a ${info.few ? 'few' : 'little'} ${info.has}${needs ? `. ${where} needs more` : ''}, so ${makeUp(row.dim)}.`);
    else cons.push(`${capital(info.has)} ${info.few ? 'come' : 'comes'} only from ${joinGroups(some)}${needs ? `. ${where} needs more` : ''}, so ${makeUp(row.dim)}.`);
  }
  // a comp with no real gap still has a thinnest spot worth playing around
  if (!cons.length) {
    const thin = strengths.filter((r) => r.need >= 1 && worthSaying(r)).sort((a, b) => a.cover - b.cover)[0];
    // where an agent in the comp is there for it, the risk is leaning on their utility alone (and
    // for long angles, only a real Operator kit counts: Omen's teleport after a shot isn't one)
    const there = thin && DIM_INFO[thin.dim].unnamed ? 0.6 : 0.3;
    const from = thin ? thin.by.filter((b) => b.value >= there && !viaIn(m, agentById(b.id)!, thin.dim).includes('G')) : [];
    if (thin && thin.cover < 0.8 && (thin.by[0]?.value ?? 0) >= PLAN_NOTE.brings && from.length) {
      const info = DIM_INFO[thin.dim], lead = `${capital(info.has)} ${info.few ? 'come' : 'comes'} only from`;
      // a strength the name doesn't fit an ability to (Operator play) rests on the player, so it's
      // gone when they are; the others rest on the utility, so it's gone once that's used
      if (info.unnamed) {
        const names = from.slice(0, 2).map((b) => agentById(b.id)!.name);
        cons.push(`${lead} ${listJoin(names)}, so if ${names.length === 1 ? `${names[0]} goes` : 'they go'} down, ${makeUp(thin.dim)}.`);
      } else {
        // "only" names everyone who brings any of it, as the other gaps do ("only Sova’s Shock Bolt"
        // is wrong with Phoenix’s Hot Hands in the comp), and for a plain strength everyone with an
        // ability that does it; past three it's no longer "only" anyone
        const j = DIMS.indexOf(thin.dim), brings = (a: Agent) => 1 - m.miss[a.index * D + j]!;
        const plain = PLAIN.has(thin.dim);
        const named = team.filter((a) => from.some((b) => b.id === a.id) || (brings(a) > 1e-9 && !viaIn(m, a, thin.dim).includes('G')) || (plain && plainKeys(a.id, thin.dim)))
          .sort((a, b) => brings(b) - brings(a));
        if (!plain && named.length > 3) cons.push(`The comp is thinnest on ${info.lacks}, so ${makeUp(thin.dim)}.`);
        else {
          const abilities = named.map((a) => abilitiesOf(m, a, thin.dim));
          const one = abilities.length === 1 && !abilities[0]!.includes(' and ');
          cons.push(`${lead} ${joinGroups(abilities)}, so once ${one ? 'it’s' : 'they’re'} used, ${makeUp(thin.dim)}.`);
        }
      }
    } else if (thin && thin.cover < 0.8 && (thin.by[0]?.value ?? 0) < PLAN_NOTE.brings) cons.push(`The comp is thinnest on ${DIM_INFO[thin.dim].lacks}, so ${makeUp(thin.dim)}.`);
  }
  // pairs, by what each adds to the score here (two controllers' pair counts less where teams don't play together)
  const pairs: { strength: number; why: string; agents: Agent[] }[] = [];
  for (let i = 0; i < team.length; i++) {
    for (let k = i + 1; k < team.length; k++) {
      const p = pairOf(team[i]!.id, team[k]!.id);
      const v = m.pair[team[i]!.index * N + team[k]!.index]!;
      if (!p || Math.abs(v) < 1e-9 || (p.side !== 'both' && !sides.includes(p.side))) continue;
      // (a pair that says its side already needs no "On attack, " in front)
      const why = p.side === 'both' || sides.length === 1 || /\bon (?:attack|defense)\b/.test(p.why) ? p.why : `On ${sideWord(p.side)}, ${p.why}`;
      pairs.push({ strength: v, why: p.around ? `${why} ${p.around}` : why, agents: [team[i]!, team[k]!] });
    }
  }
  // (a pair that leans on an ability a con above says the map hampers would argue with it)
  const leansOnHampered = (why: string) => hampered.some(({ agent, line }) => abilityNames(agent.id, 'CQEX').some((n) => why.includes(`${agent.name}’s ${n}`) && line.includes(n)));
  praiseSome(pairs.filter((x) => x.strength > 0 && !leansOnHampered(x.why)).sort((a, b) => b.strength - a.strength).map((p) => p.why), 2);
  for (const p of pairs.filter((x) => x.strength < 0).sort((a, b) => a.strength - b.strength).slice(0, 1)) conAbout(p.why, p.agents);
  // rank
  const rankName = rankOf(s.rank).name;
  // how well you play your agents, where it moves the score enough to say (COMFORT)
  const comfortOf = (a: Agent) => m.fitParts.comfort?.[a.index] ?? 0;
  const mains = team.filter((a) => comfortOf(a) >= COMFORT.note), learning = team.filter((a) => comfortOf(a) <= -COMFORT.note);
  if (mains.length) pros.push(`${listJoin(mains.map(nameOf))} ${mains.length === 1 ? 'is one of your mains' : 'are among your mains'}, and at ${rankName} knowing your agent well wins fights.`);
  if (learning.length) cons.push(`You’re still learning ${listJoin(learning.map(nameOf))}, and at ${rankName} a comp does better with agents its players know well.`);
  let hard: Agent[] = [];
  if (t <= KIT_NOTE.upTo) {
    // how much of each kit's utility a team at this rank gets (gun play aside), as the score counts it
    const kit = (a: Agent) => atRank(s.rank, (x) => kitShare(a, x));
    // (one of your mains you already know well, and one you're learning has its own line above; one
    // the player chose to play is their call, but they still hear what the rank gets out of it)
    hard = team.filter((a) => kitShare(a, 0) < KIT_NOTE.hard && !a.estimate && !mains.includes(a) && !learning.includes(a)).sort((x, y) => kit(x) - kit(y));
    if (hard.length === 1) conAbout(`${hard[0]!.name} takes practice to play well, and at ${rankName} most players get only part of what the kit can do, so the pick pays off only if someone plays that agent often.`, hard);
    else if (hard.length) conAbout(`${listJoin(hard.map(nameOf))} take practice to play well, and at ${rankName} most players get only part of what their kits can do, so they pay off only if someone plays them often.`, hard);
    const easy = team.filter((a) => m.solo[a.index]! >= 0.8 && !a.estimate && !alone.has(a.id));
    if (easy.length && t < KIT_NOTE.teamwork) pros.push(`${listJoin(easy.map(nameOf))} ${easy.length === 1 ? 'works' : 'work'} well without much teamwork, which suits ${rankName}.`);
  }
  // ranked win rates, where they count (see WIN_RANKS)
  const winOf = (a: Agent) => m.fitParts.win[a.index]!;
  // a low rate is a con only where it isn't outweighed by how much pros (or players at Radiant) pick the agent here
  const pull = (a: Agent) => winOf(a) + m.fitParts.pro[a.index]! + m.fitParts.ranked[a.index]!;
  // (and only where there's something to do about it: an easy agent's rate is just the rate, and an
  // agent the player chose is theirs to play)
  // (a pro says nothing of an agent whose team lost most of its games on this map: the rate across
  // all maps would mislead there, even where most of the gap is chance)
  const lostHere = (a: Agent) => { const [won, games] = (map && MAP_WINS[map.id]?.agents[a.id]) || [50, 0]; return won < 50 && games >= WIN_NOTE.games; };
  const winners = team.filter((a) => winOf(a) >= WIN_NOTE.more && !lostHere(a)), losers = team.filter((a) => winOf(a) <= -WIN_NOTE.fewer && pull(a) <= -WIN_NOTE.fewer && a.skill >= 0.55 && !chosen.has(a.id));
  // the rate quoted is the one that counts most here: across all ranks, or Radiant's own where that's most of it
  const atTop = (a: Agent) => !!RADIANT[a.id] && Math.abs(m.fitParts.atTop[a.index]!) * 2 >= Math.abs(winOf(a));
  const rateOf = (a: Agent) => (atTop(a) ? `${Math.round(RADIANT[a.id]![1])}% at Radiant` : `${Math.round(a.win)}%`);
  const rates = (list: Agent[]) => (list.length === 1 ? `${rateOf(list[0]!)}${atTop(list[0]!) ? '' : ' of games'}` : listJoin(list.map((a) => `${a.name} ${rateOf(a)}`)));
  if (winners.length) pros.push(`${listJoin(winners.map(nameOf))} ${winners.length === 1 ? 'wins' : 'win'} more ranked games than most agents (${rates(winners)}).`);
  // agents the line before already says to pick only if someone plays them often just add their rate
  if (losers.length && losers.every((a) => hard.includes(a))) conAbout(`${listJoin(losers.map(nameOf))} also ${losers.length === 1 ? 'wins' : 'win'} fewer ranked games than most agents (${rates(losers)}).`, losers);
  else if (losers.length) {
    conAbout(`${listJoin(losers.map(nameOf))} ${losers.length === 1 ? 'wins' : 'win'} fewer ranked games than most agents (${rates(losers)}), so ${losers.length === 1 ? 'the pick is' : 'they’re'} best played by someone who knows ${losers.length === 1 ? 'that agent' : 'them'} well.`, losers);
  }
  if (t >= 0.75) {
    // (not one that pros or players at the top pick here anyway: that agent's place is earned)
    const selfish = team.filter((a) => a.solo >= 0.85 && a.role === 'duelist' && a.caps.flash + a.caps.disrupt + a.caps.smoke < 0.5 && m.fitParts.pro[a.index]! + m.fitParts.ranked[a.index]! <= 0);
    if (selfish.length) conAbout(`${listJoin(selfish.map(nameOf))} ${selfish.length === 1 ? 'brings' : 'bring'} little utility, and teams at ${rankName} punish that.`, selfish);
  }
  // pro play
  if (map && PRO[map.id]) {
    const overlap = proOverlap(map.id, team.map((a) => a.id));
    if (overlap === 5) pros.push(`Pro teams play this comp on ${map!.name}.`);
    else if (overlap === 4) pros.push(`Four of these five are in a comp pro teams play on ${map!.name}.`);
  }
  // an agent the party won't play can still be a random teammate's pick, which the team counts on
  const theirs = team.filter((a) => who.skipped?.includes(a.id) && !who.party?.includes(a.id));
  if (theirs.length && who.party) {
    const names = listJoin(theirs.map((a) => a.name));
    notes.push(`${names} ${theirs.length === 1 ? 'is' : 'are'} here as a random teammate’s likely pick. Leaving an agent out rules out only ${who.party.length === 1 ? 'your own pick' : 'your party’s picks'}.`);
  }
  for (const a of team.filter((x) => x.estimate)) notes.push(`${a.name} is new, so this comp’s fit is an early estimate and will change once there’s more play to go on.`);
  const { plan, parts: planParts } = planOf(m, strengths);
  if (mine.length) {
    // a party hears about its own agents first; what a random or locked teammate's kit does here is
    // theirs to deal with, so those cons go
    const patterns = team.map((a) => ({ a, re: new RegExp(`(?<![\\w/])${escapeRegExp(a.name)}(?![\\w/])`) }));
    const named = (line: string) => patterns.filter((n) => n.re.test(line)).map((n) => n.a);
    const ours = (line: string) => named(line).some((a) => mine.includes(a));
    const kept = cons.filter((line) => !about.has(line) || about.get(line)!.some((a) => mine.includes(a)));
    cons.splice(0, cons.length, ...kept.filter(ours), ...kept.filter((x) => !ours(x)));
    // and each of them that no pro is about gets one: the strength they bring most here, unless
    // another pro already named the ability
    for (const a of mine) {
      if (pros.some((line) => named(line).includes(a))) continue;
      const best = strengths.filter((r) => r.need >= 0.8 && !sapped.has(`${a.id}|${r.dim}`)).flatMap((r) => r.by.filter((b) => b.value >= 0.45 && b.id === a.id).map((b) => ({ r, b })))
        .sort((x, y) => y.b.value * y.r.need - x.b.value * x.r.need);
      const lines = best.map(({ r }) => {
        const d = r.dim, how = howIn(m, a, d);
        const ability = d === 'duel' || how === 'escape' ? undefined : abilityNames(a.id, keysIn(m, a, d))[0];
        return how === 'self' && ability ? `Your ${a.name} ${SELF_HEAL} ${ability}.` : `Your ${a.name} brings ${DIM_INFO[d].has}${ability ? ` with ${ability}` : ''}.`;
      });
      const line = lines.find(fresh);
      if (line) praise(line);
    }
    const ordered = [...pros.filter(ours), ...pros.filter((x) => !ours(x))];
    pros.splice(0, pros.length, ...ordered);
  }
  return { plan, planParts, strengths, pros, cons, notes, against: againstOf(m, strengths) };
}

/**
 * What a comp does with each strength, by phase of a round: taking a site and then holding the
 * plant on attack, holding and then retaking on defense. Each is what the agent does, to follow
 * their name ("Omen smokes off angles"); the ability that does it comes after ("with Dark Cover").
 */
export const PHASES: Record<'take' | 'plant' | 'hold' | 'retake', Partial<Record<Dim, string>>> = {
  take: {
    smoke: 'smokes off angles', wall: 'cuts off the long sightlines', flash: 'flashes the first fight',
    recon: 'finds the defenders', entry: 'takes space', clear: 'clears the close corners',
    disrupt: 'breaks up the defense', duel: 'wins fights', angles: 'picks from long range', mobility: 'hits fast',
  },
  plant: { postplant: 'stops the defuse', stall: 'slows the retake', anchor: 'holds the planted Spike', flank: 'watches the flank' },
  hold: {
    anchor: 'holds a site alone', stall: 'slows pushes', recon: 'spots pushes early', angles: 'holds the long angles',
    disrupt: 'stops pushes', wall: 'cuts off the long sightlines', smoke: 'smokes off the way in', flank: 'watches the flank', duel: 'wins fights',
  },
  retake: { retake: 'leads the retake', flash: 'flashes back onto the site', clear: 'clears the planted site', mobility: 'rotates fast', sustain: 'keeps the team in the fight' },
};

/** What an agent with a heal of their own does with it: "Reyna stays in the fight with Devour". */
const SELF_HEAL = 'stays in the fight with';

/**
 * One part of how a comp wins: the phase, the strength, who brings it and the ability that does
 * (none for gun play). `how` is set when the ability helps without doing it: the way out after an
 * Operator shot ('escape'), or a heal of the agent's own ('self').
 */
export interface PlanPart {
  phase: keyof typeof PHASES;
  dim: Dim;
  agent: string;
  ability?: string;
  how?: 'escape' | 'self';
}

/**
 * A part in words, after the agent's name: "takes space with Tailwind", "picks from long range with
 * Tailwind to get away", "stays in the fight with Devour", or for gun play "wins the gunfights".
 */
const planWords = (p: PlanPart): string =>
  p.ability && p.how === 'self' ? `${SELF_HEAL} ${p.ability}`
  : p.ability ? `${PHASES[p.phase][p.dim]!} with ${p.ability}${p.how === 'escape' ? ' to get away' : ''}`
  : p.dim === 'duel' ? 'wins the gunfights' : PHASES[p.phase][p.dim]!;

/**
 * Parts in a sentence, each agent named once with all they do ("Jett takes space with Tailwind and
 * wins fights with Blade Storm"), the agents in the order they first come up.
 */
function partsSentence(parts: readonly PlanPart[]): string {
  const groups: { agent: string; words: string[] }[] = [];
  for (const p of parts) {
    const g = groups.find((x) => x.agent === p.agent);
    if (g) g.words.push(planWords(p));
    else groups.push({ agent: p.agent, words: [planWords(p)] });
  }
  const clauses = groups.map((g) => `${agentById(g.agent)!.name} ${listJoin(g.words)}`);
  // clauses that have an "and" of their own are kept apart by a comma
  if (clauses.length === 2 && groups.some((g) => g.words.length > 1)) return `${clauses[0]}, and ${clauses[1]}`;
  return listJoin(clauses);
}

/**
 * How a comp wins, in a sentence or two: the strengths the situation needs that the comp covers
 * best, by phase of the round, each said as what the agent who brings most of it does, with the
 * ability. It reads off the same strengths as the score, and never names one the comp is short of
 * (see PLAN_NOTE).
 */
function planOf(m: Model, strengths: readonly StrengthRow[]): { plan: string; parts: PlanPart[] } {
  const named = new Set<string>();
  const all: PlanPart[] = [];
  const phase = (which: keyof typeof PHASES, most: number): PlanPart[] => {
    const verbs = PHASES[which];
    const out: PlanPart[] = [];
    const rows = strengths.filter((r) => verbs[r.dim] && r.need >= PLAN_NOTE.need && r.cover >= PLAN_NOTE.cover && (r.by[0]?.value ?? 0) >= PLAN_NOTE.brings);
    for (const r of [...rows].sort((a, b) => b.need * b.cover - a.need * a.cover)) {
      if (out.length >= most) break;
      const a = agentById(r.by[0]!.id)!;
      // firepower that comes from the gun and an ultimate is the gun most rounds
      const keys = keysIn(m, a, r.dim).replaceAll('G', '');
      const ability = r.dim === 'duel' && keys[0] === 'X' ? undefined : abilityNames(a.id, keys)[0];
      const how = ability ? fitOf(a.id, keys[0]!, r.dim) : undefined;
      const key = `${a.id}|${ability ?? r.dim}`;
      if (named.has(key)) continue;
      named.add(key);
      out.push({ phase: which, dim: r.dim, agent: a.id, ...(ability ? { ability } : {}), ...(how === 'escape' || how === 'self' ? { how } : {}) });
    }
    all.push(...out);
    return out;
  };
  const sentences = (main: PlanPart[], after: PlanPart[], then: string, lead = ''): string[] => {
    const out: string[] = [];
    if (main.length) out.push(`${lead}${partsSentence(main)}.`);
    if (after.length) out.push(`${then}, ${partsSentence(after)}.`);
    return out;
  };
  const attack = (lead?: string) => sentences(phase('take', PLAN_NOTE.most), phase('plant', 1), 'After the plant', lead);
  const defense = (lead?: string) => sentences(phase('hold', PLAN_NOTE.most), phase('retake', 1), 'If a site falls', lead);
  const side = m.situation.side;
  const out = side === 'attack' ? attack() : side === 'defense' ? defense() : [...attack('On attack, '), ...defense('On defense, ')];
  return { plan: out.join(' '), parts: all };
}

/** "Fewer flashes", "less information" (and "more …"): how much of a strength one comp has against another. */
const less = (d: Dim) => (d === 'disrupt' ? 'Less crowd control' : `${DIM_INFO[d].few ? 'Fewer' : 'Less'} ${DIM_INFO[d].has}`);
const more = (d: Dim) => (d === 'disrupt' ? 'More crowd control' : `More ${DIM_INFO[d].has}`);

/** Why a comp ranks below the best one: the agents it swaps, and what that gives up and gains. */
export interface Below {
  /** The best comp's agents it doesn't have, and the ones it plays instead. */
  out: string[];
  in: string[];
  /** Where it falls short and where it's better, biggest first: "Less information (Sova’s Recon Bolt)". */
  loses: string[];
  gains: string[];
}

/** One part of the score by which one comp differs from another (see belowParts). */
export interface BelowPart {
  /** Which part: a strength's id, or 'pro', 'win', 'rank', 'pair' or 'roles'. */
  key: string;
  /** How much the part moves the score of `other` against `best` (below 0: `other` gives it up). */
  size: number;
  words: string;
}

/**
 * The parts of the score (see search.ts) by which `other` differs from `best`, each at least
 * BELOW_NOTE.part: each strength's coverage, what pros pick here, ranked win rates, how the kits
 * play at this rank, the pairs and the role counts.
 */
export function belowParts(m: Model, best: readonly string[], other: readonly string[]): BelowPart[] {
  const agents = (ids: readonly string[]) => ids.map((id) => agentById(id)).filter((a): a is Agent => !!a);
  const A = agents(best), B = agents(other);
  const outs = A.filter((a) => !other.includes(a.id)), ins = B.filter((a) => !best.includes(a.id));
  const names = (list: readonly Agent[]) => listJoin(list.map(nameOf));
  const verb = (list: readonly Agent[], one: string, many: string) => (list.length === 1 ? one : many);
  const rankName = rankOf(m.situation.rank).name;
  const map = mapById(m.situation.map);
  const parts: BelowPart[] = [];
  // each strength's coverage, as the score weighs it
  DIMS.forEach((d, j) => {
    const cover = (team: readonly Agent[]) => 1 - team.reduce((p, a) => p * m.miss[a.index * D + j]!, 1);
    const size = m.weight[j]! * (cover(B) - cover(A));
    if (Math.abs(size) < BELOW_NOTE.part) return;
    // named by the ability of the agent who brought (or brings) the most of it
    const from = (size < 0 ? outs : ins).map((a) => ({ a, v: 1 - m.miss[a.index * D + j]! })).sort((x, y) => y.v - x.v)[0];
    const by = from && from.v >= 0.3 ? ` (${abilityOf(m, from.a, d)})` : '';
    parts.push({ key: d, size, words: `${size < 0 ? less(d) : more(d)}${by}` });
  });
  const sum = (arr: Float64Array, team: readonly Agent[]) => team.reduce((t, a) => t + arr[a.index]!, 0);
  const pro = sum(m.fitParts.pro, ins) - sum(m.fitParts.pro, outs);
  const where = map ? `on ${map.name}` : 'across the pool';
  if (Math.abs(pro) >= BELOW_NOTE.part) parts.push({ key: 'pro', size: pro, words: `Pro teams pick ${pro < 0 ? names(outs) : names(ins)} more ${where}` });
  const ranked = sum(m.fitParts.ranked, ins) - sum(m.fitParts.ranked, outs);
  if (Math.abs(ranked) >= BELOW_NOTE.part) {
    const who = ranked < 0 ? outs : ins;
    parts.push({ key: 'ranked', size: ranked, words: `Players at Radiant pick ${names(who)} more in ranked` });
  }
  const win = sum(m.fitParts.win, ins) - sum(m.fitParts.win, outs);
  if (Math.abs(win) >= BELOW_NOTE.part) {
    const who = win < 0 ? outs : ins;
    parts.push({ key: 'win', size: win, words: `${names(who)} ${verb(who, 'wins', 'win')} more ranked games` });
  }
  const comfort = m.fitParts.comfort ? sum(m.fitParts.comfort, ins) - sum(m.fitParts.comfort, outs) : 0;
  if (Math.abs(comfort) >= BELOW_NOTE.part) parts.push({ key: 'comfort', size: comfort, words: comfort < 0 ? 'You play its agents less well' : 'You play its agents better' });
  const rank = sum(m.fitParts.rank, ins) - sum(m.fitParts.rank, outs);
  if (Math.abs(rank) >= BELOW_NOTE.part) {
    parts.push({ key: 'rank', size: rank, words: rank < 0 ? `${names(ins)} ${verb(ins, 'is', 'are')} harder to play well at ${rankName}` : `${names(ins)} ${verb(ins, 'is', 'are')} easier to play well at ${rankName}` });
  }
  const pairs = (team: readonly Agent[]) => team.reduce((t, a, i) => t + team.slice(0, i).reduce((u, b) => u + m.pair[a.index * N + b.index]!, 0), 0);
  const pair = pairs(B) - pairs(A);
  if (Math.abs(pair) >= BELOW_NOTE.part) parts.push({ key: 'pair', size: pair, words: pair < 0 ? 'The agents work less well together' : 'The agents work better together' });
  const roles = (team: readonly Agent[]) => ROLE_IDS.reduce((t, r, ri) => t + m.roleCost[ri * 5 + Math.min(4, team.filter((a) => a.role === r).length)]!, 0);
  const role = roles(B) - roles(A);
  if (Math.abs(role) >= BELOW_NOTE.part) parts.push({ key: 'roles', size: role, words: role < 0 ? `Its mix of roles suits ${map ? map.name : 'the situation'} less well` : `Its mix of roles suits ${map ? map.name : 'the situation'} better` });
  return parts;
}

/**
 * Why `other` scores below `best`: the parts of the score it gives up and gains (belowParts), the
 * biggest first.
 */
export function whyBelow(m: Model, best: readonly string[], other: readonly string[]): Below {
  const parts = belowParts(m, best, other);
  return {
    out: best.filter((id) => agentById(id) && !other.includes(id)), in: other.filter((id) => agentById(id) && !best.includes(id)),
    loses: parts.filter((p) => p.size < 0).sort((x, y) => x.size - y.size).slice(0, BELOW_NOTE.most).map((p) => p.words),
    gains: parts.filter((p) => p.size > 0).sort((x, y) => y.size - x.size).slice(0, BELOW_NOTE.gains).map((p) => p.words),
  };
}

/** A part of the score in a few words, for swapLine: "more entry power", "fewer pro picks". */
function partWords(p: BelowPart, rankName: string): string {
  const up = p.size > 0;
  if ((DIMS as readonly string[]).includes(p.key)) {
    const w = up ? more(p.key as Dim) : less(p.key as Dim);
    return w.charAt(0).toLowerCase() + w.slice(1);
  }
  switch (p.key) {
    case 'pro': return up ? 'more pro picks' : 'fewer pro picks';
    case 'win': return up ? 'more ranked wins' : 'fewer ranked wins';
    case 'ranked': return up ? 'more picks at Radiant' : 'fewer picks at Radiant';
    case 'comfort': return up ? 'agents you play better' : 'agents you play less well';
    case 'rank': return up ? `easier to play at ${rankName}` : `harder to play at ${rankName}`;
    case 'pair': return up ? 'agents that work better together' : 'agents that work less well together';
    default: return up ? 'a better mix of roles' : 'a weaker mix of roles';
  }
}

/**
 * What sets a comp apart from the best one, in a line for its row: the agents it plays instead and
 * the biggest part of the score it gains and gives up (belowParts), as in "Phoenix for Sage: more
 * entry power, less healing". Empty when the comps are the same.
 */
export function swapLine(m: Model, best: readonly string[], other: readonly string[]): string {
  const below = whyBelow(m, best, other);
  if (!below.in.length || !below.out.length) return '';
  const parts = belowParts(m, best, other);
  const gain = parts.filter((p) => p.size > 0).sort((x, y) => y.size - x.size)[0];
  const loss = parts.filter((p) => p.size < 0).sort((x, y) => x.size - y.size)[0];
  const rankName = rankOf(m.situation.rank).name;
  const words = [gain, loss].filter((p): p is BelowPart => !!p).map((p) => partWords(p, rankName));
  const swap = `${listJoin(below.in.map((id) => nameOf(agentById(id)!)))} for ${listJoin(below.out.map((id) => nameOf(agentById(id)!)))}`;
  return words.length ? `${swap} · ${words.join(', ')}` : swap;
}

/** How a comp stands against one threat, after the threat itself: "Sova’s Recon Bolt answers it." */
export function againstWords(r: AgainstRow): string {
  if (r.verdict === 'around') return `${r.advice.charAt(0).toUpperCase()}${r.advice.slice(1)}.`;
  const many = r.by.length > 1 || (r.by.length === 1 && [...PLURAL_ABILITIES].some((n) => r.by[0]!.endsWith(n)));
  const who = listJoin(r.by), verb = (one: string, more: string) => (many ? more : one);
  if (r.does) {
    if (r.verdict === 'answered' && r.by.length) return `${who} ${verb(r.does.one, r.does.many)}.`;
    if (r.verdict === 'partly' && r.by.length) return `${who} ${verb(r.does.one, r.does.many)}, but only a little, so ${r.advice}.`;
    return `Little in this comp ${r.does.one}, so ${r.advice}.`;
  }
  if (r.verdict === 'answered') return r.by.length ? `${who} ${verb('answers', 'answer')} it.` : 'This comp has the answer.';
  if (r.verdict === 'partly') return r.by.length ? `${who} ${verb('answers', 'answer')} part of it, so ${r.advice}.` : `The comp answers only part of it, so ${r.advice}.`;
  return `Little in this comp answers it, so ${r.advice}.`;
}

/**
 * What the other team makes you play around (kb/counters.ts), for a comp with these strengths:
 * for each threat that goes far enough, how much the comp covers of the strengths that answer it,
 * as much as each counts, and who brings them.
 */
function againstOf(m: Model, strengths: readonly StrengthRow[]): AgainstRow[] {
  const row = (d: Dim) => strengths.find((r) => r.dim === d)!;
  return m.threats.filter((x) => x.level >= THREAT_NOTE.level).map((x): AgainstRow => {
    const asks = (Object.entries(x.threat.needs) as [Dim, number][]).sort((a, b) => b[1] - a[1]);
    // a team that times its plays together can add the threat's timed advice
    const advice = x.threat.timed && RANK_IDS.indexOf(m.situation.rank) >= RANK_IDS.indexOf(PLAY_RANK.from[3]) ? `${x.threat.advice}. You can also ${x.threat.timed}` : x.threat.advice;
    const threat = threatLine(x.threat, x.who.slice(0, 2).map((id) => agentById(id)!.name), listJoin);
    if (!asks.length) return { id: x.threat.id, threat, level: x.level, answered: 0, verdict: 'around', by: [], advice };
    const answered = asks.reduce((acc, [d, v]) => acc + v * row(d).cover, 0) / asks.reduce((acc, [, v]) => acc + v, 0);
    // who answers it most: each agent by the ability of theirs that answers it most, as much as the
    // threat asks for it, named as the game names it (an agent's "flashes" could be one blind)
    const best = new Map<string, { d: Dim; v: number; ability?: string }>();
    for (const [d, ask] of asks) {
      for (const b of row(d).by) {
        if (b.value < THREAT_NOTE.brings || (best.get(b.id)?.v ?? 0) >= ask * b.value) continue;
        const a = agentById(b.id)!;
        best.set(b.id, { d, v: ask * b.value, ability: DIM_INFO[d].unnamed ? undefined : abilityNames(a.id, bringsIn(m, a, d))[0] });
      }
    }
    const by = [...best].sort((a, b) => b[1].v - a[1].v).slice(0, THREAT_NOTE.by).map(([id, x]) => (x.ability ? owned(agentById(id)!, x.ability) : `${agentById(id)!.name}’s ${DIM_INFO[x.d].has}`));
    return {
      id: x.threat.id, threat, level: x.level, answered,
      verdict: answered >= THREAT_NOTE.answered ? 'answered' : answered >= THREAT_NOTE.little ? 'partly' : 'little', by, advice, does: x.threat.does,
    };
  });
}

/** The agents in a team: indices to ids. */
export const teamIds = (team: readonly number[]): string[] => team.map((i) => AGENTS[i]!.id);

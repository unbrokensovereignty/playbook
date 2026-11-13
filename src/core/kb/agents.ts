/**
 * Every agent: role, strengths and the numbers the engine weighs them by.
 *
 * Strengths are written as "dim value keys": `entry .85 E` means Tailwind (E) makes Jett very
 * strong at entry. Values run from 0 (none) to 1 (the best in the game at it); the keys name the
 * abilities behind it (C, Q, E, X, or G for the agent's gun play), so the explanations can say which
 * ability does the work. A new agent's numbers live in ./new-agents.ts.
 *
 * - `solo`: how well the agent works without the team's help (counts for more at low ranks).
 * - `skill`: how hard the agent is to play well (costs more at low ranks).
 * - `pop`: share of all ranked picks, in percent (a rough guide to what random teammates lock in).
 * - `win`: share of ranked games won by the team with the agent, in percent, across all ranks. Each
 *   source's numbers are moved so that its average pick wins 50%, then the two sources are averaged.
 *   A win rate says who plays an agent as well as how strong the agent is, so the engine only counts
 *   it within a few points of 50% (WIN_CAP in engine/weights.ts).
 * - `pro` (worked out from pro.ts): how often pro teams picked the agent at the year's top events, in
 *   percent of the maps counted there.
 *
 * Sources: the abilities are the game's own text (content.gen.ts). Pick rates: ranked shares
 * across all ranks (metabot.gg, patches 13.08 and 13.09) and pro picks at Champions 2026 (vlr.gg).
 * Win rates: metabot.gg (October 2026) and winio.ai (1 October 2026), across all ranks, as of
 * STATS_ON. Checked against metabot.gg's numbers of 5 and 11 November 2026: every agent but Hush was
 * within 0.3 points of the rate here, so the rates stand. Strength values are judgment, checked
 * against how the agents are used in pro play.
 *
 * Hush came out on 27 October 2026 (patch 13.09), after the year's last pro event, so she has no
 * pro picks yet (see PRO_CUTOFF in pro.ts). Her pick rate is from her first days across all ranks
 * (op.gg, patch 13.09: 6.8% of picks, and 46.9% of games won while players learn her, which is 47.5% once
 * moved like the others; the engine counts a new agent's win rate for half). Her strengths
 * come from her kit and hands-on reviews: a second duelist who sets the entry up rather than
 * diving first; Displacement only concusses enemies pulled into a wall or another player, so it is
 * best in tight spaces; Flashbulb is a single steerable flash; Flow is a slow, delayed move; and
 * Suspension lifts everyone it catches for 4 seconds, unable to shoot or use abilities, but is a
 * hard shot to land. Her steered utility makes her harder to play well than most duelists (metabot.gg rates her Hard), about as hard as Viper.
 *
 * Breach works alone least of the initiators: his stuns and flashes make fights for teammates who
 * follow them up, which guides for the low ranks say not to count on (ProSettings, GAMES.GG, Sequel).
 */
import { isDim, type Dim, type Role } from './roles.ts';
import { NEW_AGENTS } from './new-agents.ts';
import { proOverall } from './pro.ts';
import { diffDays } from '../dates.ts';

export interface AgentDef {
  id: string;
  name: string;
  role: Role;
  /** Strengths, as "dim value keys; …" (see above). */
  caps: string;
  solo: number;
  skill: number;
  pop: number;
  win: number;
  /** The day the agent arrived (ISO date). */
  released: string;
  /** One line in plain words: what the agent brings. */
  line: string;
  /** The numbers are early estimates (an agent too new to have much play behind it). */
  estimate?: boolean;
}

export interface Agent extends Omit<AgentDef, 'caps'> {
  index: number;
  /** How often pro teams picked the agent at the year's top events, in percent of maps (proOverall in pro.ts). */
  pro: number;
  caps: Record<Dim, number>;
  /** The ability keys behind each strength. */
  via: Partial<Record<Dim, string>>;
}

const DEFS: readonly AgentDef[] = [
  // ------------------------------------------------ duelists
  {
    id: 'jett', name: 'Jett', role: 'duelist', released: '2020-06-02', solo: 0.85, skill: 0.65, pop: 13.6, win: 49.6,
    caps: 'entry .75 E; mobility .85 EQ; duel .8 GX; angles .75 E; smoke .15 C',
    line: 'Dashes onto site first and wins duels, often with the Operator.',
  },
  {
    id: 'phoenix', name: 'Phoenix', role: 'duelist', released: '2020-06-02', solo: 0.8, skill: 0.3, pop: 3.6, win: 51.5,
    caps: 'flash .7 Q; entry .55 QX; clear .3 E; stall .3 E; postplant .15 E; retake .4 QX; sustain .3 E; wall .2 C; duel .6 GX',
    line: 'Flashes himself in, heals in his own fire and takes risk-free fights with his ultimate.',
  },
  {
    id: 'raze', name: 'Raze', role: 'duelist', released: '2020-06-02', solo: 0.7, skill: 0.6, pop: 3.2, win: 49.8,
    caps: 'entry .8 Q; clear .85 EC; mobility .6 Q; stall .35 E; postplant .45 E; recon .05 C; duel .7 GX',
    line: 'Blasts onto site and clears tight corners with grenades and her Boom Bot.',
  },
  {
    id: 'reyna', name: 'Reyna', role: 'duelist', released: '2020-06-02', solo: 1, skill: 0.45, pop: 7.2, win: 49.0,
    caps: 'duel .95 GQX; entry .5 E; flash .25 C; sustain .35 Q; mobility .35 E; angles .3 E',
    line: 'Snowballs off kills with heals and escapes, but gives the team little utility.',
  },
  {
    id: 'yoru', name: 'Yoru', role: 'duelist', released: '2021-01-12', solo: 0.55, skill: 0.85, pop: 3.5, win: 48.2,
    caps: 'flash .7 Q; entry .8 E; mobility .75 E; recon .4 CX; duel .6 G; angles .35 E',
    line: 'Teleports and flashes from unexpected angles, which makes him strong for fakes and lurks.',
  },
  {
    id: 'neon', name: 'Neon', role: 'duelist', released: '2022-01-11', solo: 0.7, skill: 0.9, pop: 5.5, win: 50.9,
    caps: 'entry .95 E; mobility .95 E; wall .5 C; smoke .1 C; disrupt .5 Q; duel .75 GX',
    line: 'The fastest entry in the game, with walls to cross and stuns to clear.',
  },
  {
    id: 'iso', name: 'Iso', role: 'duelist', released: '2023-10-31', solo: 0.85, skill: 0.6, pop: 1.2, win: 47.7,
    caps: 'duel .85 EX; entry .55 C; wall .3 C; disrupt .3 Q',
    line: 'A shield and a moving wall make him hard to beat in a straight fight.',
  },
  {
    id: 'waylay', name: 'Waylay', role: 'duelist', released: '2025-03-04', solo: 0.7, skill: 0.7, pop: 3.9, win: 48.6,
    caps: 'entry .8 Q; mobility .85 QE; disrupt .45 CX; stall .3 C; duel .75 G; angles .35 E',
    line: 'Dashes in, slows the defenders with light and zips back to safety.',
  },
  {
    id: 'hush', name: 'Hush', role: 'duelist', released: '2026-10-27', solo: 0.6, skill: 0.85, pop: 6.8, win: 47.5,
    caps: 'disrupt .45 EX; entry .5 EQ; flash .45 Q; clear .25 E; mobility .3 C; retake .45 X; postplant .2 X; stall .25 E; duel .6 G',
    line: 'Steers a flash and a pulling blast around corners, and her ultimate lifts everyone it reaches off the ground.',
  },
  ...NEW_AGENTS,
  // ------------------------------------------------ initiators
  {
    id: 'sova', name: 'Sova', role: 'initiator', released: '2020-06-02', solo: 0.5, skill: 0.6, pop: 8.1, win: 51.2,
    caps: 'recon .95 EC; clear .5 Q; postplant .85 QX; retake .6 EX; duel .3 G',
    line: 'Finds enemies with darts and his drone, and stops defuses with lineups.',
  },
  {
    id: 'breach', name: 'Breach', role: 'initiator', released: '2020-06-02', solo: 0.25, skill: 0.55, pop: 0.5, win: 46.8,
    caps: 'flash .65 Q; disrupt .95 EX; clear .55 C; retake .8 X; postplant .35 C; entry .3 E',
    line: 'Stuns and flashes through walls so the duelists walk into dazed enemies.',
  },
  {
    id: 'skye', name: 'Skye', role: 'initiator', released: '2020-10-27', solo: 0.45, skill: 0.55, pop: 2.4, win: 49.9,
    caps: 'flash .7 E; recon .5 QX; clear .55 Q; disrupt .3 Q; retake .7 EX; sustain .6 C',
    line: 'Guides her own flashes, scouts with a dog and heals the team.',
  },
  {
    id: 'kayo', name: 'KAY/O', role: 'initiator', released: '2021-06-22', solo: 0.45, skill: 0.55, pop: 0.4, win: 45.6,
    caps: 'flash .8 Q; disrupt .7 EX; recon .2 E; clear .45 C; postplant .45 C; retake .7 X; entry .3 X',
    line: 'Flashes and suppresses enemy abilities, and his ultimate wins retakes.',
  },
  {
    id: 'fade', name: 'Fade', role: 'initiator', released: '2022-04-27', solo: 0.5, skill: 0.6, pop: 5.4, win: 50.8,
    caps: 'recon .9 EC; disrupt .55 Q; clear .45 C; flash .2 C; retake .75 X; postplant .4 Q',
    line: 'Reveals enemies with Haunt and her Prowlers, and tethers them in place.',
  },
  {
    id: 'gekko', name: 'Gekko', role: 'initiator', released: '2023-03-07', solo: 0.55, skill: 0.5, pop: 0.2, win: 48.5,
    caps: 'flash .65 E; disrupt .55 QX; clear .55 QC; postplant .7 CQ; recon .35 Q; retake .65 QX',
    line: 'Sends out creatures that flash, stun and plant or defuse the Spike, then picks them back up to use again.',
  },
  {
    id: 'tejo', name: 'Tejo', role: 'initiator', released: '2025-01-08', solo: 0.5, skill: 0.6, pop: 0.9, win: 49.2,
    caps: 'recon .65 C; disrupt .55 QC; clear .75 E; postplant .95 EX; retake .7 X',
    line: 'Missiles and a stealth drone that clear sites and stop defuses from afar.',
  },
  // ------------------------------------------------ controllers
  {
    id: 'brimstone', name: 'Brimstone', role: 'controller', released: '2020-06-02', solo: 0.7, skill: 0.3, pop: 0.6, win: 49.6,
    caps: 'smoke .8 E; postplant .85 QX; clear .45 Q; stall .5 Q; retake .45 X; entry .05 C; duel .3 C; mobility .1 C',
    line: 'Three quick smokes for an execute, and the best post-plant mollies.',
  },
  {
    id: 'viper', name: 'Viper', role: 'controller', released: '2020-06-02', solo: 0.45, skill: 0.8, pop: 1.8, win: 49.8,
    caps: 'smoke .6 Q; wall .95 E; postplant .85 CX; stall .6 CQE; anchor .35 X; clear .4 C; retake .35 X',
    line: 'Long toxic walls and the strongest post-plant, at her best on big, open maps.',
  },
  {
    id: 'omen', name: 'Omen', role: 'controller', released: '2020-06-02', solo: 0.7, skill: 0.45, pop: 2.4, win: 46.5,
    caps: 'smoke .9 E; flash .5 Q; mobility .55 CX; stall .25 E; retake .35 Q; entry .2 C; duel .35 G; angles .45 C',
    line: 'Fast-recharging smokes and a nearsight that suit any map.',
  },
  {
    id: 'astra', name: 'Astra', role: 'controller', released: '2021-03-02', solo: 0.25, skill: 0.9, pop: 1.2, win: 47.3,
    caps: 'smoke .9 E; wall .7 X; disrupt .55 QC; stall .55 QC; postplant .4 CQ; retake .55 QC',
    line: 'Stars placed anywhere on the map for smokes, stuns and pulls.',
  },
  {
    id: 'harbor', name: 'Harbor', role: 'controller', released: '2022-10-18', solo: 0.4, skill: 0.55, pop: 0.3, win: 46.5,
    caps: 'wall .85 Q; smoke .65 E; disrupt .55 CX; flash .25 C; stall .45 QC; entry .3 Q; retake .45 X',
    line: 'Water walls that slow anyone crossing, and a shielded smoke.',
  },
  {
    id: 'clove', name: 'Clove', role: 'controller', released: '2024-03-26', solo: 0.85, skill: 0.35, pop: 13.9, win: 53.3,
    // patch 13.09: Pick-me-up's speed went from 15% to 10%, and killing Clove after Not Dead Yet
    // gives the killer an ultimate point and a step toward their signature ability
    caps: 'smoke .8 E; entry .4 CX; clear .3 Q; sustain .15 C; duel .45 GX; mobility .25 C',
    line: 'Smokes even after dying, so they can play aggressively like a duelist.',
  },
  {
    id: 'miks', name: 'Miks', role: 'controller', released: '2026-03-18', solo: 0.5, skill: 0.55, pop: 0.9, win: 47.9,
    caps: 'smoke .8 E; disrupt .5 CX; sustain .4 C; entry .35 Q; mobility .3 Q; stall .3 X; retake .4 X',
    line: 'Smokes from a map, a pulse that stuns or heals, and a stim that speeds up a partner.',
  },
  // ------------------------------------------------ sentinels
  {
    id: 'sage', name: 'Sage', role: 'sentinel', released: '2020-06-02', solo: 0.7, skill: 0.2, pop: 1.3, win: 51.9,
    caps: 'sustain .95 EX; stall .8 CQ; anchor .55 CQ; wall .25 C; retake .4 X; postplant .35 Q; entry .15 C; disrupt .05 Q',
    line: 'Heals and revives teammates, and stops a push with a wall or a slow.',
  },
  {
    id: 'cypher', name: 'Cypher', role: 'sentinel', released: '2020-06-02', solo: 0.55, skill: 0.6, pop: 3.2, win: 50.6,
    caps: 'flank .95 C; anchor .75 CQE; recon .6 EX; stall .45 C; smoke .1 Q; retake .15 X; postplant .2 Q; disrupt .1 C',
    line: 'Tripwires and a camera that watch flanks better than anyone.',
  },
  {
    id: 'killjoy', name: 'Killjoy', role: 'sentinel', released: '2020-08-04', solo: 0.6, skill: 0.45, pop: 1.8, win: 51.0,
    caps: 'anchor .85 CQE; flank .6 QE; stall .7 CX; postplant .7 C; recon .25 E; retake .5 X; clear .3 C',
    line: 'Turret and bots lock down a site, and her ultimate wins retakes.',
  },
  {
    id: 'chamber', name: 'Chamber', role: 'sentinel', released: '2021-11-16', solo: 0.7, skill: 0.75, pop: 10.4, win: 49.1,
    caps: 'angles .95 EX; duel .75 GQ; flank .6 C; anchor .75 CE; mobility .45 E; stall .25 C; disrupt .1 C',
    line: 'Holds long angles with his rifle and teleports out before anyone can trade.',
  },
  {
    id: 'deadlock', name: 'Deadlock', role: 'sentinel', released: '2023-06-27', solo: 0.45, skill: 0.5, pop: 0.6, win: 49.7,
    caps: 'stall .8 CE; anchor .7 EQ; flank .65 Q; disrupt .3 CQ; retake .35 X',
    line: 'Barrier walls and sound sensors that stop a rush cold.',
  },
  {
    id: 'vyse', name: 'Vyse', role: 'sentinel', released: '2024-08-27', solo: 0.5, skill: 0.6, pop: 1.3, win: 50.4,
    caps: 'anchor .8 CQ; stall .7 CQ; flank .7 Q; flash .45 E; disrupt .4 X; postplant .45 C; retake .5 X',
    line: 'Hidden walls and thorns trap attackers, and her ultimate jams their rifles.',
  },
  {
    id: 'veto', name: 'Veto', role: 'sentinel', released: '2025-10-07', solo: 0.55, skill: 0.55, pop: 0.6, win: 48.8,
    caps: 'anchor .65 QE; flank .6 Q; stall .55 Q; mobility .35 C; disrupt .35 Q; duel .5 X; angles .35 C',
    line: 'Destroys incoming utility, traps attackers and teleports to hold two places at once.',
  },
];

/** "entry .85 E; mobility .9 EQ" → strengths and the keys behind them. Throws on a typo, so a bad edit fails the tests. */
export function parseCaps(spec: string, who: string): { caps: Partial<Record<Dim, number>>; via: Partial<Record<Dim, string>> } {
  const caps: Partial<Record<Dim, number>> = {}, via: Partial<Record<Dim, string>> = {};
  for (const part of spec.split(';').map((p) => p.trim()).filter(Boolean)) {
    const [dim, value, keys = ''] = part.split(/\s+/);
    const v = Number(value);
    if (!isDim(dim) || !Number.isFinite(v) || v < 0 || v > 1 || !/^[CQEXG]*$/.test(keys)) throw new Error(`${who}: can't read the strength "${part}"`);
    caps[dim] = v;
    if (keys) via[dim] = keys;
  }
  return { caps, via };
}

const DIMS_ZERO = (): Record<Dim, number> => ({ smoke: 0, wall: 0, flash: 0, recon: 0, entry: 0, clear: 0, disrupt: 0, stall: 0, anchor: 0, flank: 0, retake: 0, postplant: 0, sustain: 0, duel: 0, angles: 0, mobility: 0 });

export const AGENTS: readonly Agent[] = DEFS.map((d, index) => {
  const { caps, via } = parseCaps(d.caps, d.name);
  return { ...d, index, caps: { ...DIMS_ZERO(), ...caps }, via, pro: d.estimate ? 0 : proOverall(d.id) };
});

export type AgentId = string;
const BY_ID = new Map(AGENTS.map((a) => [a.id, a]));
export const agentById = (id: string): Agent | undefined => BY_ID.get(id);
export const isAgent = (v: unknown): v is AgentId => typeof v === 'string' && BY_ID.has(v);
/** Agents in name order, as the pickers list them. */
export const AGENTS_BY_NAME: readonly Agent[] = [...AGENTS].sort((a, b) => a.name.localeCompare(b.name));
/** An agent that came out within this many days counts as new. */
export const NEW_DAYS = 60;
/** New on `today` (a day key): coming soon, out within NEW_DAYS, or still an estimate. */
export const isNew = (a: { released: string; estimate?: boolean }, today: string): boolean => !!a.estimate || diffDays(a.released, today) <= NEW_DAYS;
/** The day the pick rates were taken. */
export const STATS_ON = '2026-10-29';
/** The agent's pick rate comes from their first weeks, when players are still learning them. */
export const earlyStats = (a: { released: string }): boolean => diffDays(a.released, STATS_ON) < NEW_DAYS;

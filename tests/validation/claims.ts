// The expert claims register: what coaches, analysts and guide writers say about comps, maps and
// ranks, each with at least two independent sources, and how the engine is checked against it.
// tests/unit/validation.test.ts runs every claim that has a check; a claim without one is for the
// graded review (docs/VALIDATION.md). Node only. Sources were read on 5, 6 and 12 November 2026.
import { comfortValue, solve, type SituationAnswer } from '../../src/core/engine/plan.ts';
import { newQuery } from '../../src/core/engine/query.ts';
import { playsFor } from '../../src/core/engine/plays.ts';
import { agentById } from '../../src/core/kb/agents.ts';
import { MAPS, POOL } from '../../src/core/kb/maps.ts';
import type { RankId } from '../../src/core/kb/ranks.ts';
import type { PartySize } from '../../src/core/engine/query.ts';
import type { Role } from '../../src/core/kb/roles.ts';

export interface Source { name: string; url: string; date: string }

export const SOURCES = {
  thespikeMaps: { name: 'THESPIKE.GG, Best agents for each VALORANT map', url: 'https://www.thespike.gg/valorant/maps/best-agents-for-each-valorant-map', date: '2023-06-29' },
  hotspawnMaps: { name: 'Hotspawn, Best agents for every VALORANT map', url: 'https://www.hotspawn.com/valorant/guide/best-agents-for-every-valorant-map', date: '2026-05-13' },
  hotspawnComps: { name: 'Hotspawn, VALORANT best team comps for ranked play in 2026', url: 'https://www.hotspawn.com/?p=94872', date: '2026-05-13' },
  wecoach: { name: 'WeCoach, Best agents for each VALORANT map', url: 'https://wecoach.gg/blog/article/best-agents-for-each-valorant-map', date: '2026-07-19' },
  mobalytics: { name: 'Mobalytics, Best team comps for each map (from Champions play)', url: 'https://mobalytics.gg/blog/valorant/best-team-comps-each-map/', date: 'undated' },
  champions26: { name: 'THESPIKE.GG, Omen continues to dominate at VALORANT Champions 2026', url: 'https://www.thespike.gg/valorant/news/the-shadow-king-of-vct-omen-continues-to-dominate-at-valorant-champions-2026/9077', date: '2026-10' },
  santiago26: { name: 'THESPIKE.GG, Analysing the agent meta at Masters Santiago', url: 'https://www.thespike.gg/valorant/news/viper-and-yoru-still-on-top-analysing-the-agent-meta-at-valorant-masters-santiago/7796', date: '2026-03' },
  prosettings: { name: 'ProSettings.net, Improving in VALORANT: tips for each rank', url: 'https://prosettings.net/blog/valorant-tips-for-each-rank/', date: 'undated' },
  gosu: { name: 'Gosu Academy, How to rank up fast in VALORANT (coaches’ tips)', url: 'https://gosuacademy.com/blogs/news/how-to-rank-up-fast-in-valorant-pro-tips-from-coaches-whove-trained-5-000-players', date: '2026-03-17' },
  earlygame: { name: 'EarlyGame, How to get out of Bronze and Silver in VALORANT', url: 'https://earlygame.com/valorant/improve-from-bronze-silver-valorant', date: '2021-08-14' },
  sequel26: { name: 'Sequel, VALORANT agent tier list for all ranks', url: 'https://sequelgame.com/valorant-agent-tier-list-for-all-ranks/', date: '2026-07-03' },
  gamesgg26: { name: 'GAMES.GG, VALORANT agent tier list: best picks to climb ranked', url: 'https://games.gg/hi/valorant/guides/valorant-agent-tier-list-best-picks-to-climb-ranked-now/', date: '2026-03-31' },
  thespikeAbyss: { name: 'THESPIKE.GG, Best VALORANT team composition for Abyss', url: 'https://www.thespike.gg/valorant/agents/best-valorant-team-composition-for-abyss', date: '2024-10-11' },
  dodgeAbyss: { name: 'dodge.gg, Best agents and weapons for Abyss (2026)', url: 'https://www.dodge.gg/valorant/news/abyss-map-guide-2026', date: '2026-03-21' },
  dodgeCorrode: { name: 'dodge.gg, Best agents and weapons for Corrode (2026)', url: 'https://www.dodge.gg/valorant/news/corrode-map-guide-2026', date: '2026-03-21' },
  esportnowSummit: { name: 'esportnow, VALORANT Summit best agents guide', url: 'https://esportnow.gg/valorant/news/valorant-summit-best-agents-guide', date: '2026-06-29' },
  vlrStage2: { name: 'vlr.gg, VCT 2026 Americas Stage 2 agent picks by map', url: 'https://www.vlr.gg/event/agents/2977/vct-2026-americas-stage-2', date: '2026' },
  vlrToronto: { name: 'vlr.gg, VCT 2025 Masters Toronto agent picks by map (the last top event on Icebox)', url: 'https://www.vlr.gg/event/agents/2282/valorant-masters-toronto-2025', date: '2025-06' },
  vlrKickoffs: { name: 'vlr.gg, VCT 2026 Kickoff agent picks by map (Americas, Pacific, EMEA, China)', url: 'https://www.vlr.gg/event/agents/2682/vct-2026-americas-kickoff', date: '2026-02' },
  prosettingsSolo: { name: 'ProSettings.net, Best solo queue agents in VALORANT', url: 'https://prosettings.net/blog/best-solo-queue-agents-in-valorant/', date: '2026-08-14' },
  dodgeIcebox: { name: 'dodge.gg, Best agents and weapons for Icebox (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/icebox-map-guide-2026', date: '2026-03-21' },
  dodgePearl: { name: 'dodge.gg, Best agents and weapons for Pearl (2026)', url: 'https://www.dodge.gg/news/valorant/pearl-map-guide-2026', date: '2026' },
  strafe26: { name: 'STRAFE, VALORANT agent tier list: best agents to climb in ranked', url: 'https://strafe.com/news/read/valorant-agent-tier-list-best-agents-to-climb-in-ranked/', date: '2026-06-10' },
  switchblade26: { name: 'Switchblade Gaming, Best ranked agents in VALORANT (2026)', url: 'https://www.switchbladegaming.com/valorant/best-ranked-agents-2026/', date: '2026-07-04' },
  boostingSolo: { name: 'BoostingMarket, Best VALORANT agents for solo queue, rank by rank', url: 'https://boostingmarket.com/blogs/valorant-best-agents-solo-queue/', date: '2026-07-12' },
  esportstalesRanks: { name: 'Esports Tales, VALORANT tier list and most played agents by rank (Blitz numbers, August 2026)', url: 'https://www.esportstales.com/valorant/tier-list-and-most-played-agents', date: '2026-08' },
  agentselectRoles: { name: 'AgentSelect, The most important role in VALORANT? (Blitz numbers, Diamond and up)', url: 'https://agentselect.net/news/the-most-important-role-in-valorant/', date: 'undated' },
  metabotComps: { name: 'metabot.gg, Most played VALORANT team comps in ranked', url: 'https://metabot.gg/en/valorant/comps/matches', date: '2026-11-05' },
  swiftboost26: { name: 'SwiftBoost, Best VALORANT agents for Iron to Immortal in 2026', url: 'https://swiftboost.gg/blog/articles/valorant/best-valorant-agents-iron-gold-2026', date: '2026-07-28' },
  dignitasBeginners: { name: 'Dignitas, Best agents for beginners to learn in VALORANT', url: 'https://dignitas.gg/articles/best-agents-for-beginners-to-learn-in-valorant', date: '2021-12-02' },
  dignitasRush: { name: 'Dignitas, When should you actually 5-man push in VALORANT', url: 'https://dignitas.gg/articles/when-should-you-actually-5-man-push-in-valorant', date: 'undated' },
  sportskeedaRoles: { name: 'Sportskeeda, Best agent roles for every rank in VALORANT', url: 'https://www.sportskeeda.com/valorant/best-agents-roles-every-rank-valorant', date: 'undated' },
  rankforgeGold: { name: 'RankForge, How to get out of Gold in VALORANT (2026 guide)', url: 'https://rankforge.gg/blog/how-to-get-out-of-gold-valorant', date: '2026-06-23' },
  upforgePlat: { name: 'Upforge, How to climb from Platinum to Diamond in VALORANT', url: 'https://upforge.gg/blog/how-to-climb-platinum-to-diamond-valorant', date: '2026-03-10' },
  upforgePlatCoaching: { name: 'Upforge, VALORANT coaching for Platinum players', url: 'https://upforge.gg/valorant/coaching/platinum', date: 'undated' },
  vlrLowElo: { name: 'vlr.gg forum, Best agents for each role in low elo', url: 'https://www.vlr.gg/760071/best-agents-for-each-role-in-low-elo', date: '2026' },
  vlrInitiators: { name: 'vlr.gg forum, Which initiator for solo queue (Gold)', url: 'https://vlr.gg/post/4218334', date: '2026' },
  metabotAgents: { name: 'metabot.gg, Highest win rate VALORANT agents, all ranks', url: 'https://metabot.gg/en/valorant/agents/win-rate', date: '2026-11-05' },
  metabotHush: { name: 'metabot.gg, Hush guide (difficulty and ranked numbers)', url: 'https://metabot.gg/en/valorant/agent/Hush/overview', date: '2026-11-06' },
  itechHush: { name: 'iTechGuides, Is Hush worth unlocking in VALORANT?', url: 'https://www.itechguides.com/hush-in-valorant-is-she-worth-unlocking-strengths-weaknesses-and-ideal-players/', date: '2026-10-30' },
  spind1309: { name: 'valorant-spind, Agent pick and win rates for patch 13.09 (op.gg, Platinum and up)', url: 'https://www.valorant-spind.de/en/valorant-agenten-pickrates.html', date: '2026-10-30' },
  dakgg: { name: 'dak.gg, VALORANT agent statistics (last 24 hours)', url: 'https://dak.gg/valorant/en/statistics/agents', date: '2026-11-06' },
  dodgeAscent: { name: 'dodge.gg, Best agents and weapons for Ascent (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/ascent-map-guide-2026', date: '2026-03-21' },
  dodgeBind: { name: 'dodge.gg, Best agents and weapons for Bind (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/bind-map-guide-2026', date: '2026-03-21' },
  dodgeSplit: { name: 'dodge.gg, Best agents and weapons for Split (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/split-map-guide-2026', date: '2026-03-21' },
  dodgeHaven: { name: 'dodge.gg, Best agents and weapons for Haven (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/haven-map-guide-2026', date: '2026-03-21' },
  dodgeBreeze: { name: 'dodge.gg, Best agents and weapons for Breeze (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/breeze-map-guide-2026', date: '2026-03-21' },
  dodgeFracture: { name: 'dodge.gg, Best agents and weapons for Fracture (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/fracture-map-guide-2026', date: '2026-03-21' },
  dodgeSunset: { name: 'dodge.gg, Best agents and weapons for Sunset (2026)', url: 'https://www.dodge.gg/en-US/valorant/news/sunset-map-guide-2026', date: '2026-03-21' },
  dodgeLotus: { name: 'dodge.gg, Best agents and weapons for Lotus (2026)', url: 'https://www.dodge.gg/news/valorant/lotus-map-guide-2026', date: '2026' },
} as const satisfies Record<string, Source>;
type SourceId = keyof typeof SOURCES;

export interface Claim {
  id: string;
  /** The claim, in the sources' sense, in one sentence. */
  text: string;
  sources: readonly SourceId[];
  /** How the engine is checked against it: true when it holds. Without one, it's for the graded review. */
  check?: () => boolean | string;
  /** Why a claim isn't checked, or where the sources disagree with this year's pro play. */
  note?: string;
}

const answers = new Map<string, SituationAnswer>();
/** The answer for a map (or 'any') on both sides at a rank, its ten best comps: for a five-stack, or a party of `party` with random teammates. */
export function ask(map: string, rank: RankId, party: PartySize = 5): SituationAnswer {
  const k = `${map} ${rank} ${party}`;
  if (!answers.has(k)) answers.set(k, solve({ ...newQuery(rank, true), map, side: 'both', party }, { map, side: 'both', rank, sites: [] }, 10));
  return answers.get(k)!;
}
export const forgetClaims = () => answers.clear();

const TOP: readonly RankId[] = ['immortal', 'radiant'];
const RANKED: readonly RankId[] = ['gold', 'platinum', 'diamond'];
const ALL: readonly RankId[] = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal', 'radiant'];
const roleCount = (team: readonly string[], role: Role) => team.filter((id) => agentById(id)!.role === role).length;
const best = (map: string, rank: RankId) => ask(map, rank).comps[0]!.team;

/** Every rank given passes `fn` on the best comp, or the first that doesn't says so. */
const atEach = (ranks: readonly RankId[], map: string, fn: (team: readonly string[]) => boolean) => (): true | string => {
  for (const r of ranks) if (!fn(best(map, r))) return `${map} at ${r}: ${best(map, r).join(' ')}`;
  return true;
};
/** The agent is in the best comp at each rank given. */
const inBest = (map: string, agent: string, ranks: readonly RankId[]) => atEach(ranks, map, (t) => t.includes(agent));
/** The agent is in one of the `k` best comps at each rank given. */
const inTop = (map: string, agent: string, ranks: readonly RankId[], k = 3) => (): true | string => {
  for (const r of ranks) if (!ask(map, r).comps.slice(0, k).some((c) => c.team.includes(agent))) return `${map} at ${r}: ${ask(map, r).comps.slice(0, k).map((c) => c.team.join(' ')).join(' | ')}`;
  return true;
};
/** Both checks hold. */
const both = (a: () => true | string, b: () => true | string) => (): true | string => { const x = a(); return x === true ? b() : x; };
const anyOf = (map: string, agents: readonly string[], ranks: readonly RankId[]) => atEach(ranks, map, (t) => agents.some((a) => t.includes(a)));
/** An agent's fit and tier on a map (or 'any') at a rank, for a five-stack (or a party of `party`) on both sides. */
const agentAt = (map: string, rank: RankId, id: string, party: PartySize = 5) => ask(map, rank, party).agents.find((a) => a.id === id)!;
/** The middle agent's fit there, as shown (a whole number). */
const middle = (map: string, rank: RankId, party: PartySize = 5) => { const xs = ask(map, rank, party).agents.map((a) => a.fit).sort((a, b) => a - b); return Math.round(xs[Math.floor(xs.length / 2)]!); };
const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];
/** The agent's tier is `tier` or better (`atLeast`), or `tier` or worse, at each rank given. */
const tierAt = (id: string, ranks: readonly RankId[], tier: string, atLeast = true, party: PartySize = 5) => (): true | string => {
  for (const r of ranks) {
    const a = agentAt('any', r, id, party), i = TIER_ORDER.indexOf(a.tier), want = TIER_ORDER.indexOf(tier);
    if (atLeast ? i > want : i < want) return `${id} at ${r}${party === 5 ? '' : ` (party of ${party})`}: ${a.tier} (${Math.round(a.fit)})`;
  }
  return true;
};
/** The agent is above (or below) the middle agent, as shown, at each rank given: below or level with it when `above` is 'not'. */
const vsMiddle = (id: string, ranks: readonly RankId[], above: boolean | 'not' = true, party: PartySize = 5) => (): true | string => {
  for (const r of ranks) {
    const f = Math.round(agentAt('any', r, id, party).fit), m = middle('any', r, party);
    if (above === 'not' ? f > m : above ? f < m : f >= m) return `${id} at ${r}${party === 5 ? '' : ` (party of ${party})`}: ${f}, the middle is ${m}`;
  }
  return true;
};
/** Every check holds, or the first that doesn't says so. */
/** The agent is a sound pick on a map at each rank given: B or better there. */
const goodOn = (map: string, id: string, ranks: readonly RankId[]) => (): true | string => {
  for (const r of ranks) { const a = agentAt(map, r, id); if (TIER_ORDER.indexOf(a.tier) > TIER_ORDER.indexOf('B')) return `${id} on ${map} at ${r}: ${a.tier} (${Math.round(a.fit)})`; }
  return true;
};
const all = (...checks: (() => true | string)[]) => (): true | string => { for (const c of checks) { const x = c(); if (x !== true) return x; } return true; };
/** Where the agent places among all agents (1 the best) on 'any' map at a rank. */
const placeAt = (rank: RankId, id: string, party: PartySize = 5) => ask('any', rank, party).agents.findIndex((a) => a.id === id) + 1;
const LOW: readonly RankId[] = ['iron', 'bronze', 'silver'];
const roles = (map: string, role: Role, n: number, ranks: readonly RankId[]) => atEach(ranks, map, (t) => roleCount(t, role) === n);
/** The plays the Planner lists first for its best comp on each map and side at a rank. */
const firstPlays = (rank: RankId) => POOL.flatMap((m) => (['attack', 'defense'] as const).map((side) => {
  const team = solve({ ...newQuery(rank, true), map: m.id, side }, { map: m.id, side, rank, sites: [] }, 1).comps[0]!.team;
  return { where: `${m.name} ${side}`, side, plays: playsFor(team, m.id, side, [], false, [], rank) };
}));

export const CLAIMS: readonly Claim[] = [
  // ------------------------------------------------ maps
  { id: 'breeze-viper', text: 'Viper is close to a must on Breeze: her Toxic Screen splits its open sites.', sources: ['mobalytics', 'wecoach', 'thespikeMaps'], check: inBest('breeze', 'viper', [...RANKED, ...TOP]) },
  { id: 'breeze-sova', text: 'Sova’s Recon Bolt is a staple on Breeze’s open ground.', sources: ['mobalytics', 'wecoach', 'thespikeMaps'], check: inTop('breeze', 'sova', TOP) },
  { id: 'breeze-operator', text: 'Breeze’s long sightlines suit an Operator player (Jett or Chamber).', sources: ['mobalytics', 'wecoach', 'thespikeMaps'], check: anyOf('breeze', ['jett', 'chamber'], TOP) },
  { id: 'icebox-viper', text: 'Viper is a staple on Icebox, splitting its big sites with her wall.', sources: ['mobalytics', 'thespikeMaps', 'hotspawnMaps', 'hotspawnComps'], check: inBest('icebox', 'viper', ['diamond', ...TOP]) },
  { id: 'icebox-sova', text: 'Sova scouts Icebox’s many angles.', sources: ['mobalytics', 'thespikeMaps', 'hotspawnComps'], check: inBest('icebox', 'sova', TOP) },
  { id: 'icebox-killjoy', text: 'Killjoy holds Icebox, and her Lockdown covers both sites.', sources: ['thespikeMaps', 'hotspawnMaps', 'hotspawnComps'], check: inTop('icebox', 'killjoy', TOP, 10) },
  { id: 'bind-brimstone', text: 'Brimstone is a staple on Bind: fast smokes for burst executes and strong post-plant tools.', sources: ['mobalytics', 'thespikeMaps', 'hotspawnComps'], check: inTop('bind', 'brimstone', TOP, 10) },
  { id: 'bind-viper', text: 'Viper is a staple on Bind.', sources: ['mobalytics', 'thespikeMaps', 'wecoach', 'hotspawnComps'], check: inBest('bind', 'viper', TOP) },
  { id: 'bind-two-controllers', text: 'Top teams play two controllers on Bind (Brimstone with Viper).', sources: ['mobalytics', 'thespikeMaps', 'hotspawnComps'], check: roles('bind', 'controller', 2, TOP) },
  { id: 'bind-raze', text: 'Raze’s utility works through Bind’s teleporters and close sites.', sources: ['mobalytics', 'thespikeMaps', 'wecoach', 'hotspawnComps'], check: inTop('bind', 'raze', TOP, 10) },
  { id: 'lotus-two-controllers', text: 'Lotus calls for two controllers at the top level.', sources: ['hotspawnComps', 'thespikeMaps'], check: roles('lotus', 'controller', 2, TOP) },
  { id: 'lotus-raze', text: 'Raze clears Lotus’s tight sites and entries.', sources: ['hotspawnMaps', 'hotspawnComps', 'wecoach', 'thespikeMaps'], check: inBest('lotus', 'raze', TOP) },
  { id: 'lotus-fade', text: 'Fade’s utility suits Lotus’s tight spaces.', sources: ['hotspawnMaps', 'hotspawnComps', 'wecoach', 'thespikeMaps'], check: inBest('lotus', 'fade', TOP) },
  { id: 'lotus-omen', text: 'Omen’s smokes and teleport fit Lotus’s three sites.', sources: ['hotspawnMaps', 'hotspawnComps', 'wecoach', 'thespikeMaps'], check: inBest('lotus', 'omen', TOP) },
  { id: 'ascent-sova', text: 'Sova is a staple on Ascent, for information over its walls and open mid.', sources: ['mobalytics', 'thespikeMaps', 'hotspawnMaps', 'hotspawnComps', 'wecoach'], check: inBest('ascent', 'sova', ['platinum', 'diamond', ...TOP]) },
  { id: 'ascent-omen', text: 'Omen is the controller for Ascent.', sources: ['mobalytics', 'thespikeMaps', 'hotspawnMaps', 'hotspawnComps'], check: inBest('ascent', 'omen', ['platinum', 'diamond', ...TOP]) },
  { id: 'ascent-one-controller', text: 'Ascent is played with one controller.', sources: ['mobalytics', 'thespikeMaps', 'hotspawnComps'], check: roles('ascent', 'controller', 1, ALL) },
  { id: 'ascent-sentinel', text: 'Ascent comps keep a sentinel to hold a site (Killjoy or Cypher).', sources: ['mobalytics', 'thespikeMaps', 'hotspawnComps', 'wecoach'], check: atEach(ALL, 'ascent', (t) => roleCount(t, 'sentinel') >= 1) },
  { id: 'fracture-brimstone', text: 'Brimstone is the controller for Fracture: three smokes for fast executes and a strong post-plant.', sources: ['mobalytics', 'thespikeMaps'], check: inBest('fracture', 'brimstone', TOP) },
  { id: 'fracture-breach', text: 'Breach is a must on Fracture, stunning through its walls.', sources: ['wecoach', 'mobalytics', 'thespikeMaps'], check: inTop('fracture', 'breach', TOP, 10), note: 'At this year’s events pros played Fade and Cypher on Fracture more than Breach.' },
  { id: 'fracture-fade', text: 'Fade’s information and clearing suit Fracture.', sources: ['mobalytics', 'thespikeMaps', 'wecoach'], check: inBest('fracture', 'fade', TOP) },
  { id: 'fracture-sentinel', text: 'Attackers come from both sides on Fracture, so defenders need a sentinel watching the flank.', sources: ['thespikeMaps', 'wecoach', 'mobalytics'], check: atEach(TOP, 'fracture', (t) => roleCount(t, 'sentinel') >= 1) },
  { id: 'haven-sova', text: 'Sova covers Haven’s three sites with information.', sources: ['thespikeMaps', 'hotspawnMaps', 'hotspawnComps'], check: inBest('haven', 'sova', TOP) },
  { id: 'haven-one-controller', text: 'Haven is played with one controller, most often Omen.', sources: ['thespikeMaps', 'hotspawnComps', 'mobalytics'], check: roles('haven', 'controller', 1, ALL) },
  { id: 'haven-sentinel', text: 'A sentinel (Cypher) holds Haven’s C site and watches the flank.', sources: ['thespikeMaps', 'hotspawnMaps', 'wecoach', 'hotspawnComps'], check: atEach(ALL, 'haven', (t) => roleCount(t, 'sentinel') >= 1) },
  { id: 'haven-two-duelists', text: 'Haven rewards fast rotations and suits two duelists at the top level.', sources: ['hotspawnComps', 'hotspawnMaps'], check: roles('haven', 'duelist', 2, TOP) },
  { id: 'pearl-astra', text: 'Astra is the controller for Pearl’s large layout.', sources: ['hotspawnMaps', 'wecoach', 'mobalytics', 'thespikeMaps'], check: inBest('pearl', 'astra', TOP) },
  { id: 'pearl-one-controller', text: 'Pearl is played with one controller.', sources: ['hotspawnMaps', 'mobalytics', 'thespikeMaps'], check: roles('pearl', 'controller', 1, ALL) },
  { id: 'split-raze', text: 'Raze is the duelist for Split’s tight corners.', sources: ['thespikeMaps', 'hotspawnMaps', 'wecoach'], check: inBest('split', 'raze', TOP) },
  { id: 'split-omen', text: 'Omen’s smokes suit Split’s chokes.', sources: ['thespikeMaps', 'hotspawnMaps', 'wecoach'], check: inBest('split', 'omen', TOP) },
  { id: 'split-cypher', text: 'Cypher watches Split’s mid and flanks.', sources: ['thespikeMaps', 'hotspawnMaps', 'wecoach'], note: 'Sources disagree with this year’s pro play: no team picked Cypher on Split at the 2026 events, and only about one team in five played a sentinel there, mostly Chamber (kb/lineups.ts). Left to the review.' },
  { id: 'sunset-omen', text: 'Omen is the controller for Sunset.', sources: ['hotspawnMaps', 'hotspawnComps', 'wecoach', 'thespikeMaps'], check: inBest('sunset', 'omen', ['platinum', 'diamond', ...TOP]) },
  { id: 'sunset-sentinel', text: 'A sentinel (Cypher) anchors Sunset’s B site and long flanks.', sources: ['hotspawnMaps', 'hotspawnComps', 'wecoach', 'thespikeMaps'], check: atEach(ALL, 'sunset', (t) => roleCount(t, 'sentinel') >= 1) },
  { id: 'abyss-sova', text: 'Sova is the initiator for Abyss: his Recon Bolt and Owl Drone cover its long, open ground.', sources: ['thespikeAbyss', 'dodgeAbyss', 'vlrStage2'], check: inBest('abyss', 'sova', TOP) },
  { id: 'abyss-jett', text: 'Jett’s Updraft and Dash suit Abyss’s height and long sightlines.', sources: ['thespikeAbyss', 'dodgeAbyss'], check: inTop('abyss', 'jett', TOP, 10) },
  { id: 'abyss-harbor-omen', text: 'Abyss wants a controller who covers open crossings from afar, Harbor or Omen.', sources: ['thespikeAbyss', 'dodgeAbyss', 'vlrStage2'], check: anyOf('abyss', ['harbor', 'omen'], TOP) },
  { id: 'abyss-kayo', text: 'KAY/O’s suppression shuts down the mobility that keeps Abyss’s players safe near its edges.', sources: ['thespikeAbyss', 'dodgeAbyss'], note: 'Sources disagree with this year’s play: pros didn’t pick KAY/O on Abyss at the 2026 events, and he wins fewer ranked games than any other agent (metabot.gg, November 2026). The engine leans the same way, so this is left to the review.' },
  { id: 'abyss-sentinel', text: 'In ranked, Abyss comps keep a sentinel (Cypher) to hold a site and the flanks through mid.', sources: ['thespikeAbyss', 'dodgeAbyss'], check: atEach(RANKED, 'abyss', (t) => roleCount(t, 'sentinel') >= 1), note: 'Pros mostly play Abyss without one; checked from Gold to Diamond only.' },
  { id: 'corrode-omen', text: 'Omen is the controller for Corrode: his teleport and smokes suit its height.', sources: ['dodgeCorrode', 'hotspawnComps', 'vlrKickoffs'], check: inBest('corrode', 'omen', TOP) },
  { id: 'corrode-viper', text: 'Viper is a staple on Corrode, her Toxic Screen splitting A.', sources: ['dodgeCorrode', 'hotspawnComps', 'vlrKickoffs'], check: inBest('corrode', 'viper', TOP) },
  { id: 'corrode-two-controllers', text: 'Top teams play two controllers on Corrode (Omen with Viper).', sources: ['hotspawnComps', 'vlrKickoffs'], check: roles('corrode', 'controller', 2, TOP) },
  { id: 'corrode-neon', text: 'Neon’s speed suits Corrode’s fast site takes and long rotations.', sources: ['dodgeCorrode', 'hotspawnComps'], check: inTop('corrode', 'neon', TOP, 10) },
  { id: 'summit-omen', text: 'Omen is the controller for Summit: his smokes cover most ways in.', sources: ['wecoach', 'esportnowSummit', 'vlrStage2'], check: both(inTop('summit', 'omen', RANKED), inBest('summit', 'omen', TOP)), note: 'From Gold to Diamond, Clove’s comp and Omen’s on Summit come within a point of each other (Clove wins the most ranked games of any controller), so there Omen has to be in one of the three best comps.' },
  { id: 'summit-neon', text: 'Neon suits Summit: her wall splits its open sites.', sources: ['esportnowSummit', 'vlrStage2'], check: inTop('summit', 'neon', TOP) },
  { id: 'summit-recon', text: 'Summit’s sites are hard to hide on from Sova’s or Fade’s information.', sources: ['esportnowSummit', 'vlrStage2'], check: anyOf('summit', ['fade', 'sova'], [...RANKED, ...TOP]) },
  { id: 'summit-no-viper', text: 'Summit doesn’t call for Viper.', sources: ['esportnowSummit', 'vlrStage2'], check: atEach([...RANKED, ...TOP], 'summit', (t) => !t.includes('viper')) },
  { id: 'sunset-neon', text: 'Neon’s speed takes Sunset’s compact sites before the defenders rotate.', sources: ['hotspawnComps', 'vlrStage2'], check: inTop('sunset', 'neon', TOP) },
  { id: 'sunset-cypher', text: 'Cypher anchors a site on Sunset while still watching its open mid.', sources: ['wecoach', 'hotspawnComps', 'vlrStage2'], check: inTop('sunset', 'cypher', TOP, 10) },
  { id: 'sunset-sova', text: 'Sova’s information helps break Sunset’s sites fast.', sources: ['hotspawnComps', 'vlrStage2'], note: 'Sources disagree with this year’s play: at the international events pros played Fade on Sunset far more than Sova (71% to 25%), while in the Americas league it was the other way. The engine follows the international events, so this is left to the review.' },
  { id: 'lotus-viper', text: 'Viper is the second controller Lotus needs.', sources: ['hotspawnComps', 'vlrStage2'], check: inBest('lotus', 'viper', TOP) },
  { id: 'lotus-vyse', text: 'Vyse delays and isolates angles on Lotus.', sources: ['hotspawnComps', 'vlrStage2'], check: inTop('lotus', 'vyse', TOP, 10) },
  { id: 'haven-omen', text: 'Omen is the controller for Haven.', sources: ['hotspawnComps', 'mobalytics', 'vlrStage2'], check: inBest('haven', 'omen', TOP) },
  { id: 'haven-cypher', text: 'Cypher’s Trapwires hold Haven’s C Long and his Spycam watches Garage.', sources: ['wecoach', 'hotspawnComps', 'vlrStage2'], check: inTop('haven', 'cypher', TOP, 10) },
  { id: 'pearl-sentinel', text: 'Pearl comps keep a sentinel (Cypher or Chamber) for its long flanks.', sources: ['wecoach', 'mobalytics'], check: atEach(ALL, 'pearl', (t) => roleCount(t, 'sentinel') >= 1) },
  { id: 'split-skye', text: 'Skye’s flashes peek Split’s corners on attack.', sources: ['wecoach', 'vlrStage2'], check: inTop('split', 'skye', TOP, 10) },
  { id: 'bind-brimstone-viper-pair', text: 'Bind’s controllers are Brimstone and Viper together, in nearly every region.', sources: ['vlrKickoffs', 'mobalytics', 'thespikeMaps'], check: atEach(TOP, 'bind', (t) => t.includes('brimstone') && t.includes('viper')) },
  { id: 'omen-everywhere', text: 'Omen fits almost every map: he was in all five most played comps at Champions 2026, and in most map comps guides give.', sources: ['champions26', 'hotspawnComps', 'santiago26'], check: () => { const n = POOL.filter((m) => best(m.id, 'radiant').includes('omen')).length; return n * 2 >= POOL.length || `in the best comp on ${n} of ${POOL.length} pool maps`; } },
  { id: 'icebox-kayo', text: 'KAY/O’s knife and flashes deal with Icebox’s high spots and tight corners, and top teams run him there.', sources: ['mobalytics', 'dodgeIcebox'], check: inTop('icebox', 'kayo', TOP, 10) },
  {
    id: 'icebox-chamber', text: 'Chamber holds Icebox’s long sightlines with the Operator and teleports between its high spots.', sources: ['mobalytics', 'dodgeIcebox', 'vlrToronto'],
    check: () => {
      for (const r of ['silver', 'gold'] as const) { const a = agentAt('icebox', r, 'chamber'); if (TIER_ORDER.indexOf(a.tier) > TIER_ORDER.indexOf('B')) return `Chamber ${a.tier} at ${r}`; }
      for (const r of TOP) if (agentAt('icebox', r, 'chamber').fit >= agentAt('icebox', r, 'killjoy').fit) return `Chamber over Killjoy at ${r}`;
      return true;
    },
    note: 'Masters Toronto 2025, the last top event on Icebox, picked Chamber on 1 of its 22 lineups and Killjoy on 20, so the check asks for Chamber as a good pick below Platinum and for Killjoy ahead of him at the top.',
  },
  { id: 'pearl-neon', text: 'Neon’s speed gets the team through Pearl’s mid and onto a site before the defenders rotate.', sources: ['mobalytics', 'dodgePearl'], check: inTop('pearl', 'neon', TOP, 10) },
  { id: 'pearl-fade', text: 'Fade finds Pearl’s defenders before a push.', sources: ['mobalytics', 'dodgePearl'], check: inTop('pearl', 'fade', TOP, 10) },
  { id: 'pearl-chamber', text: 'Chamber holds Pearl’s long sightlines and punishes attackers caught in the open.', sources: ['mobalytics', 'dodgePearl'], check: inTop('pearl', 'chamber', TOP, 10) },
  { id: 'pearl-mid', text: 'Mid control is what decides Pearl: win it and either site opens.', sources: ['dodgePearl', 'hotspawnComps'], note: 'Advice for the plays: from Platinum up, Pearl’s attack plays lead with mid (Take mid first, a split through Link or Read mid, then hit); reviewed, not scored.' },
  // ------------------------------------------------ maps, from the 2026 map guides (0.5.5)
  { id: 'ascent-killjoy', text: 'Killjoy is the sentinel guides name first for Ascent: her turret and Alarmbot hold a site on their own.', sources: ['hotspawnMaps', 'wecoach', 'thespikeMaps', 'mobalytics', 'dodgeAscent'], check: goodOn('ascent', 'killjoy', RANKED), note: 'Pros played Chamber, Cypher and Sage on Ascent at the 2026 events and Killjoy on none, so the check asks for her as a sound pick in ranked rather than the first one.' },
  { id: 'ascent-jett', text: 'Jett is the duelist guides give Ascent: her dash and Updraft take its high places and make her hard to pin down on defense.', sources: ['hotspawnMaps', 'thespikeMaps', 'mobalytics', 'dodgeAscent'], check: goodOn('ascent', 'jett', ALL) },
  { id: 'ascent-kayo', text: 'KAY/O’s knife covers much of an Ascent site and breaks the defenders’ setups, and guides pair him with Sova there.', sources: ['hotspawnMaps', 'thespikeMaps', 'mobalytics', 'dodgeAscent'], note: 'Sources disagree with this year’s play: pros didn’t pick KAY/O on Ascent at the 2026 events, and he wins the fewest ranked games of any agent (claim kayo-ranked), so the engine rates him C there.' },
  { id: 'bind-fade', text: 'Fade’s Prowlers clear Bind’s close angles, and her Nightfall reaches both sites.', sources: ['thespikeMaps', 'mobalytics', 'dodgeBind'], check: inBest('bind', 'fade', TOP) },
  { id: 'bind-skye', text: 'Skye’s Trailblazer and Guiding Light find Bind’s defenders before the team commits.', sources: ['mobalytics', 'dodgeBind'], check: inTop('bind', 'skye', [...RANKED, ...TOP], 10) },
  { id: 'bind-gekko', text: 'Gekko’s creatures help Bind’s retakes and site holds.', sources: ['thespikeMaps', 'dodgeBind'], check: goodOn('bind', 'gekko', RANKED) },
  { id: 'bind-sentinel', text: 'In ranked, Bind comps keep a sentinel, Cypher or Killjoy, to hold a site.', sources: ['wecoach', 'dodgeBind'], check: atEach(RANKED, 'bind', (t) => roleCount(t, 'sentinel') >= 1), note: 'Pros mostly play Bind without one (Chamber on about one map in six in 2026), so the check stops below Ascendant.' },
  { id: 'split-viper', text: 'Viper’s walls control space on Split and block its sightlines.', sources: ['thespikeMaps', 'dodgeSplit'], check: inBest('split', 'viper', TOP) },
  { id: 'split-breach', text: 'Breach’s stuns break through Split’s chokes onto either site.', sources: ['hotspawnMaps', 'dodgeSplit'], note: 'Sources disagree with this year’s play: pros didn’t pick Breach on Split at the 2026 events, and his ranked win rate is the second lowest of any agent, so the engine rates him C there.' },
  { id: 'split-astra', text: 'Astra’s stars cover A Main and Heaven on Split, and her Gravity Well pulls defenders out of their corners.', sources: ['hotspawnMaps', 'dodgeSplit'], note: 'Pros picked Astra on about one Split map in ten in 2026. The engine rates her B at Radiant there and lower below it, where her kit asks for more than most teams give (claim hard-kits-later).' },
  { id: 'split-sentinel', text: 'In ranked, Split comps keep a sentinel to watch mid and the flanks.', sources: ['hotspawnMaps', 'wecoach', 'thespikeMaps', 'dodgeSplit'], check: atEach(['iron', 'bronze', 'silver', ...RANKED], 'split', (t) => roleCount(t, 'sentinel') >= 1), note: 'Pros mostly play Split without one (Chamber on about one map in five in 2026), so the check stops below Ascendant.' },
  { id: 'haven-jett', text: 'Jett’s Operator rules Haven’s long lanes, such as C Long, and her movement makes for fast entries.', sources: ['hotspawnMaps', 'wecoach', 'dodgeHaven'], check: inTop('haven', 'jett', ['silver', 'gold'], 3), note: 'Pros picked Jett on about one Haven map in ten in 2026, behind Neon and Phoenix, so the check asks for her among the best comps at Silver and Gold.' },
  { id: 'haven-neon', text: 'Neon’s speed suits Haven’s three sites and fast rotations.', sources: ['hotspawnMaps', 'thespikeMaps'], check: inBest('haven', 'neon', TOP) },
  { id: 'haven-fade', text: 'Fade’s Haunt and Prowlers clear Haven’s tight site corners.', sources: ['hotspawnMaps', 'mobalytics', 'dodgeHaven'], check: inBest('haven', 'fade', ['iron', 'bronze', 'silver', 'gold']) },
  { id: 'haven-breach', text: 'Breach’s Fault Line covers the width of Haven’s lanes.', sources: ['thespikeMaps', 'mobalytics', 'dodgeHaven'], note: 'Sources disagree with this year’s play: pros didn’t pick Breach on Haven at the 2026 events, and his ranked win rate is the second lowest of any agent, so the engine rates him C or D there.' },
  { id: 'haven-killjoy', text: 'Killjoy’s turret stops Haven’s flanks while her Alarmbots watch for lurkers.', sources: ['hotspawnMaps', 'dodgeHaven'], check: inBest('haven', 'killjoy', ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond']) },
  { id: 'breeze-jett', text: 'Jett holds Breeze’s long sightlines with the Operator and makes space on attack with her dash and smokes.', sources: ['thespikeMaps', 'mobalytics', 'wecoach', 'dodgeBreeze'], check: inTop('breeze', 'jett', ALL) },
  { id: 'breeze-kayo', text: 'KAY/O’s knife counters the Sova and Viper utility Breeze teams lean on.', sources: ['thespikeMaps', 'mobalytics', 'dodgeBreeze'], check: goodOn('breeze', 'kayo', [...RANKED, ...TOP]) },
  { id: 'breeze-cypher', text: 'Cypher’s Trapwires lock Breeze’s chokes, such as Elbow, and cover a flank.', sources: ['wecoach', 'thespikeMaps', 'dodgeBreeze'], check: goodOn('breeze', 'cypher', RANKED) },
  { id: 'breeze-chamber', text: 'Chamber suits Breeze’s long sightlines.', sources: ['wecoach', 'mobalytics', 'dodgeBreeze'], check: inTop('breeze', 'chamber', TOP) },
  { id: 'fracture-raze', text: 'Raze’s explosives suit Fracture’s close corners, and her Boom Bot clears Arcade.', sources: ['thespikeMaps', 'wecoach', 'dodgeFracture'], check: inTop('fracture', 'raze', [...RANKED, ...TOP]) },
  { id: 'fracture-killjoy', text: 'Killjoy’s gadgets protect Fracture’s sites.', sources: ['thespikeMaps', 'dodgeFracture'], check: inTop('fracture', 'killjoy', RANKED, 10) },
  { id: 'fracture-neon', text: 'Neon’s speed breaks a slow Fracture defense, and her walls cut its sites into angles.', sources: ['wecoach', 'mobalytics', 'dodgeFracture'], check: inBest('fracture', 'neon', TOP) },
  { id: 'fracture-cypher', text: 'Cypher is the sentinel for Fracture, a little ahead of Killjoy.', sources: ['wecoach', 'dodgeFracture'], check: inBest('fracture', 'cypher', ALL) },
  { id: 'sunset-fade', text: 'Fade’s Haunt finds Sunset’s defenders on site and in mid.', sources: ['hotspawnMaps', 'thespikeMaps', 'dodgeSunset'], check: inBest('sunset', 'fade', ALL) },
  { id: 'sunset-raze', text: 'Raze’s Blast Packs get onto Sunset’s sites fast, and her Paint Shells clear the trips on B.', sources: ['hotspawnMaps', 'wecoach', 'dodgeSunset'], check: inTop('sunset', 'raze', ['silver', 'gold', 'platinum']) },
  { id: 'sunset-phoenix', text: 'Phoenix’s flash suits Sunset’s many corners.', sources: ['hotspawnMaps', 'thespikeMaps'], check: inTop('sunset', 'phoenix', ['iron', 'bronze', 'silver', 'gold']) },
  { id: 'sunset-breach', text: 'Breach’s stuns and flashes win control of Sunset’s A and B Main.', sources: ['hotspawnMaps', 'thespikeMaps'], note: 'Sources disagree with this year’s play: pros didn’t pick Breach on Sunset at the 2026 events, where Fade was the initiator on most maps, so the engine rates him C there.' },
  { id: 'sunset-brimstone', text: 'Brimstone’s long smokes stall a retake after a Sunset plant.', sources: ['hotspawnMaps', 'dodgeSunset'], check: goodOn('sunset', 'brimstone', RANKED) },
  { id: 'lotus-killjoy', text: 'Killjoy is the sentinel guides name for Lotus: her turret and Nanoswarm lock C.', sources: ['wecoach', 'thespikeMaps', 'dodgeLotus'], check: goodOn('lotus', 'killjoy', RANKED), note: 'Pros played Chamber and Vyse on Lotus at the 2026 events and Killjoy on none, so the check asks for her as a sound pick in ranked rather than the first one.' },
  { id: 'lotus-neon', text: 'Neon’s stun and speed contest A Main and rotate between Lotus’s three sites.', sources: ['hotspawnMaps', 'dodgeLotus'], check: inTop('lotus', 'neon', TOP) },
  { id: 'lotus-astra', text: 'Astra controls Lotus’s B and C from a safe spot.', sources: ['hotspawnMaps', 'dodgeLotus'], note: 'Sources disagree with this year’s play: pros played Omen and Viper on Lotus at the 2026 events and Astra on fewer than one map in ten, so the engine rates her C there.' },
  { id: 'icebox-jett', text: 'Jett’s Updraft takes Icebox’s high spots, such as Nest and the pipes.', sources: ['hotspawnMaps', 'thespikeMaps', 'dodgeIcebox'], check: inBest('icebox', 'jett', ALL) },
  { id: 'icebox-gekko', text: 'Gekko’s Wingman plants B safely on Icebox, and Dizzy clears its high angles.', sources: ['hotspawnMaps', 'thespikeMaps'], check: inTop('icebox', 'gekko', TOP, 10) },
  { id: 'icebox-second-controller', text: 'Next to Viper, Icebox’s second controller is Omen or Harbor.', sources: ['dodgeIcebox', 'hotspawnComps', 'vlrToronto'], check: atEach(TOP, 'icebox', (t) => t.includes('viper') && (t.includes('omen') || t.includes('harbor'))) },
  { id: 'icebox-sage', text: 'Sage’s wall is close to a must for getting the spike down on Icebox, and it blocks Tube.', sources: ['mobalytics', 'dodgeIcebox'], check: inTop('icebox', 'sage', ['iron', 'silver', 'gold']) },
  { id: 'pearl-killjoy', text: 'Killjoy’s turret watches Pearl’s mid, and her gadgets hold its narrow site entries.', sources: ['hotspawnMaps', 'thespikeMaps', 'dodgePearl'], check: inBest('pearl', 'killjoy', ['iron', 'bronze', 'silver', 'gold', 'platinum']) },
  { id: 'pearl-kayo', text: 'KAY/O’s knife breaks the utility Pearl’s defenders hold its tight entries with.', sources: ['thespikeMaps', 'mobalytics', 'wecoach', 'dodgePearl'], note: 'Pros picked KAY/O on about one Pearl map in six in 2026, behind Fade and Sova, and he wins the fewest ranked games of any agent, so the engine rates him C there.' },
  { id: 'pearl-raze', text: 'Raze’s Boom Bot clears Pearl’s A Main and Art, and her Blast Packs jump its chokes.', sources: ['hotspawnMaps', 'wecoach', 'dodgePearl'], check: goodOn('pearl', 'raze', RANKED) },
  { id: 'pearl-sova', text: 'Sova’s drone and Recon Bolt clear Pearl’s long lanes before an execute.', sources: ['hotspawnMaps', 'dodgePearl'], check: inTop('pearl', 'sova', TOP) },
  { id: 'pearl-jett', text: 'Jett’s Operator holds B Long on Pearl, and her dash gets her through its tight site entries.', sources: ['hotspawnMaps', 'dodgePearl'], check: inTop('pearl', 'jett', [...RANKED, ...TOP]) },
  { id: 'abyss-cypher', text: 'Cypher’s Trapwires suit Abyss’s narrow corridors, and his camera watches mid.', sources: ['thespikeAbyss', 'dodgeAbyss'], check: goodOn('abyss', 'cypher', RANKED) },
  { id: 'abyss-omen', text: 'Omen is the controller guides give Abyss: his teleport reaches its high spots and his smokes block mid.', sources: ['thespikeAbyss', 'dodgeAbyss'], check: inBest('abyss', 'omen', RANKED) },
  { id: 'abyss-vyse', text: 'Vyse’s walls block Abyss’s few ways in.', sources: ['thespikeAbyss', 'dodgeAbyss'], check: inTop('abyss', 'vyse', RANKED) },
  { id: 'summit-sage', text: 'Summit suits Sage: her wall blocks its chokes, and pros played her there in 2026.', sources: ['esportnowSummit', 'vlrStage2'], check: inBest('summit', 'sage', ALL) },
  { id: 'summit-vyse', text: 'Vyse’s wall and flash work well together on Summit, and her ult reaches far for a retake.', sources: ['wecoach', 'esportnowSummit'], check: goodOn('summit', 'vyse', RANKED) },
  { id: 'summit-skye', text: 'Skye’s extra flashes clear Summit’s spots again and again at little risk.', sources: ['wecoach', 'esportnowSummit'], note: 'Sources disagree with this year’s play: pros hardly picked Skye on Summit in 2026 (3% of maps), with Fade the initiator on most, so the engine rates her C or D there.' },
  { id: 'summit-raze', text: 'Raze’s Blast Packs move her across Summit’s height, and her ult is easier to land on its open sites.', sources: ['wecoach', 'esportnowSummit'], check: inTop('summit', 'raze', ['silver', 'gold', 'platinum', 'diamond']) },
  { id: 'corrode-sova', text: 'Sova’s recon finds Corrode’s defenders on their high spots.', sources: ['dodgeCorrode', 'hotspawnComps'], check: inTop('corrode', 'sova', TOP, 10) },
  { id: 'corrode-yoru', text: 'Yoru’s teleport and fake steps reach Corrode’s flanks and high off-angles.', sources: ['dodgeCorrode', 'vlrKickoffs'], check: inTop('corrode', 'yoru', TOP) },
  { id: 'ascent-astra', text: 'Astra’s stars and global reach fit Ascent’s layout.', sources: ['hotspawnMaps', 'dodgeAscent'], note: 'Sources disagree with this year’s play: pros played Omen on almost every Ascent map at the 2026 events and Astra on about one in a hundred, so the engine rates her lower there.' },
  { id: 'haven-brimstone', text: 'Brimstone’s Sky Smoke reaches all three of Haven’s sites.', sources: ['wecoach', 'dodgeHaven'], check: goodOn('haven', 'brimstone', RANKED) },
  { id: 'haven-raze', text: 'Raze’s Paint Shells clear Haven’s few defender spots.', sources: ['mobalytics', 'dodgeHaven'], check: goodOn('haven', 'raze', RANKED) },
  { id: 'haven-astra', text: 'Astra is the other controller for Haven, for flexible smoke cover.', sources: ['wecoach', 'dodgeHaven'], check: goodOn('haven', 'astra', TOP) },
  { id: 'sunset-killjoy', text: 'Killjoy’s turret and Alarmbot defend Sunset’s key spots.', sources: ['thespikeMaps', 'dodgeSunset'], check: goodOn('sunset', 'killjoy', RANKED) },
  { id: 'sunset-gekko', text: 'Gekko is an initiator for Sunset.', sources: ['wecoach', 'dodgeSunset'], note: 'Guides give Gekko as one choice beside Sova or Fade; pros didn’t pick him on Sunset at the 2026 events, so the engine rates him C to B there.' },
  { id: 'abyss-raze', text: 'Raze’s Blast Packs move her fast across Abyss and can knock enemies off its edges.', sources: ['thespikeAbyss', 'dodgeAbyss'], check: goodOn('abyss', 'raze', RANKED) },
  { id: 'summit-fade', text: 'Fade’s Prowlers find Summit’s defenders, and her Nightfall threatens both sites.', sources: ['wecoach', 'esportnowSummit', 'vlrStage2'], check: inBest('summit', 'fade', ALL) },
  // ------------------------------------------------ ranks
  { id: 'a-controller', text: 'Every team needs a controller; a team without one hurts its own chances, and controllers are underpicked at the low ranks.', sources: ['gosu', 'hotspawnComps', 'agentselectRoles', 'metabotComps'], check: () => { for (const r of ALL) for (const m of [...POOL.map((x) => x.id), 'any']) if (!roleCount(best(m, r), 'controller')) return `${m} at ${r}`; return true; } },
  { id: 'few-duelists', text: 'Don’t stack duelists: a team of three or four struggles against organized defenses.', sources: ['gosu', 'earlygame', 'agentselectRoles', 'metabotComps'], check: () => { for (const r of ALL) for (const c of ask('any', r).comps) if (roleCount(c.team, 'duelist') >= 3) return `${r}: ${c.team.join(' ')}`; return true; } },
  { id: 'low-ranks-aim', text: 'At the low ranks, aim and simple utility decide fights; complex kits pay off later.', sources: ['prosettings', 'gosu'], check: () => { for (const r of ['iron', 'bronze', 'silver'] as const) for (const c of ask('any', r).comps.slice(0, 3)) if (c.team.some((id) => agentById(id)!.skill >= 0.8)) return `${r}: ${c.team.join(' ')}`; return true; } },
  { id: 'neon-hard', text: 'Neon is a high-ceiling pick, not one for beginners: her speed asks for exact aim on the move.', sources: ['sequel26', 'gamesgg26'], check: () => { const n = POOL.filter((m) => best(m.id, 'iron').includes('neon')).length; return n <= 1 || `Neon in the best comp at Iron on ${n} of ${POOL.length} pool maps`; } },
  { id: 'easy-at-iron', text: 'At Iron and Bronze, simple self-sufficient agents climb best (Sage, Reyna, Phoenix, Killjoy, Omen, Brimstone, Clove).', sources: ['sequel26', 'gamesgg26'], check: () => { for (const r of ['iron', 'bronze'] as const) for (const m of POOL) { const t = best(m.id, r); if (t.filter((id) => ['sage', 'reyna', 'phoenix', 'killjoy', 'omen', 'brimstone', 'clove'].includes(id)).length < 2) return `${m.id} at ${r}: ${t.join(' ')}`; } return true; } },
  { id: 'small-pool', text: 'Below the top ranks, play a few agents you know well rather than many.', sources: ['earlygame', 'prosettings', 'gosu'], check: () => comfortValue('main', 'iron') > comfortValue('main', 'radiant') || 'how well you play an agent counts no more at Iron than at Radiant' },
  { id: 'reyna-drops', text: 'Reyna is a solid pick to climb at the low ranks, but her value drops near the top, where opponents stop making the mistakes she snowballs on.', sources: ['prosettingsSolo', 'sequel26', 'gamesgg26'], check: both(tierAt('reyna', ['iron', 'bronze'], 'A'), tierAt('reyna', ['immortal', 'radiant'], 'C', false)) },
  { id: 'breach-coordinated', text: 'Breach’s kit makes fights for his teammates, so he is hard to get value from without a team that plays off him.', sources: ['prosettingsSolo', 'gamesgg26', 'sequel26'], check: vsMiddle('breach', ['iron', 'bronze', 'silver', 'gold'], false), note: 'Checked from Iron to Gold. Near the top, pro teams picked him on few maps this year, so the engine keeps him low there too.' },
  { id: 'clove-climb', text: 'Clove is one of the best picks to climb from Iron to Gold: the most played controller, with one of the best ranked win rates.', sources: ['sequel26', 'gamesgg26', 'prosettingsSolo'], check: tierAt('clove', ['iron', 'bronze', 'silver', 'gold'], 'A') },
  { id: 'omen-any-rank', text: 'Omen is a strong controller at every rank: he can lurk alone or lock down a site.', sources: ['prosettingsSolo', 'sequel26'], check: tierAt('omen', ALL, 'A') },
  { id: 'killjoy-low', text: 'Killjoy lets a player at the low ranks help the team without having to win every gunfight.', sources: ['gamesgg26', 'sequel26', 'strafe26', 'switchblade26'], check: vsMiddle('killjoy', ['iron', 'bronze']) },
  { id: 'fade-learning', text: 'Fade is the safer initiator while learning, since Haunt needs no lineups; Sova’s value grows with the lineups experienced players land.', sources: ['prosettingsSolo', 'sequel26'], check: () => { for (const r of ['iron', 'bronze', 'silver'] as const) if (agentAt('any', r, 'fade').fit < agentAt('any', r, 'sova').fit) return `Sova over Fade at ${r}`; return true; }, note: 'Checked from Iron to Silver; where Sova’s lineups pay off near the top is checked by the map claims (Abyss, Breeze, Haven, Icebox).' },
  { id: 'jett-every-rank', text: 'Jett is a strong pick to climb ranked at every rank, for her mobility.', sources: ['sequel26', 'gamesgg26', 'esportstalesRanks'], check: tierAt('jett', ALL, 'A', true, 1), note: 'Checked for a solo player, as the guides mean it. A team that plays together leans on pro play, and at this year’s events pros picked Jett on about a fifth of maps, mostly Ascent, Breeze and Lotus, playing Neon, Yoru and Waylay more on the maps in the pool.' },
  { id: 'viper-coordinated', text: 'Viper is for coordinated teams: a liability for most solo players, close to a must for a team that plays together on the big maps.', sources: ['gamesgg26', 'dodgeIcebox'], check: vsMiddle('viper', ['iron', 'bronze', 'silver'], false) },
  { id: 'cypher-alone', text: 'Cypher holds a large part of the map alone with his traps and camera.', sources: ['prosettingsSolo', 'gamesgg26'], check: vsMiddle('cypher', ['gold', 'platinum']) },
  { id: 'yoru-ceiling', text: 'Yoru has the widest gap between a new player and a practised one: weak at the low ranks, much stronger at the top.', sources: ['sequel26', 'gamesgg26'], check: () => { const lo = agentAt('any', 'iron', 'yoru').fit, hi = agentAt('any', 'radiant', 'yoru').fit; return (Math.round(lo) < middle('any', 'iron') && hi - lo >= 20) || `Yoru ${Math.round(lo)} at Iron, ${Math.round(hi)} at Radiant`; } },
  // ------------------------------------------------ solo queue, rank by rank
  { id: 'solo-low-self-sufficient', text: 'Playing alone from Iron to Silver, pick agents who don’t need the team: Reyna, Phoenix, Jett and Sage, or Killjoy, whose utility works once it’s placed.', sources: ['strafe26', 'boostingSolo', 'sequel26', 'switchblade26', 'prosettingsSolo'], check: all(...['reyna', 'phoenix', 'jett', 'sage', 'killjoy'].map((id) => tierAt(id, LOW, 'A', true, 1))) },
  { id: 'solo-low-team-kits', text: 'Playing alone at the low ranks, skip the kits that want plays random teammates won’t make: Astra, Viper, KAY/O and Breach.', sources: ['boostingSolo', 'prosettingsSolo', 'sequel26'], check: all(...['astra', 'viper', 'kayo', 'breach'].map((id) => vsMiddle(id, LOW, false, 1))) },
  { id: 'hard-kits-later', text: 'Astra, Yoru and Neon are for later: at Iron and Bronze their kits ask for game sense and precision a new player doesn’t have yet.', sources: ['sequel26', 'gamesgg26'], check: all(...['astra', 'yoru', 'neon'].flatMap((id) => [vsMiddle(id, ['iron'], 'not', 1), vsMiddle(id, ['iron', 'bronze'], false)])), note: 'Checked for a five-stack at Iron and Bronze, and for a solo player at Iron. A solo player at Bronze has Neon at about the middle of the agents: random teammates there lean on whoever wins the first fight.' },
  { id: 'solo-low-controllers', text: 'Playing alone at the low ranks, Clove and Omen are the controllers to climb with: Clove smokes even after dying, and Omen can lurk on his own.', sources: ['prosettingsSolo', 'sequel26', 'strafe26'], check: () => { for (const r of LOW) { const c = ask('any', r, 1).agents.filter((a) => agentById(a.id)!.role === 'controller').slice(0, 2).map((a) => a.id).sort(); if (c.join() !== 'clove,omen') return `${r}: ${c.join(' and ')} lead the controllers`; } return true; } },
  { id: 'sova-rises', text: 'Sova gets better the higher you climb: his Recon Bolt lineups pay off for players who know them.', sources: ['sequel26', 'boostingSolo', 'prosettingsSolo'], check: () => { for (const p of [1, 5] as const) if (placeAt('radiant', 'sova', p) >= placeAt('iron', 'sova', p)) return `party of ${p}: Sova #${placeAt('iron', 'sova', p)} at Iron, #${placeAt('radiant', 'sova', p)} at Radiant`; return true; } },
  { id: 'solo-top-picks', text: 'Playing alone at Immortal and Radiant, Jett, Clove, Sova and Fade are among the best picks.', sources: ['switchblade26', 'boostingSolo', 'sequel26', 'esportstalesRanks'], check: all(...['jett', 'clove', 'sova', 'fade'].map((id) => tierAt(id, TOP, 'A', true, 1))) },
  { id: 'solo-top-rare', text: 'Players at Radiant hardly ever pick Astra, Harbor or Breach in ranked: their kits pay off only with a team that talks.', sources: ['esportstalesRanks', 'boostingSolo', 'prosettingsSolo'], check: all(...['astra', 'harbor', 'breach'].map((id) => vsMiddle(id, ['radiant'], false, 1))) },
  { id: 'teamplay-climbs', text: 'From Platinum and Diamond up, coordinated utility, trading and team play decide rounds.', sources: ['prosettings', 'gosu'], note: 'Checked by the plays-by-rank tests (tests/unit/playrank.test.ts) and in the review.' },
  // ------------------------------------------------ rank by rank (0.5.5)
  { id: 'sage-iron', text: 'Sage is one of the best picks at Iron and Bronze: the safest sentinel there, and the most played agent at Iron.', sources: ['swiftboost26', 'strafe26', 'dignitasBeginners', 'esportstalesRanks'], check: all(tierAt('sage', ['iron', 'bronze'], 'S'), tierAt('sage', ['iron', 'bronze'], 'S', true, 1)) },
  { id: 'brimstone-easy', text: 'Brimstone is the easiest controller to learn, a sound pick for a team at Iron and Bronze and ahead of the controllers who take practice; a solo player there is better off with a controller who needs less from the team.', sources: ['swiftboost26', 'dignitasBeginners', 'boostingSolo'], check: all(tierAt('brimstone', ['iron', 'bronze'], 'B'), () => { for (const r of ['iron', 'bronze'] as const) for (const id of ['astra', 'viper', 'harbor']) if (placeAt(r, 'brimstone') > placeAt(r, id)) return `${id} over Brimstone for a team at ${r}`; return true; }, () => { for (const r of ['iron', 'bronze'] as const) if (placeAt(r, 'brimstone', 1) < placeAt(r, 'clove', 1)) return `Brimstone over Clove for a solo player at ${r}`; return true; }) },
  { id: 'reyna-solo-low', text: 'Playing alone from Iron to Silver, Reyna is one of the strongest picks, the most self-sufficient agent in the game, and she is still a good one at Gold.', sources: ['prosettingsSolo', 'swiftboost26', 'boostingSolo', 'strafe26'], check: all(tierAt('reyna', LOW, 'S', true, 1), tierAt('reyna', ['gold'], 'A', true, 1)) },
  { id: 'phoenix-low', text: 'Phoenix is a top pick from Iron to Gold: his flash, heal and second life forgive mistakes.', sources: ['swiftboost26', 'strafe26', 'boostingSolo', 'vlrLowElo', 'dignitasBeginners'], check: all(tierAt('phoenix', ['iron', 'bronze', 'silver', 'gold'], 'S'), tierAt('phoenix', ['iron', 'bronze', 'silver', 'gold'], 'S', true, 1)) },
  { id: 'hush-hard', text: 'Hush is a hard duelist to learn, steering her abilities by aim, and her team has won fewer than half its ranked games in her first weeks; below Platinum, Phoenix, Reyna, Jett and Raze are the duelists to climb with.', sources: ['metabotHush', 'itechHush', 'spind1309', 'dakgg'], check: () => { for (const r of ['iron', 'bronze', 'silver', 'gold'] as const) for (const p of [1, 5] as const) for (const id of ['phoenix', 'reyna', 'jett', 'raze']) if (placeAt(r, 'hush', p) < placeAt(r, id, p)) return `Hush over ${id} at ${r} (party of ${p})`; return true; } },
  { id: 'low-initiators', text: 'For the low ranks, Fade and Sova are the initiators coaches and players name first: their information needs little from the team. KAY/O and Breach want follow-up.', sources: ['vlrInitiators', 'prosettingsSolo', 'boostingSolo'], check: () => { for (const r of LOW) { const xs = ask('any', r, 1).agents.filter((a) => agentById(a.id)!.role === 'initiator').map((a) => a.id); if (!xs.slice(0, 3).includes('fade') || !xs.slice(0, 3).includes('sova')) return `${r} (party of 1): ${xs.slice(0, 3).join(' ')} lead the initiators`; if (xs.indexOf('kayo') < xs.length - 4 || xs.indexOf('breach') < xs.length - 4) return `${r} (party of 1): KAY/O or Breach near the top of the initiators (${xs.join(' ')})`; } return true; } },
  { id: 'gold-sentinel', text: 'From Silver to Gold, teams rarely play off each other, so a sentinel who locks a site down wins rounds.', sources: ['prosettings', 'swiftboost26', 'sportskeedaRoles'], check: () => { for (const r of ['silver', 'gold'] as const) for (const m of POOL) if (!roleCount(best(m.id, r), 'sentinel')) return `${m.id} at ${r}: ${best(m.id, r).join(' ')}`; return true; } },
  { id: 'gold-climb', text: 'From Gold to Platinum, solo players climb on Clove, Jett, Raze and Cypher, agents who reward good timing with their utility.', sources: ['boostingSolo', 'swiftboost26', 'rankforgeGold'], check: all(...['clove', 'jett', 'raze', 'cypher'].map((id) => tierAt(id, ['gold', 'platinum'], 'A', true, 1))) },
  { id: 'neon-silver', text: 'Below Gold, Neon isn’t an agent to build a team around: her speed asks for aim on the move most players there haven’t got yet.', sources: ['sequel26', 'gamesgg26', 'boostingSolo'], check: () => { for (const r of ['iron', 'bronze', 'silver'] as const) { const n = POOL.filter((m) => best(m.id, r).includes('neon')).length; if (n > 1) return `Neon in the best comp at ${r} on ${n} of ${POOL.length} pool maps`; } return true; } },
  { id: 'plat-controller', text: 'From Platinum, the game is won on the map more than in single fights, and a player who smokes for the team pays off: Omen and Brimstone are the controllers coaches send Platinum players to.', sources: ['sportskeedaRoles', 'upforgePlat'], check: all(tierAt('omen', ['platinum', 'diamond'], 'A'), tierAt('brimstone', ['platinum', 'diamond'], 'B')) },
  { id: 'diamond-solo', text: 'Playing alone from Diamond to Ascendant, Sova, Omen, Cypher and Neon are among the strongest picks.', sources: ['boostingSolo', 'strafe26'], check: all(...['sova', 'cypher', 'neon'].map((id) => tierAt(id, ['diamond', 'ascendant'], 'A', true, 1)), tierAt('omen', ['diamond', 'ascendant'], 'B', true, 1)) },
  { id: 'reyna-top-solo', text: 'Reyna is still a fine pick for a solo player at Immortal and Radiant, where she is the fourth most played agent and wins about half her games; her weakness is in a team that plays together.', sources: ['esportstalesRanks', 'prosettingsSolo'], check: tierAt('reyna', TOP, 'B', true, 1) },
  { id: 'clove-every-rank', text: 'Clove is the most played controller in ranked and wins more games than any other agent at most ranks.', sources: ['metabotAgents', 'dakgg', 'spind1309', 'esportstalesRanks'], check: tierAt('clove', ALL, 'A', true, 1) },
  { id: 'kayo-ranked', text: 'KAY/O wins the fewest ranked games of any agent: his flashes and knife need a team that follows them.', sources: ['metabotAgents', 'spind1309', 'dakgg', 'vlrInitiators'], check: vsMiddle('kayo', [...LOW, 'gold', 'platinum'], false, 1) },
  // ------------------------------------------------ pro play in 2026, and what each rank can play (0.5.5)
  { id: 'viper-yoru-2026', text: 'Viper and Yoru were the agents pro teams picked most in early 2026: each on almost half the maps at Masters Santiago, and in the top three in every Kickoff region.', sources: ['santiago26', 'vlrKickoffs'], check: all(vsMiddle('viper', TOP), vsMiddle('yoru', TOP)) },
  { id: 'neon-2026', text: 'Neon rose to the top of pro play in 2026: one of the five agents picked most at Masters Santiago, and on more than half the maps at Champions.', sources: ['santiago26', 'champions26'], check: () => { for (const r of TOP) { const d = ask('any', r).agents.find((a) => agentById(a.id)!.role === 'duelist')!; if (d.id !== 'neon') return `${d.id} before Neon at ${r}`; } return true; } },
  { id: 'chamber-2026', text: 'Chamber came back at the top in 2026, played as a duelist and a site anchor at once, and Radiant players pick him among the most.', sources: ['champions26', 'esportstalesRanks'], check: vsMiddle('chamber', TOP) },
  { id: 'fade-sova-top', text: 'Fade and Sova are the initiators top teams pick most.', sources: ['champions26', 'santiago26'], check: () => { for (const r of TOP) { const xs = ask('any', r).agents.filter((a) => agentById(a.id)!.role === 'initiator').slice(0, 2).map((a) => a.id).sort().join(' '); if (xs !== 'fade sova') return `${xs} first at ${r}`; } return true; } },
  { id: 'waylay-2026', text: 'Waylay came into pro play in 2026: Americas teams picked her on about two maps in five at Kickoff, and she stayed in the meta at Masters Santiago.', sources: ['santiago26', 'vlrKickoffs'], check: vsMiddle('waylay', TOP) },
  {
    id: 'two-controllers-top', text: 'Top teams often play two controllers, most often Omen with Viper: the comps played most at Masters Santiago all paired them.', sources: ['santiago26', 'champions26', 'vlrKickoffs'],
    check: () => {
      const two = MAPS.filter((m) => roleCount(best(m.id, 'radiant'), 'controller') === 2), both = two.filter((m) => ['omen', 'viper'].every((id) => best(m.id, 'radiant').includes(id)));
      return (two.length >= 6 && both.length >= 4) || `two controllers on ${two.length} maps, Omen with Viper on ${both.length}`;
    },
  },
  { id: 'one-controller-low', text: 'Timing utility together is what players learn at Platinum and Diamond; below that, teams rarely combine it.', sources: ['prosettings', 'upforgePlatCoaching'], check: () => { for (const r of ['iron', 'bronze', 'silver', 'gold'] as const) for (const m of POOL) if (roleCount(best(m.id, r), 'controller') > 1) return `${m.id} at ${r}: ${best(m.id, r).join(' ')}`; return true; } },
  { id: 'low-timing', text: 'From Silver to Gold, rounds are lost on utility timing and trades: players peek alone instead of together.', sources: ['boostingSolo', 'rankforgeGold'], check: () => { for (const r of ['iron', 'bronze', 'silver', 'gold'] as const) { const hard = firstPlays(r).filter((x) => x.plays[0]!.demand >= 3).map((x) => x.where); if (hard.length > 2) return `${r}: a timed play first on ${hard.join(', ')}`; } return true; } },
  { id: 'plat-map-control', text: 'From Platinum, teams start to play for map control, fakes and rotations, from a couple of attack defaults they know well.', sources: ['prosettings', 'upforgePlat'], check: () => { for (const r of ['platinum', 'diamond'] as const) { const plain = firstPlays(r).filter((x) => x.side === 'attack' && x.plays.slice(0, 3).every((f) => f.demand === 1)).map((x) => x.where); if (plain.length) return `${r}: only simple attacks first on ${plain.join(', ')}`; } return true; } },
  { id: 'neon-wins', text: 'Neon wins more ranked games than almost any agent: close behind Clove over all ranks together, and first of the agents played most at Radiant.', sources: ['metabotAgents', 'esportstalesRanks'], check: tierAt('neon', TOP, 'A') },
  { id: 'harbor-astra-ranked', text: 'Harbor and Astra win fewer ranked games than most agents, and Radiant players hardly pick them.', sources: ['metabotAgents', 'esportstalesRanks'], check: all(vsMiddle('harbor', [...LOW, 'gold', 'platinum'], false, 1), vsMiddle('astra', [...LOW, 'gold', 'platinum'], false, 1)) },
  { id: 'economy', text: 'Buy together: a team that ecos together beats one split between full buys and pistols.', sources: ['gosu', 'prosettings'], note: 'Advice for the tips and the buy guide; reviewed, not scored.' },
];

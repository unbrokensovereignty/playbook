/**
 * Ranked play rank by rank, where the numbers in agents.ts (across all ranks) don't say enough.
 *
 * - RANK_WINS: each rank's table from Iron to Immortal, from op.gg's ranked numbers for patch 13.10
 *   (https://op.gg/valorant/statistics, one rank at a time, updated and read 20 November 2026): the
 *   share of picks and of games won of the twenty agents picked most there. Each rank is the whole
 *   rank, Gold 1 to Gold 3 and so on.
 * - BY_RANK: those twenty at each rank, most picked first (Radiant's from RADIANT). They say who
 *   random teammates lock in at each rank: Sage is the most played agent at Iron and hardly played
 *   at Radiant, and Omen, whom pros pick on most maps, is 8th at Gold and Platinum but 13th at
 *   Immortal and 14th at Radiant. Hush, out since 27 October, is among the five picked most at
 *   every rank.
 * - RADIANT: each agent's share of picks and of games won at Radiant, from the same page, over
 *   53,670 picks (about 5,400 games). An agent picked rarely there has a win rate that says more
 *   about who plays them than about the agent (RADIANT_WIN in engine/weights.ts weighs that).
 * - ALL_RANKS: the same page across all ranks, which each rank's win rates are measured against.
 *   Rank by rank, the hardest kits win less low down: Hush's teams win 42.6% of games at Iron and
 *   Neon's 47.0%, against 47.6% and 50.2% across all ranks, while Clove's win 50.3% at Iron, 51.5% at
 *   Gold and 51.1% across all ranks.
 *
 * Until 20 November these came from Blitz's numbers for August 2026, as Esports Tales listed them.
 * Esports Tales hasn't listed a newer month, and Blitz's own pages show no numbers without a
 * browser, so op.gg takes their place. Its picks for one patch include Hush, who came out after
 * August. The two sources count differently: Blitz had Jett first at six of the nine ranks and on
 * nearly every Radiant team, while op.gg has Clove first from Platinum up and Jett on about half of
 * Radiant teams, which is partly the source and partly Hush and the patch.
 */
import type { RankId } from './ranks.ts';

/**
 * Each rank's own table from Iron to Immortal (the same op.gg pages, patch 13.10): how many agent
 * picks it counts, and [percent of picks, percent of games won] for the twenty agents picked most
 * there, most picked first. The engine compares each rate with the same agent's in ALL_RANKS
 * (engine/model.ts, rankWin; RANK_WIN in engine/weights.ts). Radiant's table is RADIANT below,
 * which counts through its own rule.
 */
export const RANK_WINS: Record<Exclude<RankId, 'radiant'>, { picks: number; agents: Readonly<Record<string, readonly [pick: number, win: number]>> }> = {
  iron: { picks: 99_071, agents: { sage: [10.38, 49.21], reyna: [9.15, 49.37], hush: [7.31, 42.63], clove: [6.66, 50.29], chamber: [5.84, 47.79], phoenix: [5.75, 50.45], jett: [4.82, 49.78], sova: [4.75, 49.05], omen: [4.03, 47.94], miks: [3.92, 49.47], fade: [3.88, 50.79], skye: [3.75, 50.61], neon: [3.34, 46.99], gekko: [2.84, 51.06], iso: [2.72, 47.59], yoru: [2.66, 45.53], brimstone: [2.51, 46.41], raze: [2.42, 46.18], cypher: [2.38, 50.53], tejo: [2.18, 51.16] } },
  bronze: { picks: 526_588, agents: { reyna: [9.06, 49.74], clove: [7.84, 50.75], chamber: [7.71, 48.04], sage: [7.53, 50.28], hush: [5.95, 46.6], jett: [5.3, 50], phoenix: [4.92, 49.51], sova: [4.73, 49.43], miks: [4.49, 47.98], fade: [4.44, 49.47], omen: [4.21, 46.72], skye: [4.01, 49.16], cypher: [3.47, 49.26], neon: [3.39, 48.64], raze: [2.54, 49.63], gekko: [2.39, 48.24], brimstone: [2.36, 47.75], iso: [2.29, 47.67], tejo: [2.2, 48.74], yoru: [1.87, 46.75] } },
  silver: { picks: 1_101_227, agents: { chamber: [9.23, 48.59], clove: [9.17, 51.39], reyna: [8.98, 49.7], jett: [6.81, 49.63], hush: [6.18, 46.95], sage: [5.64, 50.58], fade: [4.77, 49.8], sova: [4.64, 49.36], phoenix: [4.41, 49.9], omen: [4.32, 46], cypher: [3.95, 49.45], skye: [3.89, 49.44], miks: [3.82, 48.17], neon: [3.55, 48.8], raze: [2.63, 49.71], brimstone: [1.93, 48.4], gekko: [1.88, 49.09], iso: [1.81, 47.91], tejo: [1.71, 48.78], killjoy: [1.65, 50.72] } },
  gold: { picks: 1_884_904, agents: { chamber: [10.25, 48.67], clove: [10.09, 51.48], reyna: [8.41, 49.41], jett: [7.95, 49.39], hush: [6.61, 47], fade: [5.55, 49.94], sova: [5.14, 49.78], omen: [4.55, 46.07], sage: [4.35, 50.94], phoenix: [4.17, 50.07], cypher: [4.07, 49.29], skye: [3.59, 49.24], neon: [3.5, 48.87], miks: [2.9, 47.59], raze: [2.81, 49.73], brimstone: [1.59, 48.65], gekko: [1.53, 49.31], waylay: [1.52, 48.43], killjoy: [1.51, 50.24], iso: [1.42, 48.15] } },
  platinum: { picks: 2_459_253, agents: { clove: [11.26, 51.46], chamber: [11.01, 48.94], jett: [9.02, 49.32], reyna: [7.77, 49.48], hush: [6.89, 47.28], fade: [6.4, 49.61], sova: [5.89, 50.07], omen: [4.46, 45.75], cypher: [4.13, 49.74], phoenix: [3.88, 50.42], neon: [3.59, 50.07], skye: [3.23, 49.66], sage: [3.19, 51.3], raze: [3.02, 49.99], miks: [2.08, 47.58], waylay: [1.73, 48.54], killjoy: [1.34, 50.57], brimstone: [1.31, 48.57], yoru: [1.26, 47.31], iso: [1.08, 48.1] } },
  diamond: { picks: 2_711_834, agents: { clove: [12.68, 51.14], chamber: [11.56, 49.03], jett: [10.02, 49.46], hush: [7.19, 47.78], reyna: [7.15, 49.55], fade: [7.14, 49.87], sova: [6.75, 50], cypher: [4.1, 49.87], omen: [4.03, 45.74], phoenix: [3.71, 50.62], neon: [3.64, 50.41], raze: [3.07, 50.39], skye: [2.83, 49.16], sage: [2.23, 51.77], waylay: [1.95, 48.49], miks: [1.27, 47.27], yoru: [1.25, 47.93], killjoy: [1.14, 50.56], brimstone: [1.11, 48.6], vyse: [1.08, 49.53] } },
  ascendant: { picks: 2_717_879, agents: { clove: [14.61, 50.9], chamber: [12.17, 49.37], jett: [10.65, 49.44], hush: [7.98, 48.19], fade: [7.67, 49.9], sova: [7.41, 49.93], reyna: [6.59, 49.28], neon: [4.02, 50.99], cypher: [3.72, 50.16], phoenix: [3.64, 50.66], omen: [3.09, 45.32], raze: [2.96, 50.22], skye: [2.43, 49.24], waylay: [2.15, 48.85], yoru: [1.4, 48.79], sage: [1.39, 51.94], vyse: [1.28, 49.34], brimstone: [0.86, 48.99], killjoy: [0.81, 50.45], iso: [0.75, 49.06] } },
  immortal: { picks: 1_054_212, agents: { clove: [16.66, 50.41], chamber: [12.67, 49.13], jett: [10.59, 49.26], fade: [8.23, 49.83], hush: [8.05, 48.36], sova: [7.87, 49.48], reyna: [5.89, 49.07], neon: [5.22, 50.79], phoenix: [3.44, 50.45], cypher: [3.41, 49.66], raze: [2.49, 49.18], waylay: [2.4, 48.53], omen: [2.12, 45.56], yoru: [1.93, 48.03], skye: [1.92, 48.9], vyse: [1.52, 49.43], sage: [0.89, 52.87], iso: [0.77, 48.76], brimstone: [0.65, 48.09], deadlock: [0.53, 50.41] } },
};

/**
 * op.gg's table across all ranks for the same patch (updated and read 20 November 2026, about
 * 12.85 million picks): [percent of picks, percent of games won]. It's one of the two sources of
 * each agent's `win` in agents.ts, and the rate each rank's own is measured against, so that the
 * way op.gg counts games cancels out.
 */
export const ALL_RANKS: Readonly<Record<string, readonly [pick: number, win: number]>> = {
  clove: [12.17, 51.13], chamber: [11.05, 49.02], jett: [9.21, 49.51], reyna: [7.55, 49.5], hush: [7.07, 47.6], fade: [6.58, 49.84],
  sova: [6.3, 49.84], phoenix: [3.92, 50.37], cypher: [3.9, 49.75], omen: [3.86, 45.82], neon: [3.81, 50.15], sage: [3.07, 51.07],
  skye: [3.01, 49.31], raze: [2.88, 49.98], miks: [1.81, 47.69], waylay: [1.81, 48.59], yoru: [1.41, 47.63], brimstone: [1.27, 48.52],
  killjoy: [1.18, 50.5], iso: [1.13, 48.31], vyse: [1, 49.54], gekko: [0.95, 48.56], deadlock: [0.89, 48.16], kayo: [0.89, 45.77],
  tejo: [0.81, 48.28], breach: [0.79, 47.37], astra: [0.66, 45.96], veto: [0.51, 48.73], harbor: [0.29, 44.54], viper: [0.22, 46.98],
};

/** Radiant, patch 13.10: [percent of picks, percent of games won]. */
export const RADIANT: Readonly<Record<string, readonly [pick: number, win: number]>> = {
  clove: [15.95, 51.89], chamber: [12.18, 50.7], hush: [10.27, 49.76], jett: [9.49, 50.82], neon: [8.93, 52.47], fade: [7.15, 50.3],
  sova: [6.36, 50.79], reyna: [4.61, 50.26], waylay: [3.4, 50.36], phoenix: [3.35, 52.62], cypher: [3.3, 53.62], yoru: [2.79, 48.7],
  raze: [2.1, 46.9], omen: [2.08, 45.53], vyse: [1.42, 45.99], skye: [1.37, 52.86], sage: [1.02, 50.55], iso: [0.97, 53.08],
  viper: [0.71, 51.19], brimstone: [0.69, 47.71], astra: [0.49, 44.7], harbor: [0.31, 47.88], veto: [0.26, 54.35], killjoy: [0.22, 52.54],
  deadlock: [0.2, 49.09], tejo: [0.12, 53.23], kayo: [0.09, 40], miks: [0.09, 52], gekko: [0.05, 40], breach: [0.05, 36],
};

/** The twenty agents picked most at each rank, most picked first. */
const mostPicked = (rows: Readonly<Record<string, readonly [pick: number, win: number]>>) => Object.entries(rows).sort((a, b) => b[1][0] - a[1][0]).slice(0, 20).map(([id]) => id);
export const BY_RANK: Record<RankId, readonly string[]> = {
  iron: mostPicked(RANK_WINS.iron.agents), bronze: mostPicked(RANK_WINS.bronze.agents), silver: mostPicked(RANK_WINS.silver.agents),
  gold: mostPicked(RANK_WINS.gold.agents), platinum: mostPicked(RANK_WINS.platinum.agents), diamond: mostPicked(RANK_WINS.diamond.agents),
  ascendant: mostPicked(RANK_WINS.ascendant.agents), immortal: mostPicked(RANK_WINS.immortal.agents), radiant: mostPicked(RADIANT),
};

/**
 * Where the numbers above come from and when, for the help page and the knowledge notes: the
 * patch they cover (`period`), the day it began (`from`: an agent released since isn't in them and
 * keeps their numbers across all ranks), and the day they were read.
 */
export const RANKED_SOURCE = { name: 'op.gg', period: 'patch 13.10', from: '2026-11-10', read: '2026-11-20' };

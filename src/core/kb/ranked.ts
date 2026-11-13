/**
 * Ranked play rank by rank, where the numbers in agents.ts (across all ranks) don't say enough.
 *
 * - BY_RANK: the twenty agents picked most at each rank, most picked first, from Blitz's ranked
 *   numbers for August 2026 (Iron 3, Bronze 3 and so on up to Immortal 3, and Radiant), as Esports
 *   Tales lists them (https://www.esportstales.com/valorant/tier-list-and-most-played-agents, read
 *   6 November 2026). They say who random teammates lock in at each rank: Sage is the most played
 *   agent at Iron and hardly played at Radiant, and Omen, whom pros pick on most maps, is rare in
 *   Radiant lobbies.
 * - RADIANT: each agent's share of picks and of games won at Radiant, from the same page. Radiant is
 *   a few hundred players, so an agent picked rarely there has a win rate that says more about who
 *   plays them than about the agent (RADIANT_WIN in engine/weights.ts weighs that).
 *
 * Agents out since August (Hush) aren't in either list and keep their numbers across all ranks.
 */
import type { RankId } from './ranks.ts';

export const BY_RANK: Record<RankId, readonly string[]> = {
  iron: ['sage', 'reyna', 'phoenix', 'clove', 'jett', 'miks', 'omen', 'chamber', 'gekko', 'raze', 'fade', 'sova', 'skye', 'neon', 'cypher', 'iso', 'brimstone', 'tejo', 'killjoy', 'yoru'],
  bronze: ['reyna', 'sage', 'jett', 'clove', 'phoenix', 'chamber', 'miks', 'omen', 'raze', 'cypher', 'sova', 'skye', 'fade', 'gekko', 'killjoy', 'neon', 'iso', 'brimstone', 'tejo', 'kayo'],
  silver: ['jett', 'reyna', 'clove', 'sage', 'chamber', 'phoenix', 'omen', 'miks', 'sova', 'raze', 'cypher', 'skye', 'fade', 'killjoy', 'neon', 'gekko', 'iso', 'brimstone', 'breach', 'kayo'],
  gold: ['jett', 'reyna', 'clove', 'chamber', 'phoenix', 'sage', 'sova', 'omen', 'raze', 'cypher', 'miks', 'skye', 'fade', 'killjoy', 'neon', 'breach', 'gekko', 'deadlock', 'brimstone', 'kayo'],
  platinum: ['jett', 'clove', 'reyna', 'chamber', 'sova', 'phoenix', 'omen', 'cypher', 'sage', 'raze', 'fade', 'skye', 'miks', 'killjoy', 'neon', 'breach', 'deadlock', 'gekko', 'iso', 'kayo'],
  diamond: ['jett', 'clove', 'chamber', 'reyna', 'sova', 'phoenix', 'cypher', 'omen', 'raze', 'fade', 'skye', 'sage', 'neon', 'killjoy', 'miks', 'breach', 'astra', 'vyse', 'deadlock', 'iso'],
  ascendant: ['jett', 'clove', 'sova', 'reyna', 'chamber', 'phoenix', 'cypher', 'fade', 'neon', 'raze', 'omen', 'skye', 'killjoy', 'sage', 'vyse', 'yoru', 'viper', 'miks', 'breach', 'astra'],
  immortal: ['clove', 'jett', 'sova', 'reyna', 'chamber', 'neon', 'cypher', 'fade', 'phoenix', 'raze', 'omen', 'killjoy', 'vyse', 'skye', 'viper', 'yoru', 'sage', 'iso', 'astra', 'harbor'],
  radiant: ['jett', 'clove', 'sova', 'reyna', 'chamber', 'neon', 'cypher', 'fade', 'phoenix', 'raze', 'skye', 'viper', 'vyse', 'killjoy', 'sage', 'yoru', 'omen', 'iso', 'tejo', 'brimstone'],
};

/** Radiant, August 2026: [percent of picks, percent of games won]. */
export const RADIANT: Readonly<Record<string, readonly [pick: number, win: number]>> = {
  jett: [19.8, 51.0], clove: [18.8, 52.0], sova: [10.0, 50.3], reyna: [8.6, 51.2], chamber: [8.4, 50.0], neon: [8.4, 53.1],
  cypher: [5.8, 49.6], fade: [5.3, 49.9], phoenix: [4.7, 52.8], raze: [4.0, 50.8], skye: [1.3, 53.4], viper: [1.3, 46.3],
  vyse: [1.1, 53.3], killjoy: [0.8, 54.4], sage: [0.7, 55.6], yoru: [0.4, 44.4], omen: [0.4, 50.8], iso: [0.1, 60.0],
};

/** When the numbers above were read, and where from, for the help page and the knowledge notes. */
export const RANKED_SOURCE = { name: 'Blitz, through Esports Tales', month: 'August 2026', from: '2026-08-01', read: '2026-11-06' };

/** A planner question in words, for menus, lists and saved plans: "Haven, attack, C site" and "Gold · trio · with Jett". */
import { agentById } from '../../core/kb/agents.ts';
import { mapById } from '../../core/kb/maps.ts';
import { rankOf, type RankId } from '../../core/kb/ranks.ts';
import { ROLES } from '../../core/kb/roles.ts';
import { partyOf, type PartySize, type Query } from '../../core/engine/query.ts';
import type { Situation } from '../../core/engine/model.ts';
import { TIERS } from '../../core/engine/weights.ts';
import { listJoin } from '../../core/text.ts';

/** "S from 95, A from 88, …": the tiers as the engine sets them. */
export const tierWords = (): string => listJoin(TIERS.map((t, i) => (t.min > 0 ? `${t.id} from ${t.min}` : `${t.id} below ${TIERS[i - 1]?.min ?? 0}`)));

/** How often something happens, out of ten games: "in about 6 of 10 games", "in nearly every game", "hardly ever". */
export function howOften(x: number): string {
  const n = Math.round(x * 10);
  return n >= 10 ? 'in nearly every game' : n <= 0 ? 'hardly ever' : `in about ${n} of 10 games`;
}

/**
 * What an agent adds to their best comp over the next best agent of their role in their place
 * (AgentAnswer.edge): "21 ahead of Skye, the next best initiator, in their best comp", or with
 * `lead`, a sentence: "In that comp, Fade is 21 ahead of Skye, the next best initiator."
 */
export function edgeWords(id: string, e: { over: string; by: number }, lead = false): string {
  const name = agentById(id)?.name ?? id, over = agentById(e.over)?.name ?? e.over;
  const role = ROLES.find((r) => r.id === agentById(id)?.role)?.name.toLowerCase() ?? 'agent';
  const n = Math.round(Math.abs(e.by));
  if (n === 0) return lead ? `In that comp, ${over} would do about as well as ${name}.` : `about as good as ${over} in their best comp`;
  if (e.by > 0) return lead ? `In that comp, ${name} is ${n} ahead of ${over}, the next best ${role}.` : `${n} ahead of ${over}, the next best ${role}, in their best comp`;
  return lead ? `In that comp, ${over} would do ${n} better than ${name}.` : `${over} would do ${n} better in ${name}’s best comp`;
}

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five'];
/** A small count in words: "two" (figures from six up). */
export const countWord = (n: number): string => COUNT[n] ?? String(n);

export const mapWord = (map: string): string => (map === 'best' ? 'Best map' : map === 'any' ? 'Any map' : mapById(map)?.name ?? 'Any map');
export const sideWord = (side: string): string => (side === 'attack' ? 'Attack' : side === 'defense' ? 'Defense' : side === 'best' ? 'Best side' : 'Both sides');
export const rankWord = (rank: RankId | 'best'): string => (rank === 'best' ? 'Best rank' : rankOf(rank).name);
export const partyWord = (n: PartySize): string => partyOf(n).name;
export const sitesWord = (sites: readonly string[]): string => (sites.length ? `${listJoin(sites)} site${sites.length > 1 ? 's' : ''}` : '');
const names = (ids: readonly string[]) => listJoin(ids.map((id) => agentById(id)?.name ?? id));

/** "Haven, attack, C site". */
export function askedTitle(q: { map: string; side: string; sites: readonly string[] }): string {
  const parts = [mapWord(q.map)];
  if (q.side !== 'both') parts.push(sideWord(q.side).toLowerCase());
  if (q.sites.length && q.map !== 'any' && q.map !== 'best') parts.push(sitesWord(q.sites));
  return parts.join(', ');
}

/** "Gold · trio · with Jett · two controllers · against Chamber and Sova". */
export function askedLine(q: Query): string {
  const parts = [rankWord(q.rank), partyWord(q.party).toLowerCase()];
  if (q.include.length) parts.push(`with ${names(q.include)}`);
  const roles = ROLES.filter((r) => q.roles[r.id] !== undefined).map((r) => `${COUNT[q.roles[r.id]!]} ${(q.roles[r.id] === 1 ? r.name : r.plural).toLowerCase()}`);
  if (roles.length) parts.push(listJoin(roles));
  // only the first player's own agents (yours, or a party where only you said) read as yours
  if (q.pools.length) parts.push(q.pools.slice(1).every((p) => !p.length) ? 'one of your agents' : 'your party’s agents');
  if (q.enemy.length) parts.push(`against ${names(q.enemy)}`);
  return parts.join(' · ');
}

/** One situation the answers cover: "Haven, attack" or "Haven, attack, Gold" (whichever parts vary). */
export function situationWord(s: Situation, vary: readonly ('map' | 'side' | 'rank')[]): string {
  const parts: string[] = [];
  if (vary.includes('map')) parts.push(mapWord(s.map));
  if (vary.includes('side')) parts.push(sideWord(s.side));
  if (vary.includes('rank')) parts.push(rankWord(s.rank));
  return parts.join(', ');
}

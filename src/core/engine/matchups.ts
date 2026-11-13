/**
 * For an agent's page: what the agent makes the other team play around, and who answers it (the
 * threats in kb/counters.ts, read off the agent's kit as the engine reads the other team's), and the
 * partners pro teams played them with this year (kb/lineups.ts).
 */
import { AGENTS, agentById, type Agent } from '../kb/agents.ts';
import { THREATS, threatLine, type Threat } from '../kb/counters.ts';
import { LINEUPS } from '../kb/lineups.ts';
import type { Dim } from '../kb/roles.ts';
import { rankOf } from '../kb/ranks.ts';
import { listJoin } from '../text.ts';
import { PLAY_RANK } from './weights.ts';

/** Agents who answer a threat best, at most. */
export const ANSWERERS = 3;

/** A threat an agent poses: its sentence with them in it, the agents whose kits answer it best, and how to play it without them. */
export interface Trouble { threat: Threat; line: string; answers: string[]; advice: string }

/** How much an agent's kit answers a threat: what the answer asks for, times how much of it they bring. */
export const answerOf = (a: Agent, t: Threat): number =>
  (Object.entries(t.needs) as [Dim, number][]).reduce((sum, [d, v]) => sum + v * a.caps[d], 0);

/**
 * The threats an agent poses to the other team on their own, as the engine counts them (their
 * strength above the threat's `from`; a `second` threat, like a second controller's smokes, takes
 * two, so it isn't one agent's), with the agents whose kits answer each best.
 */
export function troubleFrom(id: string): Trouble[] {
  const a = agentById(id);
  if (!a) return [];
  return THREATS.filter((t) => !t.second && a.caps[t.dim] > t.from).map((t) => ({
    threat: t,
    line: `${threatLine(t, [a.name], listJoin).replace(/^Their /, '')}${t.side ? ` (when you ${t.side === 'attack' ? 'attack' : 'defend'})` : ''}.`,
    // a threat no kit answers names nobody
    answers: AGENTS.filter((o) => o.id !== a.id && !o.estimate).map((o) => ({ id: o.id, v: answerOf(o, t) })).filter((x) => x.v > 0)
      .sort((x, y) => y.v - x.v || x.id.localeCompare(y.id)).slice(0, ANSWERERS).map((x) => x.id),
    advice: `${t.advice.charAt(0).toUpperCase()}${t.advice.slice(1)}.${t.timed ? ` From ${rankOf(PLAY_RANK.from[3]).name} up, a team can also ${t.timed}.` : ''}`,
  }));
}

/** A partner pro teams played an agent with: on how many of the agent's maps, and the share of them. */
export interface ProDuo { id: string; maps: number; share: number }

/** Fewest pro maps an agent needs before their partners say anything. */
export const DUO_MAPS = 10;

/** The partners pro teams played an agent with most this year, most first, and on how many maps the agent was played. */
export function proDuos(id: string, most = 4): { maps: number; duos: ProDuo[] } {
  const together = new Map<string, number>();
  let maps = 0;
  for (const l of LINEUPS) for (const t of l.teams) {
    if (!t.agents.includes(id)) continue;
    maps++;
    for (const o of t.agents) if (o !== id) together.set(o, (together.get(o) ?? 0) + 1);
  }
  if (maps < DUO_MAPS) return { maps, duos: [] };
  const duos = [...together].map(([o, n]) => ({ id: o, maps: n, share: n / maps })).sort((x, y) => y.maps - x.maps || x.id.localeCompare(y.id)).slice(0, most);
  return { maps, duos };
}

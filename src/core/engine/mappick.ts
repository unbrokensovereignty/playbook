/**
 * Map pick help: from the answers to "Find the best map", the maps a team should play and the ones
 * it should ban, each with why: where the team's best comp on the map comes closer to the best comp
 * for the map than it does on the other maps (to play), or falls further short (to ban). Both are
 * read off the same score as the fits (explain.ts), so the reasons always match the ranking.
 */
import { mapById } from '../kb/maps.ts';
import { DIM_INFO, type Dim } from '../kb/roles.ts';
import { belowParts, explainFor, explainTeam } from './explain.ts';
import { modelFor, type Situation } from './model.ts';
import { answerModel, bestTeamFor, type SituationAnswer } from './plan.ts';
import { nothingFixed, type Query } from './query.ts';
import { BELOW_NOTE, MAP_PICK, tierOf } from './weights.ts';

export interface MapPick {
  map: string;
  /** The map's fit as the list of maps shows it: its best comp's (both sides' average when the answers cover each side). */
  fit: number;
  tier: string;
  /** The side the reasons are about, when the answers cover each side. */
  side?: 'attack' | 'defense';
  /** The team's best comp on the map, and the best comp for the map (agent ids; empty when no comp fits). */
  team: string[];
  best: string[];
  /** A sentence before the reasons ('' for none). */
  lead: string;
  /** The reasons, biggest first. */
  why: string[];
}

export interface MapPicks {
  /** True when every map fits within MAP_PICK.gap of the others, so the pick makes little difference. */
  even: boolean;
  play: MapPick[];
  ban: MapPick[];
}

/**
 * Whether a question gets map pick help: a five-stack (only teams pick and ban maps, in Premier)
 * asking for the best map at one rank, with something chosen to tell the maps apart.
 */
export const asksMapPicks = (q: Query): boolean => q.party === 5 && q.map === 'best' && q.rank !== 'best' && !nothingFixed(q);

const fitOfAnswer = (a: SituationAnswer): number => a.comps[0]?.expected ?? a.comps[0]?.fit ?? -1;

/**
 * The maps to play and to ban, from one answer per situation (all at one rank). When the answers
 * cover each side of a map, the map's fit is the two sides' average, and its reasons come from the
 * side that decides it: the better side for a map to play, the worse for one to ban.
 */
export function mapPicks(answers: readonly SituationAnswer[], q: Pick<Query, 'newAgents' | 'party' | 'include' | 'exclude' | 'locked' | 'roles'>): MapPicks {
  const newAgents = q.newAgents;
  const byMap = new Map<string, SituationAnswer[]>();
  for (const a of answers) byMap.set(a.situation.map, [...(byMap.get(a.situation.map) ?? []), a]);
  const maps = [...byMap].map(([map, list]) => ({ map, list, fit: list.reduce((t, a) => t + Math.max(0, fitOfAnswer(a)), 0) / list.length }))
    .sort((a, b) => b.fit - a.fit || a.map.localeCompare(b.map));
  const top = maps[0]?.fit ?? 0, bottom = maps[maps.length - 1]?.fit ?? 0;
  if (maps.length < 2 || top - bottom < MAP_PICK.gap) return { even: true, play: [], ban: [] };
  const sides = (list: readonly SituationAnswer[]) => list.length > 1;
  const usual = usualParts(answers, newAgents);
  const play = maps.filter((x) => x.fit >= bottom + MAP_PICK.gap).slice(0, MAP_PICK.most).map((x): MapPick => {
    const a = [...x.list].sort((p, q) => fitOfAnswer(q) - fitOfAnswer(p))[0]!;
    return { map: x.map, fit: x.fit, tier: tierOf(x.fit), side: sides(x.list) ? side(a.situation) : undefined, ...toPlay(a, usual, q) };
  });
  const ban = maps.filter((x) => x.fit <= top - MAP_PICK.gap && !play.some((p) => p.map === x.map)).slice(-MAP_PICK.most).reverse().map((x): MapPick => {
    const a = [...x.list].sort((p, q) => fitOfAnswer(p) - fitOfAnswer(q))[0]!;
    return { map: x.map, fit: x.fit, tier: tierOf(x.fit), side: sides(x.list) ? side(a.situation) : undefined, ...toBan(a, usual, q) };
  });
  return { even: false, play, ban };
}

/** The parts of the score that are the agents' own, the same on every map (see usualParts). */
const AGENTS_OWN = ['win', 'rank'];

const side = (s: Situation): 'attack' | 'defense' => (s.side === 'defense' ? 'defense' : 'attack');

/**
 * How far each part of the score (belowParts) takes the team's best comp from the best comp for
 * the map, on the average map of the answers: a map's reasons are the parts that cost more (or less)
 * there than usual. How hard the agents are to play and how often they win ranked games are the
 * agents' own, about the same on every map, so they're left out.
 */
function usualParts(answers: readonly SituationAnswer[], newAgents: boolean): Map<string, number> {
  const usual = new Map<string, number>();
  const fits = answers.filter((x) => x.comps[0]);
  for (const x of fits) {
    const mx = modelFor(x.situation);
    for (const p of belowParts(mx, bestTeamFor(mx, newAgents), x.comps[0]!.team)) usual.set(p.key, (usual.get(p.key) ?? 0) + p.size / fits.length);
  }
  return usual;
}

/** The parts of the score where a map differs from the usual, most first: those that cost more there (`worse`), or less. */
function unusual(m: ReturnType<typeof modelFor>, best: readonly string[], team: readonly string[], usual: Map<string, number>, worse: boolean) {
  const sign = worse ? -1 : 1;
  return belowParts(m, best, team).map((p) => ({ ...p, more: p.size - (usual.get(p.key) ?? 0) }))
    .filter((p) => !AGENTS_OWN.includes(p.key) && p.more * sign >= BELOW_NOTE.part && (!worse || p.size < 0))
    .sort((x, y) => (y.more - x.more) * sign);
}

/** Why a part of the score costs less on a map than usual, in words. */
function betterWords(p: { key: string; size: number }, mapName: string): string {
  if (p.key === 'pro') return `Pro teams on ${mapName} pick agents more like yours`;
  if (p.key === 'roles') return `Its mix of roles suits ${mapName} better than most maps`;
  if (p.key === 'pair') return `Its agents work together better on ${mapName}`;
  // named as the reasons to ban name it (crowd control), with its verb (flashes count, utility counts)
  const info = DIM_INFO[p.key as Dim], disrupt = p.key === 'disrupt';
  const has = disrupt ? 'crowd control' : info.has, many = info.few && !disrupt;
  return p.size < 0 ? `Being short of ${has} costs less on ${mapName}` : `Its ${has} ${many ? 'count' : 'counts'} for more on ${mapName}`;
}

/**
 * Why a map is worth playing: where the team's best comp there comes closer to the best comp for the
 * map than it does on the other maps, or else what it does well, the pros about this map first, as
 * the comp's own card says them (with what the question chose, and how well the team plays them).
 */
function toPlay(a: SituationAnswer, usual: Map<string, number>, q: Parameters<typeof mapPicks>[1]): { team: string[]; best: string[]; lead: string; why: string[] } {
  const c = a.comps[0]!, m = modelFor(a.situation);
  const best = bestTeamFor(m, q.newAgents);
  const same = best.length === c.team.length && best.every((id) => c.team.includes(id));
  const mapName = mapById(a.situation.map)?.name ?? a.situation.map;
  const lead = same ? `Your agents can play the comp that fits ${mapName} best.` : '';
  const closer = unusual(m, best, c.team, usual, false).map((p) => betterWords(p, mapName));
  const pros = explainTeam(answerModel(a), c.team, explainFor(q, c)).pros;
  const why = closer.length ? closer : [...pros.filter((p) => p.includes(mapName)), ...pros.filter((p) => !p.includes(mapName))];
  return { team: c.team, best, lead, why: why.slice(0, MAP_PICK.why) };
}

/**
 * Why a map is worth banning: where the team's best comp there falls further short of the best
 * comp for the map than it does on the other maps (or else the biggest con on the comp's card there).
 */
function toBan(a: SituationAnswer, usual: Map<string, number>, q: Parameters<typeof mapPicks>[1]): { team: string[]; best: string[]; lead: string; why: string[] } {
  const c = a.comps[0];
  if (!c) return { team: [], best: [], lead: `No comp fits all of your choices on ${mapById(a.situation.map)?.name ?? a.situation.map}.`, why: [] };
  const m = modelFor(a.situation), best = bestTeamFor(m, q.newAgents);
  const here = unusual(m, best, c.team, usual, true).map((p) => p.words);
  const why = here.length ? here : explainTeam(answerModel(a), c.team, explainFor(q, c)).cons.slice(0, 1);
  return { team: c.team, best, lead: '', why: why.slice(0, MAP_PICK.why) };
}

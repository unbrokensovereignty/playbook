/**
 * What the other team's agents make you play around, and what answers it: the advice a coach gives
 * once the other team's comp is known. Each threat is one strength of theirs (kb/roles.ts), the
 * side you're on when it matters, and the strengths of yours that answer it, written like map needs
 * (`smoke +.6; flash +.45`, see maps.ts) and about as big: knowing their comp counts about as much as
 * the map does. The engine adds those needs as far as the threat goes (see threatsOf
 * in engine/model.ts), so comps that answer it rank higher, and a comp's pros and cons say so.
 *
 * How far a threat goes: each of their agents adds what their kit brings to the strength (on this
 * map and side) above `from`, and `full` of that is the whole threat. For some threats (`second`) only the agents after their strongest count, since
 * every team has one: one controller is normal, two controllers smoking a site is the threat.
 *
 * The words: `threat` starts with their agents (`{who}` becomes "Their Chamber" or "Their Chamber
 * and Jett") and then the verb in braces, written as for one agent (`{holds}` becomes "hold" for
 * two). `advice` is how to play around the threat without the utility that answers it, since it's
 * for a comp that has little of that utility: it must not lean on the strengths in `answer`.
 * `timed` is more advice for a team that times its plays together (from PLAY_RANK.from[3]), such as
 * a fake. `does` says what the answering utility does when "answers it" would claim too much.
 * A threat no kit answers (a Recon Bolt or a Haunt is shot down or stepped out of, whoever plays
 * it) has an empty `answer`: it adds nothing to what a comp needs, and the comp gets its advice.
 * Sources: the game's ability text (content.gen.ts) and how pro teams prepare for a known comp.
 */
import { parseNeeds, type Side } from './maps.ts';
import { isDim, type Dim } from './roles.ts';

export interface ThreatDef {
  id: string;
  /** Their strength that makes the threat. */
  dim: Dim;
  /** The side you're on when it matters (both when left out). */
  side?: Side;
  /** What an agent brings to the strength below this doesn't count. */
  from: number;
  /** How much above `from`, added up over their agents, is the whole threat. */
  full: number;
  /** Only their agents after the strongest one count: one controller is normal, a second one is the threat. */
  second?: true;
  /** Your strengths that answer it, as "dim +value; …" (empty when no kit does). */
  answer: string;
  threat: string;
  advice: string;
  /** More advice for a team that times its plays together, finishing "You can also …". */
  timed?: string;
  /** What the answering utility does, for one agent and for more, in place of "answers it". */
  does?: { one: string; many: string };
}

export const THREAT_DEFS: readonly ThreatDef[] = [
  {
    id: 'operator', dim: 'angles', from: 0.5, full: 0.4, answer: 'smoke +.6; flash +.45; wall +.45; disrupt +.3',
    threat: '{who} {holds} long angles with the Operator',
    advice: 'double-peek the Operator and fight it up close, where it’s slow to aim',
  },
  {
    id: 'firepower', dim: 'duel', from: 0.75, full: 0.3, answer: 'flash +.4; disrupt +.3',
    threat: '{who} {is} built to win fights alone',
    advice: 'play close enough together that every fight with them is a trade',
  },
  {
    id: 'setups', dim: 'anchor', side: 'attack', from: 0.55, full: 0.45, answer: 'clear +.6; recon +.4; disrupt +.3',
    threat: '{who} {sets} up utility that holds a site alone',
    advice: 'shoot the setup down from range before the hit, or hit the other site',
  },
  {
    id: 'retake', dim: 'retake', side: 'attack', from: 0.65, full: 0.3, answer: 'postplant +.5; stall +.25',
    threat: '{who} {brings} the utility for a strong retake',
    advice: 'plant where the Spike can be watched from cover, and guard it from a distance',
  },
  {
    // speed and entry don't stop a Recon Bolt or a Haunt: whoever it finds shoots it down or steps out of it
    id: 'information', dim: 'recon', side: 'attack', from: 0.75, full: 0.3, answer: '',
    threat: '{who} {finds} a push before it reaches the site',
    advice: 'shoot or dodge the utility that finds you, and hit together once it’s spent',
    timed: 'show one site and hit the other',
  },
  {
    id: 'speed', dim: 'entry', side: 'defense', from: 0.7, full: 0.3, answer: 'stall +.6; disrupt +.3; anchor +.25',
    threat: '{who} {takes} space fast',
    advice: 'play in pairs a little further back so one rush can’t take the site, and retake together',
  },
  {
    id: 'flashes', dim: 'flash', side: 'defense', from: 0.5, full: 0.3, second: true, answer: 'retake +.45; recon +.25; stall +.15',
    threat: '{who} {blinds} defenders before every fight',
    advice: 'hold off-angles a little further back, turn away from flashes, and retake together when a site falls',
  },
  {
    // a Slow Orb or a Nanoswarm on the plant spot holds the plant up, and retake utility takes the site back before the lineups land
    id: 'lineups', dim: 'postplant', side: 'defense', from: 0.7, full: 0.25, answer: 'stall +.4; retake +.4; disrupt +.15',
    threat: '{who} {guards} a planted Spike from afar',
    advice: 'stop the plant if you can, and retake fast and together, before the lineups land',
    does: { one: 'holds up the plant or speeds up the retake', many: 'hold up the plant or speed up the retake' },
  },
  {
    id: 'smokes', dim: 'smoke', side: 'defense', from: 0.5, full: 0.35, second: true, answer: 'stall +.45; recon +.3; clear +.15',
    threat: '{who} {smokes} off your angles to take a site',
    advice: 'fall back to angles they didn’t smoke and let them come out to you, instead of peeking into the smoke',
  },
];

export interface Threat extends ThreatDef { needs: Partial<Record<Dim, number>> }

export const THREATS: readonly Threat[] = THREAT_DEFS.map((t) => {
  const who = `threat ${t.id}`;
  if (!isDim(t.dim)) throw new Error(`${who}: no strength "${t.dim}"`);
  if (!(t.from > 0 && t.from < 1 && t.full > 0)) throw new Error(`${who}: from and full are out of range`);
  if (!t.threat.startsWith('{who} {') || !t.threat.includes('}')) throw new Error(`${who}: the threat must start with {who} and a verb`);
  const needs = parseNeeds(t.answer, who);
  if (Object.values(needs).some((v) => v <= 0)) throw new Error(`${who}: an answer only adds to what's needed`);
  return { ...t, needs };
});

/** A threat's sentence for their agents (names): "Their Chamber holds…", "Their Chamber and Jett hold…". */
export function threatLine(t: ThreatDef, names: readonly string[], join: (xs: readonly string[]) => string): string {
  const one = names.length === 1;
  return t.threat
    .replace('{who}', `Their ${join(names)}`)
    // the verb is written as for one agent: "holds" → "hold", "is" → "are"
    .replace(/\{(\w+)\}/, (_, verb: string) => (one ? verb : verb === 'is' ? 'are' : verb.replace(/s$/, '')));
}

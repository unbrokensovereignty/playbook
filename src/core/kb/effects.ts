/**
 * What each ability does, read off the game's own text for it (kb/kits.ts), so a sentence names
 * only an ability that does what the sentence says. Sage slows a push with Slow Orb (her Barrier
 * Orb only walls it off), and Jett's Tailwind is how she gets away after an Operator shot.
 *
 * The text is read for the words the game uses for each effect ("vision-blocking", "concuss",
 * "slows"). A few abilities do more than their text says, and those are added by hand in MORE,
 * with where it's from. After a patch refreshes the kits, tests/unit/abilities.test.ts fails if an
 * ability the app names for a strength no longer does it.
 */
import type { Dim } from './roles.ts';
import { abilityOn } from './kits.ts';

export type Effect =
  | 'smoke' | 'wall' | 'blind' | 'concuss' | 'slow' | 'reveal' | 'scout' | 'damage' | 'hold'
  | 'heal' | 'selfheal' | 'move' | 'buff' | 'gun' | 'alarm' | 'deny';

/** The game's words for each effect, in its ability text (marks taken out). */
const WORDS: readonly [Effect, RegExp][] = [
  // a vision-blocking wall is a wall (Phoenix's Blaze), and DOES counts a wall as a smoke too, less directly
  ['smoke', /\bsmokes?\b|vision-blocking(?! (?:fire )?walls?\b)/i],
  ['wall', /(?<!through an? )\bwalls?\b|\bbarriers?\b/i],
  ['blind', /\bflash|\bblind|nearsight/i],
  ['concuss', /concuss/i],
  ['slow', /\bslow(?:s|ed|ing)?\b|\bhinder|move slowly/i],
  ['reveal', /\breveal|\bmarks?\b|snapshot|shoots at enemies/i],
  ['scout', /take control|chases the|\bclones?\b|become[^.]*\binvisible/i],
  ['damage', /\bdeal(?:s|ing)?\b[^.]*\bdamage\b|for lethal damage|\bdecay|shoots at enemies/i],
  // what holds an enemy in place or stops them fighting back (vulnerable, deafen, a knock away and a
  // barrier in the way only weaken, move or block them)
  ['hold', /tether|\bpull|detain|crouch|cocoon|\bjam|suppress|knocks? (?:up|back)|levitating all/i],
  ['heal', /heal(?:ing)? allies|on a damaged ally|\bor heal\b|resurrect them/i],
  ['selfheal', /to heal\b|overheal|heals while|continuous healing/i],
  ['move', /\bdash|teleport|propel|\bhaste\b|\bslide|travel to it|launch upward|into the air|knocking away/i],
  ['buff', /combat stim|overheal|shield|intangible|invisib|immun|\bduel|resurrect|re-stabilized|with full health/i],
  ['gun', /sniper rifle|\bknives\b|lightning beam|FIRE to shoot\. ALT FIRE to aim/i],
  ['alarm', /audio cue|\btriggers?\b/i],
  ['deny', /destroy any enemy utility/i],
];

/** What an ability does beyond what its text says. */
const MORE: Record<string, Partial<Record<string, readonly Effect[]>>> = {
  // the team hears how many enemies ZERO/point suppressed, and who (VALORANT fandom wiki, patch 11.08)
  kayo: { E: ['reveal'] },
  // Dismiss about doubles Reyna's speed while she's intangible
  reyna: { E: ['move'] },
  // Inner Fire: Phoenix heals in his own fire, from Blaze and Hot Hands
  phoenix: { C: ['selfheal'], E: ['selfheal'] },
  // a controller's long wall blocks vision across a site and is played as a smoke, where a
  // duelist's wall (Phoenix's Blaze, Neon's Fast Lane) is one to cross behind; Cosmic Divide blocks
  // vision as well as bullets and sound (VALORANT fandom wiki)
  viper: { E: ['smoke'] },
  harbor: { Q: ['smoke'], X: ['smoke'] },
  astra: { X: ['smoke'] },
};

const seen = new Map<string, ReadonlySet<Effect>>();

/** What an agent's ability on a key does (nothing for a key they don't have, or the gun). */
export function effectsOf(id: string, key: string): ReadonlySet<Effect> {
  const at = `${id}|${key}`;
  let out = seen.get(at);
  if (!out) {
    const text = (abilityOn(id, key)?.text ?? '').replace(/<[^>]*>/g, '');
    out = new Set([...WORDS.filter(([, re]) => re.test(text)).map(([e]) => e), ...(MORE[id]?.[key] ?? [])]);
    seen.set(at, out);
  }
  return out;
}

/**
 * The effects that do each strength, as the app says it ("slows a push", "finds enemies"): the
 * first list does it outright and the second does it too, less directly (a wall or a smoke on a
 * choke slows a push, but less than a slow or a molly does).
 */
const DOES: Record<Dim, readonly [readonly Effect[], readonly Effect[]]> = {
  smoke: [['smoke'], ['wall']],
  wall: [['wall'], ['smoke']],
  flash: [['blind'], []],
  recon: [['reveal', 'scout'], ['alarm']],
  entry: [['move', 'buff', 'blind', 'concuss', 'hold'], ['wall', 'smoke']],
  clear: [['damage', 'concuss', 'blind', 'hold'], ['reveal', 'scout']],
  disrupt: [['concuss', 'hold', 'slow'], []],
  stall: [['slow', 'damage', 'hold', 'concuss'], ['wall', 'smoke']],
  anchor: [['slow', 'damage', 'hold', 'reveal', 'alarm', 'concuss', 'deny'], ['wall', 'smoke']],
  flank: [['reveal', 'alarm', 'hold', 'slow'], []],
  retake: [['blind', 'concuss', 'hold', 'damage', 'reveal', 'scout', 'slow', 'heal'], ['smoke', 'wall', 'move', 'buff', 'deny']],
  postplant: [['damage', 'slow', 'concuss', 'hold'], ['smoke']],
  sustain: [['heal'], []],
  duel: [['gun', 'buff', 'selfheal', 'move', 'damage'], []],
  angles: [['gun'], []],
  mobility: [['move'], []],
};

/**
 * Abilities that help with a strength without doing it, and how a sentence says so: a way out
 * after an Operator shot or after holding a site alone ("with Tailwind to get away"), and a heal of
 * the agent's own ("Reyna stays in the fight with Devour").
 */
const HELPS: Partial<Record<Dim, { effects: readonly Effect[]; how: 'escape' | 'self' }>> = {
  angles: { effects: ['move', 'buff'], how: 'escape' },
  anchor: { effects: ['move'], how: 'escape' },
  sustain: { effects: ['selfheal'], how: 'self' },
};

/**
 * Strengths an ability has or hasn't by what it does, whoever throws it: Harbor's Storm Surge is a
 * flash and Sage's Slow Orb is crowd control, whatever else the agent is there for. A list of who
 * brings one of these names every such ability on the team (the other strengths, like clearing
 * corners, are a judgement of how well a kit does them).
 */
export const PLAIN: ReadonlySet<Dim> = new Set<Dim>(['smoke', 'flash', 'recon', 'disrupt', 'sustain', 'mobility']);

/** The basic abilities (not the ultimate) that do a plain strength outright, as keys. */
export const plainKeys = (id: string, dim: Dim): string => (PLAIN.has(dim) ? ['C', 'Q', 'E'].filter((k) => fitOf(id, k, dim) === 'does').join('') : '');

/** How an ability works for a strength: it does it, does it less directly ('also'), helps in another way, or doesn't. */
export type Fit = 'does' | 'also' | 'escape' | 'self' | 'none';

export function fitOf(id: string, key: string, dim: Dim): Fit {
  if (key === 'G') return dim === 'duel' || dim === 'angles' ? 'does' : 'none';
  const has = effectsOf(id, key), [first, second] = DOES[dim];
  if (first.some((e) => has.has(e))) return 'does';
  if (second.some((e) => has.has(e))) return 'also';
  const helps = HELPS[dim];
  return helps && helps.effects.some((e) => has.has(e)) ? helps.how : 'none';
}

const ORDER: Record<Fit, number> = { does: 0, also: 1, escape: 2, self: 2, none: 9 };

/**
 * The ability keys to name for a strength, best first: abilities that do it before those that do
 * it less directly, then the ones that help another way; basic abilities before the ultimate,
 * which isn't there most rounds. Keys that do nothing for it are left out; the gun (G) stays, last.
 */
export function namedFor(id: string, keys: string, dim: Dim): string {
  const rank = (k: string) => (k === 'G' ? 99 : ORDER[fitOf(id, k, dim)] * 2 + (k === 'X' ? 5 : 0));
  return [...new Set(keys)].filter((k) => k === 'G' || fitOf(id, k, dim) !== 'none').sort((a, b) => rank(a) - rank(b)).join('');
}

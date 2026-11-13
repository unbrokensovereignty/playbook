/**
 * How much utility a step asks one player for, and what they have to give: no play asks anyone for
 * more smokes, flashes, stuns, clearing or slowing utility than their kit holds in a round
 * (kb/charges.ts). A step's sentence says what it asks for: "Flash A Elbow and A Alley" is two
 * flashes, "Smoke Mid Market or Mid Cubby" one smoke. When the player given the job has fewer, the
 * job counts for less in the play's fit (`coverage`), and their step says what they do with what
 * they have and what goes without (`fitText`): Omen, with one Paranoia, flashes A Elbow, and the
 * step says A Alley goes without a flash.
 */
import type { Agent } from '../kb/agents.ts';
import { reachesMore, usesOf } from '../kb/charges.ts';
import { abilityNames, PLURAL_ABILITIES } from '../kb/kits.ts';
import { mapById } from '../kb/maps.ts';
import { THROWN, type Job, type PlayStep } from '../kb/plays.ts';
import type { Dim } from '../kb/roles.ts';
import { escapeRegExp, listJoin } from '../text.ts';

/** The kinds of utility a step counts: smokes, flashes (or stuns in place of them), utility that clears a spot, and utility that slows a push. */
export type UseKind = 'smoke' | 'flash' | 'stun' | 'clear' | 'slow';

/** What each job spends, by the strength it's done with (a wall covers its whole lane, and information isn't counted, since one reveal shows an area). */
const KIND_BY: Partial<Record<Job, Partial<Record<Dim, UseKind>>>> = {
  smoke: { smoke: 'smoke' },
  wall: { smoke: 'smoke' },
  flash: { flash: 'flash', disrupt: 'stun' },
  retake: { flash: 'flash', disrupt: 'stun' },
  clear: { clear: 'clear', disrupt: 'stun' },
  stall: { stall: 'slow', clear: 'slow' },
};

/** The kind of utility a player spends on a job, by the strengths they do it with, if it's counted. */
export function useKind(job: Job, dims: readonly Dim[]): UseKind | undefined {
  const by = KIND_BY[job] ?? {};
  return dims.map((d) => by[d]).find((k): k is UseKind => !!k);
}

/** The ability keys a player uses for that kind of utility ("Q" for Omen's Paranoia), leaving out the ultimate when there's more. */
function keysFor(a: Agent, job: Job, dims: readonly Dim[]): string {
  const kind = useKind(job, dims), by = KIND_BY[job] ?? {};
  const keys = kind ? [...new Set(dims.filter((d) => by[d] === kind).map((d) => a.via[d] ?? '').join(''))].filter((k) => k !== 'G') : [];
  return (keys.length > 1 ? keys.filter((k) => k !== 'X') : keys).join('');
}

/** How many of that utility a player has for a job in a round, or Infinity when it isn't counted. */
export function usesFor(a: Agent, job: Job, dims: readonly Dim[]): number {
  return useKind(job, dims) ? usesOf(a.id, keysFor(a, job, dims)) : Infinity;
}

/** The jobs whose sentence says what one player throws; a step with two of them shares its targets, so neither is counted. */
const COUNTED: readonly Job[] = [...THROWN, 'stall'];

/** One place a step names: where it is in the sentence and how it reads there ("the back of the site"). */
interface Named { at: number; end: number; phrase: string }
/**
 * A run of places one piece of the sentence asks utility for: after its verb ("Smoke A Tower and A
 * Link"), before "with flashes" (`plural` true, or false for "with a flash"), or after "cut off".
 * `or` is set for a choice ("A Short or B Long"), which asks for one. `tail` is a clause that goes
 * on with more ("from A Lobby, then A Security once the site is taken"), with where it starts.
 * `verb` is where the verb that asks starts, when one does.
 */
interface Ask { items: Named[]; or: boolean; tail?: { at: number; end: number; from: number }; plural?: boolean; verb?: number }

const tokenSource = new Map<string, string>();
/** A place in a sentence: a callout of the map, or the site, with "the back of" before and an alias or "corners" after. */
function tokenOf(map: string): string {
  let src = tokenSource.get(map);
  if (!src) {
    const names = (mapById(map)?.callouts ?? []).map((c) => c.name).filter((n) => !/ Side Spawn$/.test(n)).sort((x, y) => y.length - x.length);
    src = `(?:the back of )?(?:${[...names.map(escapeRegExp), 'the site', 'the plant'].join('|')})(?: \\([^)]*\\))?(?: corners)?(?![A-Za-z])`;
    tokenSource.set(map, src);
  }
  return src;
}

/** The run of places that starts at `at`, if one does. */
function listAt(text: string, at: number, token: string): Ask | undefined {
  const tok = new RegExp(token, 'y'), sep = /(, and |, or |, | and | or )/y;
  tok.lastIndex = at;
  let m = tok.exec(text);
  if (!m) return undefined;
  const items: Named[] = [{ at, end: at + m[0].length, phrase: m[0] }];
  let or = false, end = items[0]!.end;
  for (;;) {
    sep.lastIndex = end;
    const s = sep.exec(text);
    if (!s) break;
    tok.lastIndex = end + s[0].length;
    m = tok.exec(text);
    if (!m) break;
    if (s[0].includes('or')) or = true;
    items.push({ at: tok.lastIndex - m[0].length, end: tok.lastIndex, phrase: m[0] });
    end = tok.lastIndex;
  }
  return { items, or };
}

/** The verbs that ask for each kind of utility, before the places they ask it for. */
const VERBS: Record<UseKind, RegExp> = {
  smoke: /\b[Ss]moke (?:off )?/g,
  // the verb, not the thing ("with a flash through B Garage")
  flash: /(?<!\ba )\b[Ff]lash (?:over |into |onto |through )?/g,
  stun: /(?<!\ba )\b[Ff]lash (?:over |into |onto |through )?/g,
  clear: /\b[Cc]lear /g,
  slow: /\b[Ss]low (?:down )?/g,
};

/** What a step's sentence asks one player for, for a job done with a kind of utility. */
export function asksIn(text: string, map: string, job: Job, kind: UseKind): Ask[] {
  const token = tokenOf(map), out: Ask[] = [];
  const verb = job === 'wall' ? /\bcut off /g : job === 'stall' || job === 'clear' ? VERBS[job === 'stall' ? 'slow' : 'clear'] : VERBS[kind];
  for (const v of text.matchAll(new RegExp(verb.source, 'g'))) {
    const list = listAt(text, v.index + v[0].length, token);
    if (!list) continue;
    // "Smoke A Tower and A Link from A Lobby, then A Security once the site is taken"
    const last = list.items[list.items.length - 1]!.end;
    const then = new RegExp(`(?: from ${token})?, then `, 'y');
    then.lastIndex = last;
    const t = then.exec(text);
    const more = t ? listAt(text, then.lastIndex, token) : undefined;
    if (t && more) {
      const stop = text.slice(more.items[more.items.length - 1]!.end).search(/[,.]/);
      const end = stop < 0 ? text.length : more.items[more.items.length - 1]!.end + stop;
      const from = list.items.length;
      out.push({ items: [...list.items, ...more.items], or: list.or || more.or, tail: { at: last + (t[0].startsWith(' from') ? t[0].indexOf(',') : 0), end, from }, verb: v.index });
    } else out.push({ ...list, verb: v.index });
  }
  // "Take A Elbow and the site with flashes": the places just before
  if (kind === 'flash' || kind === 'stun') {
    for (const w of text.matchAll(/ with (flashes|a flash)\b/g)) {
      let best: Ask | undefined;
      for (const s of text.slice(0, w.index).matchAll(new RegExp(`(?<![A-Za-z])${token}`, 'g'))) {
        const list = listAt(text, s.index, token);
        if (list && list.items[list.items.length - 1]!.end === w.index) { best = list; break; }
      }
      if (best) out.push({ ...best, plural: w[1] === 'flashes' });
    }
  }
  return out.sort((x, y) => x.items[0]!.at - y.items[0]!.at);
}

/** How many of that utility the asks add up to: a choice asks for one, and "with a flash" for one. */
const countOf = (a: Ask): number => (a.or ? 1 : a.plural === false ? Math.min(1, a.items.length) : a.items.length);
export const askedCount = (asks: readonly Ask[]): number => asks.reduce((n, a) => n + countOf(a), 0);

/**
 * For a job in a step, how many of each kind of utility its sentence asks the player for (0 when it
 * doesn't say, or when another job in the step shares the places it names).
 */
export function needOf(map: string, step: Pick<PlayStep, 'jobs' | 'text'>, job: Job): (kind: UseKind) => number {
  if (!COUNTED.includes(job) || step.jobs.some((j) => j !== job && COUNTED.includes(j))) return () => 0;
  const seen = new Map<UseKind, number>();
  return (kind) => {
    let n = seen.get(kind);
    if (n === undefined) { n = askedCount(asksIn(step.text, map, job, kind)); seen.set(kind, n); }
    return n;
  };
}

/** How much of a job a player gets done when they have less than it asks for: half of it counts whatever happens, the rest by the share they can cover. */
export function coverage(a: Agent, job: Job, dims: readonly Dim[], need: (kind: UseKind) => number): number {
  const kind = useKind(job, dims);
  if (!kind) return 1;
  const asked = need(kind), has = usesFor(a, job, dims);
  return asked > has ? (1 + has / asked) / 2 : 1;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);
/** What a player has, said for each kind when it isn't one ability's charges: "has two smokes", "can clear one of these". */
const HAS: Record<UseKind, (n: number) => string> = {
  smoke: (n) => `has ${numberWord(n)} smoke${n === 1 ? '' : 's'}`,
  flash: (n) => `has ${numberWord(n)} flash${n === 1 ? '' : 'es'}`,
  stun: (n) => `has ${numberWord(n)} stun${n === 1 ? '' : 's'}`,
  clear: (n) => `can clear ${numberWord(n)} of these`,
  slow: (n) => `can slow ${numberWord(n)} of these`,
};
/** What the places a player can't reach go without: what the job puts there. */
const without = (job: Job, kind: UseKind) => (job === 'clear' || job === 'stall' ? 'utility' : kind === 'smoke' ? 'a smoke' : 'a flash');

/**
 * A step's sentence for the player who does a job with `uses` of that utility, when the sentence
 * asks for more: the places they can't reach come out of it, and a sentence after it says what goes
 * without ("Omen’s Paranoia has one charge, so A Alley goes without a flash"). With one, "with flashes"
 * and "your smokes" are said for one. The sentence is unchanged when the player has enough.
 */
export function fitText(step: Pick<PlayStep, 'jobs' | 'text'>, map: string, a: Agent, job: Job, dims: readonly Dim[]): string {
  const { text } = step, kind = useKind(job, dims);
  if (!kind) return text;
  const uses = usesFor(a, job, dims);
  // with none to share out, the job's stand-in says what the player does instead
  if (uses < 1) return text;
  let out = text;
  const dropped: string[] = [];
  const asks = needOf(map, step, job)(kind) > uses ? asksIn(text, map, job, kind) : [];
  if (asks.length) {
    let left = uses;
    const edits: { at: number; end: number; to: string }[] = [];
    for (const ask of asks) {
      const n = countOf(ask);
      if (n <= left) { left -= n; continue; }
      const keep = left;
      left = 0;
      const phrase = (x: Named) => x.phrase.replace(/ \([^)]*\)/, '');
      if (ask.plural !== undefined) {
        // "Take A Elbow and the site with flashes": the places stay, since the team takes them, and the
        // flash goes on the first (or on none, once an earlier ask in the step took every charge)
        const w = text.indexOf(' with flashes', ask.items[ask.items.length - 1]!.end);
        if (keep <= 1 && w >= 0) edits.push({ at: w, end: w + ' with flashes'.length, to: keep === 1 ? ' with a flash' : '' });
        dropped.push(...ask.items.slice(keep).map(phrase));
        continue;
      }
      if (keep < 1) {
        // an earlier ask in the step took every charge: this one comes out with what joins it on
        // ("then push on and flash A Garden" becomes "then push on"), and its places go without
        const join = ask.verb === undefined ? undefined : /(?:,? and |,? then |, )$/.exec(text.slice(0, ask.verb));
        if (join) edits.push({ at: join.index, end: ask.tail ? ask.tail.end : ask.items[ask.items.length - 1]!.end, to: '' });
        dropped.push(...ask.items.map(phrase));
        continue;
      }
      const main = ask.tail ? ask.items.slice(0, ask.tail.from) : ask.items;
      if (keep < main.length) {
        edits.push({ at: main[0]!.at, end: main[main.length - 1]!.end, to: listJoin(main.slice(0, keep).map((x) => x.phrase)) });
        if (ask.tail) edits.push({ at: ask.tail.at, end: ask.tail.end, to: '' });
      } else if (ask.tail) {
        const more = ask.items.slice(ask.tail.from);
        const kept = more.slice(0, keep - main.length);
        if (!kept.length) edits.push({ at: ask.tail.at, end: ask.tail.end, to: '' });
        else edits.push({ at: more[0]!.at, end: more[more.length - 1]!.end, to: listJoin(kept.map((x) => x.phrase)) });
      }
      dropped.push(...ask.items.slice(keep).map(phrase));
    }
    for (const e of edits.sort((x, y) => y.at - x.at)) out = out.slice(0, e.at) + e.to + out.slice(e.end);
  }
  if (uses === 1) {
    if (kind === 'flash' || kind === 'stun') out = out.replace(/\bwith flashes\b/g, 'with a flash');
    if (kind === 'smoke') out = out.replace(/\bwith smokes\b/g, 'with a smoke').replace(/\b([Yy])our smokes\b([^.]*?)\bthem\b/g, '$1our smoke$2it').replace(/\b([Yy])our smokes\b/g, '$1our smoke');
  }
  if (!dropped.length) return out;
  const one = dropped.length === 1 && !/ corners$/.test(dropped[0]!);
  const keys = keysFor(a, job, dims), abilities = abilityNames(a.id, keys);
  // "Omen’s Paranoia has one charge", "Vyse has only Steel Garden for this", "Tejo can clear two of these"
  const has = keys === 'X' && abilities.length === 1 ? `${a.name} has only ${abilities[0]} for this`
    : abilities.length === 1 && !reachesMore(a.id, keys) ? `${a.name}’s ${abilities[0]} ${PLURAL_ABILITIES.has(abilities[0]!) ? 'have' : 'has'} ${numberWord(uses)} charge${uses === 1 ? '' : 's'}`
    : `${a.name} ${HAS[kind](uses)}`;
  return `${out.replace(/\s+([,.])/g, '$1')} ${has}, so ${listJoin(dropped)} ${one ? 'goes' : 'go'} without ${without(job, kind)}.`;
}

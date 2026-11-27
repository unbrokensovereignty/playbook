/**
 * What each sound is, worked out without playing anything: which recording a cue plays in each set,
 * how loud, and how a play varies. `sound.ts` turns a plan from here into Web Audio nodes, and the
 * unit tests read the same tables, so what's tested is what plays.
 *
 * Every set plays short recordings built into the file (assets/sounds/, credited in CREDITS.md):
 *
 * - Clarity, the default: soft sine tones from SND's Sine pack, with the three clicks heard most
 *   (tap, tick and toggle) from JC Sounds' UI Utility Pack.
 * - Felt: warm piano notes from SND's Piano pack.
 * - Beacon: alert tones from HaelDB's Notices.
 *
 * A cue with several files picks one at random each time and never plays the same one twice
 * running. Every play also moves its pitch by up to 12 cents and its level by up to 1 dB.
 */
import { seededRng, type Rng } from '../core/util.ts';

export type SoundKind = 'ui' | 'results';

export const SOUNDS = {
  tap: 'ui', toggle: 'ui', page: 'ui', open: 'ui', close: 'ui', remove: 'ui', undo: 'ui', error: 'ui', tick: 'ui',
  pick: 'ui', unpick: 'ui',
  ready: 'results', saved: 'results',
} as const satisfies Record<string, SoundKind>;
export type SoundName = keyof typeof SOUNDS;

export type SoundSet = 'clarity' | 'felt' | 'beacon';
export const SOUND_SETS: readonly SoundSet[] = ['clarity', 'felt', 'beacon'];
export const DEFAULT_SET: SoundSet = 'clarity';

/** The clicks that come many times a session. They sit lowest. */
export const FREQUENT: readonly SoundName[] = ['tap', 'tick', 'toggle', 'page', 'open', 'close', 'pick', 'unpick'];

/** The folders under assets/sounds/ the sets play from. */
export const PACKS = ['snd-sine', 'snd-piano', 'jc', 'haeldb'] as const;
export type Pack = (typeof PACKS)[number];

/** A recording: its folder and file name (without .mp3), and its peak in dBFS as the file has it. */
export type Take = readonly [file: `${Pack}/${string}`, peak: number];

/**
 * Where each kind of cue puts its loudest moment, in dB before the set's `OFFSET`: the frequent
 * clicks lowest, remove, undo and error a little higher, and a ready plan or a save highest.
 */
export const TARGET = { frequent: -11, alert: -8, news: -5 } as const;
export const targetOf = (name: SoundName): number => (SOUNDS[name] === 'results' ? TARGET.news : FREQUENT.includes(name) ? TARGET.frequent : TARGET.alert);

/**
 * Brings each set as a whole down to the app's level, in dB. With it, the loudest 50 ms of a cue on
 * the gallery's meter, at full volume and averaged over the 13 cues, comes to about -32 dB in every
 * set, so changing set keeps the volume.
 */
export const OFFSET: Record<SoundSet, number> = { clarity: -14, felt: -17.5, beacon: -18 };

/** How far a quiet file may be turned up, in dB. */
const MOST_GAIN = 18;

// SND Sine and Piano share their file names, so the two sets are drawn from one map
const snd = (pack: 'snd-sine' | 'snd-piano', peaks: Record<string, number>) => (...names: string[]): readonly Take[] =>
  names.map((n) => [`${pack}/${n}`, peaks[n]!] as const);

const sine = snd('snd-sine', {
  select: -5.9, type_01: -5.9, type_02: -5.8, type_03: -5.9, swipe_01: -9.1, swipe_02: -8.9, swipe_03: -8.4, swipe_05: -9.1,
  transition_up: -5.9, transition_down: -5.9, disabled: -5.9, caution: -5.9, notification: -6, celebration: -5.9,
});
const piano = snd('snd-piano', {
  button: -5.9, tap_01: -15.9, tap_02: -19.6, tap_03: -18.9, tap_04: -19.3, toggle_on: -7.9, toggle_off: -9.5, select: -10.9,
  type_01: -15.9, type_02: -15.8, type_03: -15.8, swipe_01: -6.8, swipe_02: -6.8, swipe_03: -7.9, swipe_05: -6.4,
  transition_up: -7.9, transition_down: -7.9, disabled: -5.9, caution: -5.9, notification: -6, celebration: -5.9,
});
const jc = (n: string, peak: number): Take => [`jc/${n}`, peak];
const notice = (n: string, peak: number): readonly Take[] => [[`haeldb/${n}`, peak]];

/** Which recordings each cue of each set plays. */
export const SETS: Record<SoundSet, Record<SoundName, readonly Take[]>> = {
  clarity: {
    tap: [jc('single-set-11_01', -4.4), jc('single-set-11_03', -3)],
    tick: [jc('single-set-11_02', -9.2)],
    toggle: [jc('twonote-up-set-11_01', -5.5)],
    pick: sine('select'),
    unpick: sine('type_01', 'type_02', 'type_03'),
    page: sine('swipe_01', 'swipe_02', 'swipe_03'),
    open: sine('transition_up'),
    close: sine('transition_down'),
    remove: sine('disabled'),
    undo: sine('swipe_05'),
    error: sine('caution'),
    ready: sine('notification'),
    saved: sine('celebration'),
  },
  felt: {
    tap: piano('button'),
    tick: piano('tap_01', 'tap_02', 'tap_03', 'tap_04'),
    toggle: piano('toggle_on', 'toggle_off'),
    pick: piano('select'),
    unpick: piano('type_01', 'type_02', 'type_03'),
    page: piano('swipe_01', 'swipe_02', 'swipe_03'),
    open: piano('transition_up'),
    close: piano('transition_down'),
    remove: piano('disabled'),
    undo: piano('swipe_05'),
    error: piano('caution'),
    ready: piano('notification'),
    saved: piano('celebration'),
  },
  beacon: {
    tap: notice('9', -11.3),
    tick: notice('7', -12.7),
    toggle: notice('5', -7),
    pick: notice('6', -6.6),
    unpick: notice('2', -12.7),
    page: notice('1', -17.7),
    open: notice('3', -14.1),
    close: notice('4', -4.6),
    remove: notice('8', -12.7),
    undo: notice('2', -12.7),
    error: notice('wrong-error', -13.9),
    ready: notice('0', -5.8),
    saved: notice('3', -14.1),
  },
};

/** Every file a set plays, once each. */
export const filesOf = (set: SoundSet): string[] => [...new Set(Object.values(SETS[set]).flatMap((t) => t.map(([f]) => f)))];
/** Every file any set plays, once each. */
export const allFiles = (): string[] => [...new Set(SOUND_SETS.flatMap(filesOf))];

/**
 * The shared output: its level, a high-pass for small speakers, a limiter so overlaps can't clip,
 * and a cap on voices. The limiter is a curve (see `limiterCurve`) rather than a
 * DynamicsCompressorNode: Chrome's compressor turns a short click after silence down by 10 to 17 dB
 * even far under its threshold, and holds everything back by 6 ms to look ahead.
 */
export const BUS = {
  /** The overall level, the same for every set; each set's `OFFSET` brings it in line. */
  level: 1.5,
  highpass: 120,
  /** Untouched up to `linear` (-6 dBFS), then rounded off so nothing passes `ceiling` (-0.5 dBFS), for inputs up to `range`. */
  limiter: { linear: 0.5, ceiling: 0.944, range: 4 },
  /** Sounds playing at once; one more fades out the oldest. */
  voices: 6,
  /** The same sound again this soon (a double click) is left out, in seconds. */
  guard: 0.045,
} as const;

/** The limiter's curve for a WaveShaperNode, taking inputs from -range to +range (scaled down by `range` before it). */
export function limiterCurve(n = 4097): Float32Array<ArrayBuffer> {
  const { linear, ceiling, range } = BUS.limiter, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 * range - range, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= linear ? a : linear + (ceiling - linear) * Math.tanh((a - linear) / (ceiling - linear)));
  }
  return c;
}

/** One room for every cue: a short, dark tail, mixed in a little (`WET`). */
export const ROOM = { length: 0.17, predelay: 0.0025 } as const;
/** How much of the room every cue uses. */
export const WET = 0.08;

/**
 * How a recording is trimmed as it plays: it starts `pre` seconds before its first sound (the
 * first sample within 40 dB of its peak), so it lands with the change, and stops once it's
 * `floor` dB under its peak. It fades out over `fade` seconds, or `longFade` for one longer than
 * `long` seconds, whose tail is cut short in the file.
 */
export const TRIM = { pre: 0.002, start: -40, floor: -60, fade: 0.03, long: 1.5, longFade: 0.25 } as const;

// ---- each play a little different

/** Up to `range` either way, at random. */
const spread = (rnd: Rng, range: number) => (rnd() * 2 - 1) * range;

/** How far a play may move from its file: pitch in cents and level in dB. */
export const VARY = { cents: 12, dB: 1 } as const;

export interface PlanOptions {
  /** The take played last, which this play won't repeat. */
  avoid?: number;
  /** A take to play (for the tests and the level check). */
  variant?: number;
  /** No variation: the take exactly as it is. */
  exact?: boolean;
}

/** Which of `n` takes to play: the one asked for, or one at random that isn't the one played last. */
function pickTake(n: number, rnd: Rng, o: PlanOptions): number {
  if (o.variant !== undefined && o.variant >= 0) return o.variant % n;
  if (n === 1) return 0;
  const avoid = o.avoid ?? -1;
  if (avoid < 0 || avoid >= n) return Math.floor(rnd() * n);
  const v = Math.floor(rnd() * (n - 1));
  return v >= avoid ? v + 1 : v;
}

/** The level a file plays at in a cue of a set, in dB: its peak brought to the cue's target, then the set's offset. */
export const levelOf = (name: SoundName, set: SoundSet, peak: number): number => Math.min(MOST_GAIN, targetOf(name) - peak) + OFFSET[set];

/** A play of a recording: which take, how fast, how loud, and its share of the room. */
export interface TakePlan { variant: number; file: string; rate: number; gain: number; wet: number }

/** What to play for a cue of a set, varied a little with `rnd`. */
export function takePlan(name: SoundName, set: SoundSet, rnd: Rng, o: PlanOptions = {}): TakePlan {
  const takes = SETS[set][name], variant = pickTake(takes.length, rnd, o);
  const [file, peak] = takes[variant]!;
  const rate = o.exact ? 1 : 2 ** (spread(rnd, VARY.cents) / 1200);
  const gain = 10 ** ((levelOf(name, set, peak) + (o.exact ? 0 : spread(rnd, VARY.dB))) / 20);
  return { variant, file, rate, gain, wet: WET };
}

/** How many takes a cue has in a set. */
export const takesOf = (name: SoundName, set: SoundSet): number => SETS[set][name].length;

/**
 * Where a decoded recording starts and stops, in samples, by `TRIM`: from just before its first
 * sound to where it has died away.
 */
export function spanOf(d: Float32Array, rate: number): { from: number; to: number } {
  let peak = 0;
  for (const x of d) peak = Math.max(peak, Math.abs(x));
  if (peak === 0) return { from: 0, to: 0 };
  const start = peak * 10 ** (TRIM.start / 20), floor = peak * 10 ** (TRIM.floor / 20);
  let first = 0, last = d.length - 1;
  while (first < d.length && Math.abs(d[first]!) < start) first++;
  while (last > first && Math.abs(d[last]!) < floor) last--;
  return { from: Math.max(0, first - Math.round(TRIM.pre * rate)), to: Math.min(d.length, last + 1) };
}

/** How long the end of a play fades, in seconds, for a play that lasts `len` seconds. */
export const fadeOf = (len: number): number => Math.min(len / 2, len > TRIM.long ? TRIM.longFade : TRIM.fade);

/**
 * The shared room, as an impulse for a ConvolverNode: two channels of noise a few milliseconds
 * apart, dying 60 dB over `ROOM.length` and getting darker as they go, with three early
 * reflections off the desk. Each channel has unit energy, so `WET` is the room's share of the level.
 */
export function roomImpulse(rate: number, seed = 7): Float32Array[] {
  const n = Math.round(ROOM.length * rate), pre = Math.round(ROOM.predelay * rate);
  const fade = Math.round(0.008 * rate), tau = ROOM.length / 6.9;
  return [0, 1].map((ch) => {
    const r = seededRng(seed + ch * 101), x = new Float32Array(n);
    let low = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / rate;
      // a one-pole lowpass that closes as the tail goes on, so the room sounds soft
      const k = 0.55 - 0.4 * (t / ROOM.length);
      low += k * ((r() * 2 - 1) - low);
      x[i] = low * Math.exp(-t / tau) * Math.min(1, (i - pre) / (0.001 * rate)) * Math.min(1, (n - 1 - i) / fade);
    }
    for (const [ms, g] of [[7.3, 0.5], [11.9, 0.34], [17.4, 0.22]] as const) {
      const i = Math.round(((ms + ch * 1.3) / 1000) * rate);
      if (i < n) x[i] = (x[i] ?? 0) + g * 0.05;
    }
    let e = 0;
    for (const s of x) e += s * s;
    const k = 1 / Math.sqrt(e || 1);
    for (let i = 0; i < n; i++) x[i] = x[i]! * k;
    return x;
  });
}

/** The sounds playing now, oldest first. Adding one past the cap hands back the ones to fade out. */
export class Voices<T> {
  private list: { v: T; end: number }[] = [];
  readonly cap: number;
  constructor(cap: number) { this.cap = cap; }
  add(v: T, end: number, now: number): T[] {
    this.list = this.list.filter((x) => x.end > now);
    const out: T[] = [];
    while (this.list.length >= this.cap) out.push(this.list.shift()!.v);
    this.list.push({ v, end });
    return out;
  }
  get size(): number { return this.list.length; }
}

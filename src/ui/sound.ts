/**
 * Sound effects, synthesized in the browser (no audio files). Every note comes from one key
 * (C major pentatonic), so sounds that follow each other form a tune. Three sets: Desk (paper and
 * wood), Chimes (small bells) and Kalimba (plucked tines). Clicks and results have their own volume.
 */

export type SoundKind = 'ui' | 'results';

export const SOUNDS = {
  tap: 'ui', toggle: 'ui', page: 'ui', open: 'ui', close: 'ui', remove: 'ui', undo: 'ui', error: 'ui', tick: 'ui',
  pick: 'ui', unpick: 'ui',
  ready: 'results', saved: 'results',
} as const satisfies Record<string, SoundKind>;
export type SoundName = keyof typeof SOUNDS;

export type SoundSet = 'desk' | 'chimes' | 'kalimba';
export const SOUND_SETS: readonly SoundSet[] = ['desk', 'chimes', 'kalimba'];

export interface SoundConfig { on: boolean; set: SoundSet; master: number; ui: number; results: number }

let cfg: SoundConfig = { on: true, set: 'desk', master: 0.6, ui: 0.5, results: 0.7 };
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const lastPlayed = new Map<SoundName, number>();

export function configureSound(c: SoundConfig) { cfg = c; }

function audio(): AudioContext | null {
  if (!cfg.on) return null;
  // before the first click or key press the browser won't start a sound, and warns about trying
  // (the welcome dialog opens with the page); browsers that can't tell try anyway
  if (!ctx && (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === false) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      out = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      out.connect(comp).connect(ctx.destination);
    }
    // resuming waits for a click; leaving the page first rejects it, which is fine
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** MIDI note → frequency. The pentatonic scale from C: C D E G A. */
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
/** The n-th note of the scale above C5 (n can be negative). */
export const scaleNote = (n: number): number => {
  const oct = Math.floor(n / 5), i = ((n % 5) + 5) % 5;
  return 72 + oct * 12 + (PENTA[i] as number);
};

interface Voice { type?: OscillatorType; gain?: number; attack?: number; decay: number; partials?: readonly (readonly [number, number])[]; lowpass?: number; bend?: number }

function note(ac: BaseAudioContext, dest: AudioNode, midi: number, at: number, v: Voice) {
  const peak = v.gain ?? 0.3, attack = v.attack ?? 0.005;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(peak, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + v.decay);
  let node: AudioNode = env;
  if (v.lowpass) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = v.lowpass;
    env.connect(f);
    node = f;
  }
  node.connect(dest);
  for (const [ratio, level] of v.partials ?? [[1, 1]]) {
    const o = ac.createOscillator();
    o.type = v.type ?? 'sine';
    o.frequency.setValueAtTime(hz(midi) * ratio, at);
    if (v.bend) o.frequency.exponentialRampToValueAtTime(hz(midi) * ratio * v.bend, at + attack + v.decay);
    const g = ac.createGain();
    g.gain.value = level;
    o.connect(g).connect(env);
    o.start(at);
    o.stop(at + attack + v.decay + 0.05);
  }
}

/** A sound set: its main note, the small click of a button, and its brighter note for good news. */
interface Kit { tone: Voice; click: Voice; bright: Voice }

const CHIME: Voice = { type: 'sine', decay: 0.55, gain: 0.22, partials: [[1, 1], [2.76, 0.28], [5.4, 0.08]] };
const KITS: Record<SoundSet, Kit> = {
  // a wooden pluck, and the knock of a pencil on a desk
  desk: {
    tone: { type: 'triangle', decay: 0.16, gain: 0.37, lowpass: 2600, partials: [[1, 1], [2, 0.18]] },
    click: { type: 'triangle', decay: 0.03, gain: 0.13, lowpass: 2200 },
    bright: CHIME,
  },
  // a small bell, and the tink of a glass
  chimes: {
    tone: { ...CHIME, gain: 0.17 },
    click: { type: 'sine', decay: 0.045, gain: 0.09, partials: [[1, 1], [2.76, 0.25]] },
    bright: { ...CHIME, decay: 0.7, partials: [[1, 1], [2.76, 0.32], [5.4, 0.12]] },
  },
  // a plucked metal tine: a round note with a faint ring above it
  kalimba: {
    tone: { type: 'sine', attack: 0.003, decay: 0.4, gain: 0.2, lowpass: 4200, partials: [[1, 1], [5.9, 0.1], [2, 0.06]] },
    click: { type: 'sine', decay: 0.05, gain: 0.1, partials: [[1, 1], [5.9, 0.08]] },
    bright: { type: 'sine', attack: 0.003, decay: 0.55, gain: 0.2, partials: [[1, 1], [5.9, 0.14], [3, 0.05]] },
  },
};

/** Plays a sound. */
export function play(name: SoundName): void {
  const kind = SOUNDS[name];
  const vol = cfg.master * cfg[kind];
  if (!cfg.on || vol <= 0.001) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < 45) return; // a double click shouldn't double the sound
  lastPlayed.set(name, now);
  const ac = audio();
  if (!ac || !out) return;
  // each sound gets its own volume, so overlapping sounds of different kinds don't affect each other
  const bus = ac.createGain();
  bus.gain.value = vol;
  bus.connect(out);
  render(ac, bus, name, cfg.set, ac.currentTime + 0.005);
}

/** Writes sound `name` of a set into `bus`, starting at time `t`. */
function render(ac: BaseAudioContext, bus: AudioNode, name: SoundName, set: SoundSet, t: number): void {
  const k = KITS[set], v = k.tone;
  const soft = (x: Voice, g: number) => ({ ...x, gain: (x.gain ?? 0.3) * g });
  const seq = (notes: readonly number[], gap: number, voice: Voice, from = t) => notes.forEach((n, i) => note(ac, bus, scaleNote(n), from + i * gap, voice));
  const one = (n: number, voice: Voice, at = t) => note(ac, bus, scaleNote(n), at, voice);
  switch (name) {
    case 'tap': one(5, k.click); break;
    case 'tick': one(8, { ...soft(k.click, 0.6), decay: (k.click.decay) * 0.8 }); break;
    case 'toggle': one(4, k.click); one(6, soft(k.click, 0.75), t + 0.045); break;
    // switching pages: one soft low note that settles, never a hiss
    case 'page': one(1, { ...soft(k.click, 1.1), decay: k.click.decay * 2.2, bend: set === 'desk' ? 0.94 : undefined }); break;
    case 'open': one(3, soft(v, 0.35)); break;
    case 'close': one(1, soft(v, 0.3)); break;
    case 'remove': one(-1, soft(v, 0.5)); one(-3, soft(v, 0.4), t + 0.07); break;
    case 'undo': one(2, soft(v, 0.4)); one(0, soft(v, 0.35), t + 0.06); break;
    case 'error': one(-4, { type: 'triangle', decay: 0.18, gain: 0.18, lowpass: 900 }); break;
    case 'pick': one(4, soft(v, 0.45)); break;
    case 'unpick': one(1, soft(v, 0.35)); break;
    // a plan is ready: a short rising line
    case 'ready': seq([0, 2, 4], 0.07, soft(v, 0.8)); break;
    case 'saved': seq([2, 4, 7], 0.08, soft(k.bright, 0.9)); break;
  }
}

/**
 * How loud a sound of a set is, drawn without playing it: its peak, and its loudest stretch of
 * 50 ms (as root mean square), weighted the way loudness meters hear (low notes count for less,
 * the middle and top for a little more). For the level check on the sound gallery and its test.
 */
export async function measure(name: SoundName, set: SoundSet): Promise<{ peak: number; loud: number }> {
  const rate = 44100, ac = new OfflineAudioContext(1, rate * 2, rate);
  const low = ac.createBiquadFilter(), high = ac.createBiquadFilter();
  low.type = 'highpass'; low.frequency.value = 100; low.Q.value = 0.5;
  high.type = 'highshelf'; high.frequency.value = 1500; high.gain.value = 4;
  low.connect(high).connect(ac.destination);
  render(ac, low, name, set, 0.01);
  const d = (await ac.startRendering()).getChannelData(0);
  const win = Math.round(rate * 0.05);
  let peak = 0, sum = 0, loud = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i]!;
    peak = Math.max(peak, Math.abs(x));
    sum += x * x;
    if (i >= win) { const y = d[i - win]!; sum -= y * y; }
    if (i >= win - 1) loud = Math.max(loud, Math.sqrt(Math.max(0, sum) / win));
  }
  return { peak, loud };
}

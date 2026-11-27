/**
 * Sound effects, from the tables in `cues.ts`. Three sets of short recordings: Clarity (soft sine
 * tones, with three crisp clicks), Felt (piano) and Beacon (alert tones). The recordings are built
 * into the file and decoded when the first sound plays, so nothing is fetched. Clicks and results
 * have their own volume.
 *
 * Every cue goes out through one bus: its own volume, a little of a shared room, a high-pass at
 * 120 Hz so small speakers don't muddy, and a limiter so sounds that overlap can't clip. At most six
 * play at once; one more fades out the oldest. Nothing is held back to look ahead, so a sound starts
 * in the same moment as the change it goes with. The one wait is a file's first play, which starts
 * as soon as it's decoded (a few milliseconds), and is left out if that takes longer than `LATE`.
 */
import sine from 'assets:sounds/snd-sine';
import piano from 'assets:sounds/snd-piano';
import jc from 'assets:sounds/jc';
import haeldb from 'assets:sounds/haeldb';
import { seededRng } from '../core/util.ts';
import {
  BUS, DEFAULT_SET, fadeOf, filesOf, limiterCurve, ROOM, roomImpulse, SOUNDS, spanOf, takePlan, Voices, WET,
  type Pack, type SoundName, type SoundSet, type TakePlan,
} from './cues.ts';

export { DEFAULT_SET, SOUND_SETS, SOUNDS, takesOf, type SoundKind, type SoundName, type SoundSet } from './cues.ts';

export interface SoundConfig { on: boolean; set: SoundSet; master: number; ui: number; results: number }

const PACKED: Record<Pack, Record<string, string>> = { 'snd-sine': sine, 'snd-piano': piano, jc, haeldb };

let cfg: SoundConfig = { on: true, set: DEFAULT_SET, master: 0.6, ui: 0.5, results: 0.7 };
let ctx: AudioContext | null = null;
let bus: Bus | null = null;
const lastPlayed = new Map<SoundName, number>();
const lastTake = new Map<string, number>();
const voices = new Voices<GainNode>(BUS.voices);

/** A file's first play that waits for it to decode is left out after this many seconds. */
const LATE = 0.08;

/** A decoded recording, and the part of it that plays, in seconds. */
interface Take { buf: AudioBuffer; from: number; len: number }
/** Each context's recordings by file: a promise while decoding, then the take, or null when the browser couldn't decode it. */
const decoding = new WeakMap<BaseAudioContext, Map<string, Promise<Take | null>>>();
const decoded = new WeakMap<BaseAudioContext, Map<string, Take | null>>();

/** A data URL's bytes, read without a fetch. */
function bytesOf(url: string): ArrayBuffer {
  const bin = atob(url.slice(url.indexOf(',') + 1)), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Decodes one recording for a context, once. */
function decode(ac: BaseAudioContext, file: string): Promise<Take | null> {
  let started = decoding.get(ac);
  if (!started) { started = new Map(); decoding.set(ac, started); decoded.set(ac, new Map()); }
  const had = started.get(file);
  if (had) return had;
  const done = (async () => {
    try {
      const [pack, name] = file.split('/') as [Pack, string];
      const url = PACKED[pack]?.[name];
      if (!url) throw new Error(`No recording called ${file}`);
      const buf = await ac.decodeAudioData(bytesOf(url));
      const { from, to } = spanOf(buf.getChannelData(0), buf.sampleRate);
      return { buf, from: from / buf.sampleRate, len: (to - from) / buf.sampleRate };
    } catch {
      return null;
    }
  })().then((t) => { decoded.get(ac)!.set(file, t); return t; });
  started.set(file, done);
  return done;
}

/** Decodes every recording of a set for a context. */
const decodeSet = (ac: BaseAudioContext, set: SoundSet) => Promise.all(filesOf(set).map((f) => decode(ac, f)));

export function configureSound(c: SoundConfig) {
  cfg = c;
  // a set chosen after the first sound gets ready before its first play
  if (ctx && c.on) void decodeSet(ctx, c.set);
}

function audio(): AudioContext | null {
  if (!cfg.on) return null;
  // before the first click or key press the browser won't start a sound, and warns about trying
  // (the welcome dialog opens with the page); browsers that can't tell try anyway
  if (!ctx && (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === false) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const made = new AC({ latencyHint: 'interactive' });
      ctx = made;
      bus = makeBus(made, made.destination);
      void decodeSet(made, cfg.set);
      // nothing plays while the tab is hidden; the next sound wakes it
      document.addEventListener('visibilitychange', () => { if (document.hidden && made.state === 'running') made.suspend().catch(() => {}); });
    }
    // resuming waits for a click; leaving the page first rejects it, which is fine
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Where each cue goes: `dry` straight out, `room` through the shared room first. */
interface Bus { dry: AudioNode; room: AudioNode }

/** A context's way out: the room feeds the high-pass and the limiter with everything else. */
function makeBus(ac: BaseAudioContext, dest: AudioNode): Bus {
  const dry = ac.createGain();
  const high = ac.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = BUS.highpass;
  high.Q.value = -3.01; // in dB for a high-pass: the flattest there is, with no bump
  dry.gain.value = BUS.level;
  // the limiter: scaled into the curve's range, then the curve gives back the level to play
  const into = ac.createGain(), limit = ac.createWaveShaper();
  into.gain.value = 1 / BUS.limiter.range;
  limit.curve = limiterCurve();
  dry.connect(high).connect(into).connect(limit).connect(dest);
  const room = ac.createConvolver();
  room.normalize = false; // roomImpulse is already at unit energy, so WET is its share
  const ir = roomImpulse(ac.sampleRate), buf = ac.createBuffer(ir.length, ir[0]!.length, ac.sampleRate);
  ir.forEach((ch, i) => buf.getChannelData(i).set(ch));
  room.buffer = buf;
  room.connect(dry);
  return { dry, room };
}

/** A cue's own way into the bus, at its volume, with its share of the room. */
function input(ac: BaseAudioContext, b: Bus, vol: number, wet: number): { gain: GainNode; send: GainNode } {
  const gain = ac.createGain(), send = ac.createGain();
  gain.gain.value = vol;
  send.gain.value = wet;
  gain.connect(b.dry);
  gain.connect(send).connect(b.room);
  return { gain, send };
}

/** How long a play of a take lasts, in seconds, at its speed. */
const lengthOf = (p: TakePlan, t: Take) => t.len / p.rate;

/** Schedules a recording into `out` at time `at`: up in a millisecond, then faded at its end. Gives back its source and when it ends. */
function playTake(ac: BaseAudioContext, out: AudioNode, p: TakePlan, t: Take, at: number): { end: number; last: AudioScheduledSourceNode } {
  const src = ac.createBufferSource(), env = ac.createGain();
  src.buffer = t.buf;
  src.playbackRate.value = p.rate;
  const len = lengthOf(p, t), fade = Math.max(at + 0.002, at + len - fadeOf(len));
  env.gain.value = 0;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(p.gain, at + 0.001);
  env.gain.setValueAtTime(p.gain, fade);
  env.gain.linearRampToValueAtTime(0, at + len);
  src.connect(env).connect(out);
  src.start(at, t.from);
  src.stop(at + len + 0.002);
  return { end: at + len + 0.002, last: src };
}

/** Plays a take now through the bus at volume `vol`, as one of the voices. */
function start(ac: BaseAudioContext, b: Bus, p: TakePlan, t: Take, vol: number) {
  // each sound gets its own volume, so overlapping sounds of different kinds don't affect each other
  const { gain, send } = input(ac, b, vol, p.wet);
  const { end, last } = playTake(ac, gain, p, t, ac.currentTime + 0.005);
  last.onended = () => { gain.disconnect(); send.disconnect(); };
  for (const old of voices.add(gain, end + ROOM.length, ac.currentTime)) {
    old.gain.cancelScheduledValues(ac.currentTime);
    old.gain.setValueAtTime(old.gain.value, ac.currentTime);
    old.gain.linearRampToValueAtTime(0, ac.currentTime + 0.012);
  }
}

/**
 * Plays a sound. Call it in the same moment as the change it goes with, never after a timer or the
 * end of a motion. `set` plays it from a set other than the one in use (the Settings preview).
 */
export function play(name: SoundName, o: { set?: SoundSet } = {}): void {
  const kind = SOUNDS[name];
  const vol = cfg.master * cfg[kind];
  // a hidden tab stays quiet: a plan that finishes there has no change on screen to go with
  if (!cfg.on || vol <= 0.001 || document.hidden) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < BUS.guard * 1000) return; // a double click shouldn't double the sound
  lastPlayed.set(name, now);
  const ac = audio();
  if (!ac || !bus) return;
  const set = o.set ?? cfg.set, b = bus;
  const p = takePlan(name, set, Math.random, { avoid: lastTake.get(`${set}/${name}`) ?? -1 });
  lastTake.set(`${set}/${name}`, p.variant);
  const ready = decoded.get(ac)?.get(p.file);
  if (ready) return start(ac, b, p, ready, vol);
  if (ready === null) return; // this browser couldn't decode it
  const asked = ac.currentTime;
  void decode(ac, p.file).then((t) => { if (t && ac.currentTime - asked <= LATE) start(ac, b, p, t, vol); });
}

/** The rate cues are drawn at when they aren't played. */
const DRAW_RATE = 48000;
/** A context that only decodes the recordings for drawing. */
let drawer: OfflineAudioContext | null = null;

/**
 * A cue drawn without playing it, through the same bus at full volume: take `variant` (or one
 * picked by `seed`), varied by `seed`. `weigh` hears it the way a loudness meter does (low notes
 * count for less, the middle and top for a little more). `times` plays it again at each of those
 * seconds, a new take each time, to hear how overlaps add up.
 */
export async function renderCue(name: SoundName, set: SoundSet, o: { seed?: number; variant?: number; channels?: number; weigh?: boolean; times?: readonly number[] } = {}): Promise<AudioBuffer> {
  const rnd = seededRng(o.seed ?? 1), times = o.times ?? [0];
  const plays: TakePlan[] = [];
  while (plays.length < times.length) plays.push(takePlan(name, set, rnd, o.variant === undefined ? { avoid: plays.length ? plays.at(-1)!.variant : -1 } : { variant: o.variant }));
  const dec = drawer ??= new OfflineAudioContext(1, 1, DRAW_RATE);
  const takes = await Promise.all(plays.map((p) => decode(dec, p.file)));
  const longest = Math.max(0, ...plays.map((p, i) => (takes[i] ? lengthOf(p, takes[i]) : 0)));
  const ac = new OfflineAudioContext(o.channels ?? 1, Math.ceil((Math.max(...times) + longest + ROOM.length + 0.05) * DRAW_RATE), DRAW_RATE);
  let dest: AudioNode = ac.destination;
  if (o.weigh) {
    const low = ac.createBiquadFilter(), high = ac.createBiquadFilter();
    low.type = 'highpass'; low.frequency.value = 100; low.Q.value = 0.5;
    high.type = 'highshelf'; high.frequency.value = 1500; high.gain.value = 4;
    low.connect(high).connect(ac.destination);
    dest = low;
  }
  const { gain } = input(ac, makeBus(ac, dest), 1, WET);
  plays.forEach((p, i) => { const t = takes[i]; if (t) playTake(ac, gain, p, t, times[i]!); });
  return ac.startRendering();
}

/**
 * How loud a sound of a set is, drawn without playing it: its peak, its loudest stretch of 50 ms
 * (as root mean square, heard the way loudness meters hear) and how long it lasts before it's 50 dB
 * under its peak, in ms. For the level check on the sound gallery and its test. `variant` measures
 * one take; without it, the first.
 */
export async function measure(name: SoundName, set: SoundSet, variant = 0): Promise<{ peak: number; loud: number; length: number }> {
  const d = (await renderCue(name, set, { weigh: true, variant })).getChannelData(0);
  const win = Math.round(DRAW_RATE * 0.05);
  let peak = 0, sum = 0, loud = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i]!;
    peak = Math.max(peak, Math.abs(x));
    sum += x * x;
    if (i >= win) { const y = d[i - win]!; sum -= y * y; }
    if (i >= win - 1) loud = Math.max(loud, Math.sqrt(Math.max(0, sum) / win));
  }
  let end = d.length - 1;
  while (end > 0 && Math.abs(d[end]!) < peak * 10 ** (-50 / 20)) end--;
  return { peak, loud, length: Math.round((end / DRAW_RATE) * 1000) };
}

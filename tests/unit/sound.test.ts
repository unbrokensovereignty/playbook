// The sounds, checked against what makes interface sounds feel cheap: the same sound byte for byte
// every time, a click where a sound starts or stops, a ring that outstays the click it belongs to,
// every cue as loud as the next, no room at all, and sound that comes late after the motion it goes
// with. The tables come from src/ui/cues.ts, the same ones sound.ts plays. How loud and how long
// each cue is when the browser draws it is checked in tests/e2e/sound.spec.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  allFiles, BUS, DEFAULT_SET, fadeOf, filesOf, FREQUENT, levelOf, limiterCurve, OFFSET, PACKS, ROOM, roomImpulse, SETS, SOUND_SETS, SOUNDS,
  spanOf, takePlan, takesOf, TARGET, targetOf, TRIM, VARY, Voices, WET,
  type SoundName,
} from '../../src/ui/cues.ts';
import { SETTINGS } from '../../src/core/settings.ts';
import { seededRng } from '../../src/core/util.ts';

const NAMES = Object.keys(SOUNDS) as SoundName[];
const dB = (x: number) => 20 * Math.log10(x);
const ASSETS = resolve(import.meta.dirname, '../../assets/sounds');
const shipped = PACKS.flatMap((p) => readdirSync(join(ASSETS, p)).map((f) => `${p}/${f}`));

test('the sets are Clarity, Felt and Beacon, and Settings offers each one', () => {
  assert.deepEqual(SOUND_SETS, ['clarity', 'felt', 'beacon']);
  assert.equal(DEFAULT_SET, 'clarity');
  assert.equal(SETTINGS.soundSet.def, DEFAULT_SET);
  assert.deepEqual(SETTINGS.soundSet.options.map(([id]) => id), [...SOUND_SETS]);
});

test('every cue of every set plays files that are there, and every file shipped is played', () => {
  for (const set of SOUND_SETS) for (const name of NAMES) assert.ok(SETS[set][name].length >= 1, `${set} ${name} has a recording`);
  const there = new Set(shipped.map((f) => f.replace(/\.mp3$/, '')));
  for (const f of allFiles()) assert.ok(there.has(f), `${f}.mp3 is in assets/sounds`);
  for (const f of shipped) assert.ok(allFiles().includes(f.replace(/\.mp3$/, '')), `${f} is played by a cue`);
  for (const f of shipped) assert.match(f, /^[\w-]+\/[\w-]+\.mp3$/, `${f} is an MP3, which every browser decodes`);
  // Clarity is SND Sine but for the three clicks heard most, which are JC Sounds'
  for (const name of NAMES) {
    const packs = new Set(SETS.clarity[name].map(([f]) => f.split('/')[0]));
    assert.deepEqual([...packs], [['tap', 'tick', 'toggle'].includes(name) ? 'jc' : 'snd-sine'], `clarity ${name}`);
    assert.ok(SETS.felt[name].every(([f]) => f.startsWith('snd-piano/')), `felt ${name}`);
    assert.ok(SETS.beacon[name].every(([f]) => f.startsWith('haeldb/')), `beacon ${name}`);
  }
});

test('the recordings are small and mono MP3s, and each one is credited', () => {
  const bytes = shipped.reduce((n, f) => n + statSync(join(ASSETS, f)).size, 0);
  assert.ok(Math.ceil(bytes / 3) * 4 < 520 * 1024, `the recordings take ${Math.round(bytes / 1024)} KB, ${Math.round((bytes / 3) * 4 / 1024)} KB in the file`);
  for (const f of shipped) {
    const b = readFileSync(join(ASSETS, f));
    const at = b.indexOf(Buffer.from([0xff]), b.subarray(0, 3).toString() === 'ID3' ? 10 + ((b[6]! << 21) | (b[7]! << 14) | (b[8]! << 7) | b[9]!) : 0);
    assert.equal(b[at + 1]! & 0xe0, 0xe0, `${f} starts with an MP3 frame`);
    assert.equal(b[at + 3]! >> 6, 3, `${f} is mono`);
  }
  const credits = readFileSync(join(ASSETS, 'CREDITS.md'), 'utf8');
  for (const f of shipped) assert.ok(credits.includes(f.split('/')[1]!), `${f} is in assets/sounds/CREDITS.md`);
  const help = readFileSync(resolve(import.meta.dirname, '../../src/ui/pages/help.tsx'), 'utf8');
  for (const who of [/JC Sounds/, /CC BY 4\.0/, /SND/, /HaelDB/]) assert.match(help, who, `Help → About names ${who.source}`);
  const license = readFileSync(resolve(import.meta.dirname, '../../LICENSE'), 'utf8');
  for (const who of [/JC Sounds/, /CC BY 4\.0/, /SND/, /HaelDB/]) assert.match(license, who, `LICENSE names ${who.source}`);
});

test('each file is levelled by its peak: the frequent clicks lowest, then remove, undo and error, then the results', () => {
  assert.ok(TARGET.frequent < TARGET.alert && TARGET.alert < TARGET.news);
  for (const name of NAMES) {
    const want = SOUNDS[name] === 'results' ? TARGET.news : FREQUENT.includes(name) ? TARGET.frequent : TARGET.alert;
    assert.equal(targetOf(name), want, name);
  }
  for (const set of SOUND_SETS) {
    assert.ok(OFFSET[set] <= 0 && OFFSET[set] >= -24, `${set} is turned down by ${-OFFSET[set]} dB`);
    for (const name of NAMES) for (const [f, peak] of SETS[set][name]) {
      assert.ok(peak < 0 && peak > -30, `${f}: a peak of ${peak} dB`);
      const at = peak + levelOf(name, set, peak);
      // the peak lands on the cue's target, short of the most a quiet file may be turned up
      assert.ok(at <= targetOf(name) + OFFSET[set] + 1e-9, `${set} ${name} ${f} peaks at ${at.toFixed(1)} dB`);
      assert.ok(at + dB(BUS.level) <= -6, `${set} ${name} ${f} leaves too little headroom`);
    }
  }
  // the sets sit close together, so changing set doesn't change the volume much
  assert.ok(Math.max(...Object.values(OFFSET)) - Math.min(...Object.values(OFFSET)) <= 6);
});

test('no play repeats the take before it, and every take comes up', () => {
  const rnd = seededRng(11);
  for (const set of SOUND_SETS) for (const name of NAMES) {
    let last = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const p = takePlan(name, set, rnd, { avoid: last });
      if (takesOf(name, set) > 1) assert.notEqual(p.variant, last, `${set} ${name} played take ${last + 1} twice running`);
      assert.equal(p.file, SETS[set][name][p.variant]![0]);
      seen.add(p.variant);
      last = p.variant;
    }
    assert.equal(seen.size, takesOf(name, set), `${set} ${name} plays all its takes`);
  }
});

test('each play moves a little: pitch within 12 cents, level within 1 dB, never the same twice', () => {
  const rnd = seededRng(5);
  for (const set of SOUND_SETS) for (const name of NAMES) {
    const rates = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const p = takePlan(name, set, rnd, { variant: 0 }), exact = takePlan(name, set, rnd, { variant: 0, exact: true });
      const c = 1200 * Math.log2(p.rate), g = dB(p.gain / exact.gain);
      assert.ok(Math.abs(c) <= VARY.cents, `${set} ${name} moved ${c.toFixed(1)} cents`);
      assert.ok(Math.abs(g) <= VARY.dB + 1e-9, `${set} ${name} moved ${g.toFixed(2)} dB`);
      assert.equal(exact.rate, 1);
      assert.equal(p.wet, WET);
      rates.add(p.rate);
    }
    assert.ok(rates.size > 35, `${set} ${name} varies from play to play`);
  }
});

test('a recording plays from just before its first sound to where it has died away', () => {
  const rate = 48000, d = new Float32Array(rate);
  // 100 ms of silence, a 200 ms tone dying away, then silence
  for (let i = 0; i < rate * 0.2; i++) d[rate * 0.1 + i] = 0.5 * Math.exp(-i / (rate * 0.02)) * Math.sin(i * 0.3);
  const { from, to } = spanOf(d, rate);
  assert.ok(Math.abs(from / rate - (0.1 - TRIM.pre)) < 0.001, `starts at ${(from / rate * 1000).toFixed(1)} ms`);
  assert.ok(to / rate > 0.2 && to / rate <= 0.3, `stops at ${(to / rate * 1000).toFixed(0)} ms`);
  assert.deepEqual(spanOf(new Float32Array(100), rate), { from: 0, to: 0 }, 'a silent file plays nothing');
  assert.equal(fadeOf(0.3), TRIM.fade);
  assert.equal(fadeOf(2), TRIM.longFade, 'a long tail cut short in the file fades for longer');
  assert.ok(fadeOf(0.01) <= 0.005, 'a fade never takes more than half a play');
});

test('one short room, mixed in a little', () => {
  assert.ok(ROOM.length >= 0.08 && ROOM.length <= 0.25, `the room lasts ${ROOM.length} s`);
  assert.ok(WET >= 0.05 && WET <= 0.15, `${WET * 100}% wet`);
  const ir = roomImpulse(48000);
  assert.equal(ir.length, 2);
  for (const ch of ir) {
    assert.equal(ch.length, Math.round(ROOM.length * 48000));
    let all = 0, late = 0;
    ch.forEach((s, i) => { all += s * s; if (i > ch.length * 0.6) late += s * s; });
    assert.ok(Math.abs(all - 1) < 1e-3, 'unit energy');
    assert.ok(late / all < 0.01, 'the tail dies away');
    assert.ok(Math.abs(ch[ch.length - 1]!) < 1e-9, 'the tail ends in silence');
  }
});

test('overlaps are capped and limited', () => {
  assert.ok(BUS.highpass >= 100 && BUS.highpass <= 150, `the bus high-pass is at ${BUS.highpass} Hz`);
  const c = limiterCurve(), { range } = BUS.limiter, at = (x: number) => c[Math.round(((x + range) / (2 * range)) * (c.length - 1))]!;
  assert.ok(Math.abs(at(0.3) - 0.3) < 0.003 && Math.abs(at(-0.45) + 0.45) < 0.003, 'quiet sounds pass untouched');
  assert.ok(Math.max(...c) < 0.95 && Math.min(...c) > -0.95, 'nothing passes -0.5 dBFS');
  for (let i = 1; i < c.length; i++) assert.ok(c[i]! >= c[i - 1]!, 'the curve only rises');
  assert.ok(at(1) > 0.8 && at(2) > at(1), 'a louder overlap is still louder');
  assert.ok(BUS.voices >= 4 && BUS.voices <= 8);
  assert.equal(BUS.guard, 0.045);
  const v = new Voices<string>(3);
  assert.deepEqual(v.add('a', 1, 0), []);
  assert.deepEqual(v.add('b', 1, 0), []);
  assert.deepEqual(v.add('c', 1, 0), []);
  assert.deepEqual(v.add('d', 1, 0.1), ['a'], 'the oldest goes');
  assert.deepEqual(v.add('e', 2, 1.5), [], 'the ones that ended are gone');
  assert.equal(v.size, 1);
});

const sound = readFileSync(resolve(import.meta.dirname, '../../src/ui/sound.ts'), 'utf8');

test('sound.ts plays the tables through the shared bus', () => {
  for (const node of ['createConvolver', 'createBiquadFilter', 'createWaveShaper', 'createBufferSource']) {
    assert.match(sound, new RegExp(`${node}\\(`), `sound.ts uses ${node}`);
  }
  assert.match(sound, /BUS\.highpass/, 'the bus high-pass');
  assert.match(sound, /limiterCurve\(\)/, 'the bus limiter');
  assert.match(sound, /BUS\.level/, 'the bus level');
  assert.match(sound, /new Voices/, 'a cap on voices');
  assert.match(sound, /roomImpulse\(/, 'the shared room');
  assert.match(sound, /takePlan\(/, 'the tables from cues.ts');
  assert.match(sound, /spanOf\(/, 'trims each recording');
  assert.doesNotMatch(sound, /44100/, 'buffers follow the context’s own sample rate');
  assert.doesNotMatch(sound, /exponentialRampToValueAtTime\(\s*0\s*[,)]/, 'a curve to zero throws');
  assert.doesNotMatch(sound, /Math\.random\(\)\s*\*\s*(0?\.[3-9]|[1-9])/, 'no wide random pitch');
});

test('the audio context starts inside a click or key press, and only once', () => {
  const top = sound.replace(/\{[^{}]*\}/g, '').replace(/\{[^{}]*\}/g, '').replace(/\{[^{}]*\}/g, '');
  assert.doesNotMatch(top, /new\s+(window\.)?\w*AudioContext\(/, 'no context at the top level');
  assert.equal(sound.match(/new AC\(/g)?.length, 1, 'one place makes the context');
  assert.match(sound, /userActivation/, 'waits for the first click or key press');
  assert.match(sound, /\.resume\(\)/, 'resumes a suspended context');
  assert.match(sound, /visibilitychange/, 'goes quiet while the tab is hidden');
});

test('the recordings are built into the file and decoded without a fetch', () => {
  for (const p of PACKS) assert.match(sound, new RegExp(`from 'assets:sounds/${p}'`), `sound.ts takes in ${p}`);
  assert.match(sound, /decodeAudioData\(/);
  assert.doesNotMatch(sound, /\bfetch\(|XMLHttpRequest|new Audio\(/);
  const build = readFileSync(resolve(import.meta.dirname, '../../tools/build.mjs'), 'utf8');
  assert.match(build, /'\.mp3': 'audio\/mpeg'/);
  // each set decodes only its own files
  for (const set of SOUND_SETS) assert.ok(filesOf(set).length < allFiles().length, `${set} decodes ${filesOf(set).length} files`);
});

/** Every .ts and .tsx file under a folder. */
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
});

test('every sound plays in the same moment as the change it goes with', () => {
  const ui = resolve(import.meta.dirname, '../../src/ui');
  for (const f of files(ui)) {
    const text = readFileSync(f, 'utf8');
    if (!/\bplay\(/.test(text) || f.endsWith('sound.ts')) continue;
    assert.doesNotMatch(text, /(setTimeout|requestAnimationFrame|transitionend|animationend|onfinish|\.finished\.then)[\s\S]{0,80}\bplay\(\s*'/, `${f}: a sound waits for a timer or the end of a motion`);
    assert.doesNotMatch(text, /on(MouseEnter|PointerEnter|MouseOver|Focus|Scroll)=\{[^}]*\bplay\(/, `${f}: a sound on hover, focus or scroll`);
  }
});

test('every sound is played somewhere in the app', () => {
  const ui = resolve(import.meta.dirname, '../../src/ui');
  const heard = new Set<string>();
  for (const f of files(ui)) {
    // the gallery plays every sound by name, so it says nothing about the app
    if (/[\\/](sound|cues)\.ts$|[\\/]gallery\.tsx$/.test(f)) continue;
    const text = readFileSync(f, 'utf8');
    // play('x'), play(a ? 'x' : 'y'), sound="x" and sound={a ? 'x' : 'y'}
    for (const m of text.matchAll(/\bplay\(([^)]*)\)|\bsound=(?:"(\w+)"|\{([^}]*)\})/g)) {
      if (m[2]) heard.add(m[2]);
      for (const w of (m[1] ?? m[3] ?? '').matchAll(/'(\w+)'/g)) heard.add(w[1]!);
    }
  }
  for (const name of NAMES) assert.ok(heard.has(name), `${name} is never played`);
});

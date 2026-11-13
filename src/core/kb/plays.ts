/**
 * Plays for every map: attack hits, splits and fakes, defense setups and retakes, and pistol-round,
 * eco and anti-eco plays for each side. A play names jobs, not agents ("smoke",
 * "entry"), so it fits any comp: the planner shares the jobs out among the comp's agents so the play
 * fits it as well as it can (see engine/plays.ts).
 *
 * Each step is written as `jobs: route | what to do`:
 * - jobs: one or two of the JOBS below; every play has five, one per player. `@early`, `@hit` or
 *   `@late` after them sets the step's moment when its jobs and words don't say it (see whenOf).
 * - route: callouts joined by ` > `, from where the player starts to where they end up. One
 *   callout is a spot to hold. Names are the game's own callouts for the map (see maps.ts).
 * - what to do: one plain sentence. The callouts it names are where the step's utility lands
 *   (see landsOf), so a smoke step says what it smokes.
 * - optionally ` | callouts`, joined by `, `: where the utility lands, when the sentence alone would
 *   put it in the wrong place. For a wall, the first is what it runs down or across.
 * A typo in a job or a callout throws, so a bad edit fails the tests.
 */
import { mapById, type Side, type SiteId } from './maps.ts';
import { escapeRegExp } from '../text.ts';

export const JOBS = ['smoke', 'wall', 'flash', 'recon', 'entry', 'clear', 'anchor', 'stall', 'flank', 'lurk', 'postplant', 'retake', 'duel'] as const;
export type Job = (typeof JOBS)[number];
const isJob = (v: string): v is Job => (JOBS as readonly string[]).includes(v);

/**
 * The kinds of play. On defense, a site's `stack` puts extra players on it, `push` takes an early
 * fight in front of it, and `fallback` gives it up lightly to win it back with a retake.
 */
export type PlayKind = 'hit' | 'split' | 'fake' | 'default' | 'setup' | 'stack' | 'push' | 'fallback' | 'retake' | 'pistol' | 'eco' | 'antieco';
export const PLAY_KINDS: readonly PlayKind[] = ['hit', 'split', 'fake', 'default', 'setup', 'stack', 'push', 'fallback', 'retake', 'pistol', 'eco', 'antieco'];
export const KIND_NAMES: Record<PlayKind, string> = { hit: 'Hit', split: 'Split', fake: 'Fake', default: 'Default', setup: 'Setup', stack: 'Stack', push: 'Push', fallback: 'Retake setup', retake: 'Retake', pistol: 'Pistol', eco: 'Eco', antieco: 'Anti-eco' };
/** The kinds each side plays. */
export const SIDE_KINDS: Record<Side, readonly PlayKind[]> = {
  attack: ['hit', 'split', 'fake', 'default', 'pistol', 'eco', 'antieco'],
  defense: ['setup', 'stack', 'push', 'fallback', 'retake', 'pistol', 'eco', 'antieco'],
};

/**
 * How much teamwork a play asks for, from 1 to 4: what a team has to time, call and trust each other
 * on to run it as written (demandOf works it out from the play's steps). The engine weighs it by
 * rank (PLAY_RANK in engine/weights.ts).
 */
export type Demand = 1 | 2 | 3 | 4;
export const DEMANDS: Record<Demand, { name: string; about: string }> = {
  1: { name: 'Simple', about: 'with one plan the whole team plays together and little to time' },
  2: { name: 'Standard', about: 'with utility thrown together for one hit or one hold' },
  3: { name: 'Coordinated', about: 'with groups timed with each other, or a call in the middle of the round' },
  4: { name: 'Read and react', about: 'since the plan changes on what the team finds out, and everyone has to hear and trust the call' },
};

/**
 * Plays for one kind of round, listed apart from the rest: the pistol round of each half, a save
 * (an eco), and a round against a team that saves (an anti-eco).
 */
export const isRoundPlay = (k: PlayKind): boolean => k === 'pistol' || k === 'eco' || k === 'antieco';

export type RoundKind = 'pistol' | 'eco' | 'force' | 'full' | 'antieco';
/** What to buy and how to play in each kind of round, from the first round of a half to a full buy, and against a team that saves. */
export const BUY_GUIDE: readonly { id: RoundKind; name: string; text: string }[] = [
  { id: 'pistol', name: 'Pistol round', text: 'The first round of each half, with only a few credits each. Buy light shields or an ability or two on top of your free signature ability, or a better pistol. With no rifles about, numbers win fights, so stay together and trade.' },
  { id: 'eco', name: 'Eco round', text: 'After a lost round, when the team can’t afford rifles and shields together, spend little or nothing so the next round is a full buy. Play close angles, where a pistol or a cheap shotgun can beat a rifle, trade every kill, and take the rifle of anyone you kill. On attack, planting the Spike earns every attacker credits, even in a lost round.' },
  { id: 'force', name: 'Force buy', text: 'When a round matters more than the credits, like when the other team is about to pull away or late in a half, everyone buys the best they can afford together (SMGs, shotguns, cheaper rifles and light shields), so no one plays half bought. Play close and together.' },
  { id: 'full', name: 'Full buy', text: 'Rifles, full shields and all your abilities, and an Operator for the player who plays one. If you have plenty, buy for a teammate who’s short, so the whole team is bought.' },
  { id: 'antieco', name: 'Anti-eco round', text: 'When the other team saves after losing a round, you have the better guns and they have the close corners, where a shotgun or a pistol can beat a rifle. Everyone buys, so no one plays the round with a pistol. Check each close corner with utility or information before you walk past it, don’t peek alone or chase a kill, and stay close enough to trade. Every rifle you lose is one they keep for the next round.' },
];
/** A kind of play by its name: a round's ("Pistol round") or the kind's own ("Hit"). */
export const kindName = (k: PlayKind): string => (isRoundPlay(k) ? BUY_GUIDE.find((r) => r.id === k)!.name : KIND_NAMES[k]);

/**
 * When in the round a step happens, so a play can run in order like a replay: before the hit, on
 * it, or after the plant (or the same moments of a defense: early, when they hit, on the retake).
 */
export const MOMENTS = ['early', 'hit', 'late'] as const;
export type Moment = (typeof MOMENTS)[number];
export const isMoment = (v: unknown): v is Moment => (MOMENTS as readonly unknown[]).includes(v);

/** The round's clock, in seconds: the time to play a round, the Spike's timer once planted, and a full defuse. */
export const ROUND = { length: 100, spike: 45, defuse: 7 } as const;

/** What each moment is called, for a play of a kind on a side. */
export function momentName(p: { side: Side; kind: PlayKind }, m: Moment): string {
  if (p.side === 'attack') return { early: 'Before the hit', hit: 'On the hit', late: 'After the plant' }[m];
  if (p.kind === 'retake') return { early: 'Before the retake', hit: 'On the retake', late: 'After the retake' }[m];
  return { early: 'Early in the round', hit: 'When they hit', late: 'On the retake' }[m];
}

export interface PlayStep {
  jobs: Job[];
  route: string[];
  text: string;
  when: Moment;
  /** Where the step's utility lands (callouts), in the order thrown. */
  on: string[];
  /** For a wall: the lane or site it runs down or across (a callout), when the step has one. */
  lane?: string;
}

export interface Play {
  id: string;
  map: string;
  side: Side;
  /** The site it's about, or null for a play that covers the whole map (a default, a setup). */
  site: SiteId | null;
  kind: PlayKind;
  name: string;
  about: string;
  steps: PlayStep[];
  /** Set on a play whose plan changes on what the team finds out (it asks for the most teamwork, see demandOf). */
  reads?: true;
  /**
   * Set on one branch of a play that reads and reacts: the plays sharing its name are its branches,
   * one for each thing the team can find out (`if`, "B is empty"), each with its own steps.
   */
  branch?: { if: string };
  /** Set on a play you drew yourself (core/saved.ts), which can have fewer than five jobs. */
  mine?: true;
}

/** The jobs that throw something worth drawing where it lands. */
export const THROWN: readonly Job[] = ['smoke', 'wall', 'flash', 'recon', 'clear'];

const isSpawnName = (c: string) => / Side Spawn$/.test(c);

/**
 * The callouts a sentence names, in order, leaving out spawns and anything it says to leave open.
 * "The site" (and "the plant") is `site`'s own callout. A name right after "from" is where the
 * player stands, not a target, so it's left out unless `from` is set.
 */
export function namedIn(text: string, map: string, site: SiteId | null, from = false): string[] {
  const info = mapById(map);
  if (!info) return [];
  const siteName = site && info.callouts.some((c) => c.name === `${site} Site`) ? `${site} Site` : undefined;
  let rest = text.replace(/\bleave .*$/i, '');
  const hits: { at: number; name: string }[] = [];
  // longest names first, each blanked once found, so "B Main" isn't found again inside "B Main Hall"
  for (const name of info.callouts.map((c) => c.name).filter((n) => !isSpawnName(n)).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(name)})(?![A-Za-z])`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      const at = m.index + m[1]!.length;
      if (from || !/\bfrom $/i.test(rest.slice(0, at))) hits.push({ at, name });
      rest = rest.slice(0, at) + ' '.repeat(name.length) + rest.slice(at + name.length);
    }
  }
  if (siteName) for (const m of rest.matchAll(/\bthe (site|plant)\b/gi)) hits.push({ at: m.index!, name: siteName });
  return [...new Set(hits.sort((a, b) => a.at - b.at).map((h) => h.name))];
}

/**
 * Where a step's utility lands, from its sentence: the callouts it names, except where the player
 * walks (a smoke never goes on its own way in) or, for flashes, information and clearing, where
 * they start. A wall runs down or across the lane it names ("Wall down A Main", "Wall the site"),
 * and what it cuts off are its targets. `written` (the step's optional last part) overrides it.
 */
export function landsOf(jobs: readonly Job[], route: readonly string[], text: string, map: string, site: SiteId | null, written?: readonly string[]): { on: string[]; lane?: string } {
  const routeSite = [...route].reverse().find((c) => / Site$/.test(c))?.charAt(0) as SiteId | undefined;
  const named = namedIn(text, map, site ?? routeSite ?? null);
  if (jobs.includes('wall')) {
    const [lane, ...on] = written ?? [];
    if (lane) return { on, lane };
    const laneAt = /\b(?:[Dd]own|[Aa]cross|[Aa]long|[Tt]hrough|[Ii]nto|[Ww]all)\s+(?:the site|the plant|[A-Z])/.exec(text);
    const after = laneAt ? namedIn(text.slice(laneAt.index), map, site ?? routeSite ?? null) : [];
    const theLane = after[0];
    return { on: named.filter((c) => c !== theLane && !route.includes(c)), ...(theLane ? { lane: theLane } : {}) };
  }
  if (written) return { on: [...written] };
  if (!jobs.some((j) => THROWN.includes(j))) return { on: [] };
  // a smoke goes on a site only at its back ("the back of B Site"): "once the site is taken" isn't where it lands
  const back = (c: string) => !/ Site$/.test(c) || new RegExp(`back of (the site|${escapeRegExp(c)})`).test(text);
  if (jobs.includes('smoke')) return { on: named.filter((c) => !route.includes(c) && back(c)) };
  // a flash, information or clearing with no target named goes where the player is heading
  const on = named.filter((c) => c !== route[0] || route.length === 1);
  return { on: on.length || route.length < 2 ? on : [route[route.length - 1]!] };
}

/**
 * A step's moment, from its jobs and words, unless it's written. On attack, information, lurks and
 * flank watch come before the hit, the post-plant after it and everything else on it; on defense
 * the setup comes early and the retake late, and in a retake its utility goes first. Words such
 * as "as the hit starts" or "early" move a step to that moment.
 */
export function whenOf(side: Side, kind: PlayKind, jobs: readonly Job[], text: string): Moment {
  const onHit = /\b(as the (main group|team|hit|rest)|when the (hit|main group)|the moment|at the same time|as (they|the team) (hit|arrive))/i.test(text);
  const early = /\bearly\b|\bbefore (anyone|the (hit|push|team|entry|rotation))\b/i.test(text);
  if (side === 'attack') {
    if (jobs.includes('postplant') || /\b(hold|after) the plant\b/i.test(text)) return 'late';
    const before = jobs.every((j) => j === 'recon' || j === 'lurk' || j === 'flank');
    return before ? (onHit ? 'hit' : 'early') : early ? 'early' : 'hit';
  }
  if (kind === 'retake') return jobs.every((j) => j === 'smoke' || j === 'recon') && !onHit ? 'early' : 'hit';
  if (jobs.includes('retake')) return 'late';
  return onHit ? 'hit' : 'early';
}

/** Most pieces of utility a hit can ask to land together before it's more than a simple plan. */
const TOGETHER = 2;
/** The jobs of players who go in on a hit or a retake (the rest throw from behind or hold). */
const GOES_IN: readonly Job[] = ['entry', 'duel', 'lurk', 'clear', 'retake', 'flash'];

/**
 * How much teamwork a play asks for (DEMANDS), and what makes it so, in words to follow "Needs": its
 * steps say it. A play is simple when the team plays one plan together with little utility to land at
 * once. It asks for more with each of these: more than TOGETHER pieces of utility landing on the hit
 * (or on the retake), two groups arriving from different ways at the same moment, a lurk timed with
 * the hit, a site given up on purpose, an early fight that has to be back in time, a call in the
 * middle of the round, and most of all a plan that changes on what the team finds out (`reads`).
 */
export function demandOf(p: Pick<Play, 'side' | 'kind' | 'steps' | 'reads'>): { level: Demand; needs: string[] } {
  const needs: string[] = [];
  const onHit = p.steps.filter((s) => s.when === 'hit');
  const thrown = onHit.reduce((n, s) => n + s.jobs.filter((j) => THROWN.includes(j)).length, 0);
  // the ways the players who go in arrive by: the last callout before the site, or where they end up
  const goesIn = (s: PlayStep) => s.route.length > 1 && s.jobs.some((j) => GOES_IN.includes(j));
  const way = (r: readonly string[]) => (/ Site$/.test(r[r.length - 1]!) ? r[r.length - 2]! : r[r.length - 1]!);
  const ways = new Set(onHit.filter(goesIn).map((s) => way(s.route)));
  if (p.reads) needs.push('a change of plan on what the team finds out');
  if (p.kind === 'default') needs.push('a call in the middle of the round on where to go');
  if (p.kind === 'fake') needs.push('a fake timed so the real hit comes as the defenders rotate');
  // an early fight in front of the sites (a push, or a setup that fights for mid first)
  const early = p.side === 'defense' && p.steps.some((s) => s.when === 'early' && s.jobs.includes('duel') && /\b(early|fall back)\b/i.test(s.text));
  if (p.kind === 'push' || early) needs.push('an early fight timed so the players who take it are traded and back before the hit');
  if (p.kind === 'fallback') needs.push('a site given up on purpose and won back together on a call');
  // (in a play that reads and reacts, the lurk holds for a pick or shows a site, and the read is the timing)
  if (!p.reads && p.steps.some((s) => s.jobs.includes('lurk'))) needs.push('a lurk timed with the hit');
  if (ways.size > 1) needs.push(`${ways.size === 2 ? 'two' : 'three'} groups arriving from different ways at the same moment`);
  const level: Demand = p.reads ? 4 : needs.length ? 3 : thrown > TOGETHER ? 2 : 1;
  if (thrown > TOGETHER) needs.push(`${thrown} pieces of utility landing together ${p.side === 'attack' ? 'on the hit' : 'at once'}`);
  return { level, needs };
}

function parseStep(line: string, map: string, side: Side, site: SiteId | null, kind: PlayKind, who: string): PlayStep {
  const m = /^([a-z ]+?)(?:@([a-z]+))?:\s*(.+?)\s*\|\s*([^|]+?)\s*(?:\|\s*(.+))?$/.exec(line);
  if (!m) throw new Error(`${who}: can't read the step "${line}"`);
  const jobs = m[1]!.trim().split(/\s+/);
  for (const j of jobs) if (!isJob(j)) throw new Error(`${who}: "${j}" isn't a job`);
  if (m[2] !== undefined && !isMoment(m[2])) throw new Error(`${who}: "${m[2]}" isn't a moment`);
  const info = mapById(map);
  if (!info) throw new Error(`${who}: no map "${map}"`);
  const has = (c: string) => info.callouts.some((x) => x.name === c);
  const route = m[3]!.split('>').map((s) => s.trim());
  for (const c of route) if (!has(c)) throw new Error(`${who}: ${info.name} has no callout "${c}"`);
  const written = m[5]?.split(',').map((s) => s.trim());
  for (const c of written ?? []) if (!has(c)) throw new Error(`${who}: ${info.name} has no callout "${c}"`);
  return stepOf(map, side, site, kind, jobs as Job[], route, m[4]!.trim(), m[2] as Moment | undefined, written);
}

/** A step from its parts, its moment (unless given) and where its utility lands worked out as for the built-in plays. */
export function stepOf(map: string, side: Side, site: SiteId | null, kind: PlayKind, jobs: Job[], route: string[], text: string, when?: Moment, written?: readonly string[]): PlayStep {
  return { jobs, route, text, when: when ?? whenOf(side, kind, jobs, text), ...landsOf(jobs, route, text, map, site, written) };
}

const ALL: Play[] = [];
/** "abyss-attack-a-hit-through-main": the same for as long as the play keeps its name. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function play(map: string, side: Side, site: SiteId | null, kind: PlayKind, name: string, about: string, steps: string[], branch?: string) {
  const who = `${map}: ${name}${branch ? ` (${branch})` : ''}`;
  const parsed = steps.map((s) => parseStep(s, map, side, site, kind, who));
  const jobs = parsed.reduce((n, s) => n + s.jobs.length, 0);
  if (jobs !== 5) throw new Error(`${who}: ${jobs} jobs (a play has one for each of five players)`);
  const id = `${map}-${side}-${slug(branch ? `${name} ${branch}` : name)}`;
  if (ALL.some((p) => p.id === id)) throw new Error(`${who}: two plays have this name`);
  if (!branch && ALL.some((p) => p.map === map && p.side === side && p.name === name)) throw new Error(`${who}: two plays have this name`);
  ALL.push({ id, map, side, site, kind, name, about, steps: parsed, ...(branch ? { reads: true as const, branch: { if: branch } } : {}) });
}

// shared shapes, so every map's retakes and mid fights read alike
const midControl = (map: string, fight: string, smoke: string, a = 'A', b = 'B') => play(map, 'defense', null, 'setup', 'Fight for mid', 'Win an early mid fight for information and a numbers lead, then fall back to the sites before the hit.', [
  `duel recon: ${fight} | Take an early fight in mid with information, then fall back before the hit comes.`,
  `smoke: ${smoke} | Smoke for the mid fight and stay ready to rotate to either site.`,
  `anchor: ${a} Site | Hold ${a} alone with your setup and call the hit early.`,
  `stall: ${b} Site | Hold ${b} alone and slow a rush until help arrives.`,
]);

// ---------------------------------------------------------------- Abyss

play('abyss', 'attack', 'A', 'hit', 'A hit through Main', 'Takes A in one go behind smokes and a wall, which works best with two controllers.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower and A Link from A Lobby, then A Security once the site is taken.',
  'wall: A Lobby > A Main | Wall down A Main to cut off A Tower and A Bridge while the team crosses.',
  'recon: A Lobby > A Main | Clear A Main and the back of the site with information before anyone peeks.',
  'entry flash: A Lobby > A Main > A Site | Flash over the wall and take the site together, checking A Secret first.',
]);
play('abyss', 'attack', 'A', 'split', 'A split through Main and Vent', 'Pinches A Tower from mid while the main group hits A Main, so defenders face two ways at once.', [
  'recon: Mid Bend > Mid Catwalk > A Vent | Take mid early with information and push up A Vent toward A Tower.',
  'lurk: Mid Bend > Mid Catwalk > A Vent > A Tower | Follow up A Vent and take A Tower as the main group hits.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Link and A Security so rotations arrive blind.',
  'entry flash: A Lobby > A Main > A Site | Hit A Main the moment A Tower is taken and trade each other onto the site.',
]);
play('abyss', 'attack', 'B', 'hit', 'B hit through Main', 'A straight B take with a wall to hide the plant from B Tower.', [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and B Link from B Lobby.',
  'wall: B Lobby > B Main | Wall the site from B Main so the plant is hidden from B Tower.',
  'flash: B Lobby > B Main | Flash B Danger and the site corners for the entry.',
  'entry: B Lobby > B Main > B Site | Clear B Danger on the way and take the site first.',
  'postplant: B Lobby > B Main > B Nest | Hold the plant from B Nest and B Main with lineups.',
]);
play('abyss', 'attack', 'B', 'split', 'B split through Main and mid', 'Mid players pinch B through B Link while the rest hit B Main.', [
  'recon lurk: Mid Bottom > Mid Library > B Link | Take mid, then pinch the site through B Link when the hit starts.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and the back of the site.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main as mid arrives and flash for each other.',
]);
play('abyss', 'attack', 'B', 'fake', 'Show A, hit B', 'Utility in A Main pulls defenders toward A, then the team hits B Main.', [
  'lurk: A Lobby > A Main | Make noise in A Main with utility to pull defenders toward A, then hold the flank.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and B Link once A has drawn attention.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main together as the rotation commits to A, checking B Danger on the way.',
  'postplant: B Lobby > B Main | Hold the plant from B Main with lineups.',
]);
play('abyss', 'attack', null, 'default', 'Default and take mid', 'Spreads out for information first, then hits whichever site mid shows is weak.', [
  'recon: Mid Bend > Mid Catwalk | Gather information on mid early and call where the defenders are thin.',
  'lurk: Mid Bottom > Mid Library | Hold Mid Library for picks and watch for a push from Mid Top.',
  'flank: A Lobby | Watch A Main and the spawn flank, and call any defender push.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit and place them where the mid information says.',
  'entry: B Lobby | Wait at B Lobby, ready to hit whichever site the information opens up.',
]);
play('abyss', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with a player in mid who tells the sites what is coming.', [
  'anchor: A Site | Anchor A with your setup and fall back to A Security if it is hit hard.',
  'recon: A Tower | Gather information on A Main from A Tower and call the hit early.',
  'smoke: Mid Top | Play mid with smokes ready for either site and slow mid pushes.',
  'stall: B Tower | Hold B from B Tower and slow the hit with utility.',
  'duel: B Site | Hold B Main from the site with an Operator or a close angle.',
]);
midControl('abyss', 'Mid Catwalk', 'Mid Top');
play('abyss', 'defense', 'A', 'retake', 'Retake A', 'Retake together from A Link and A Security, with A Tower swinging at the same time.', [
  'smoke: Defender Side Spawn > A Link | Smoke A Main and A Lobby so the attackers on site are cut off.',
  'recon flash: A Link > A Site | Clear the site with information and flash the defuse spot.',
  'retake: Defender Side Spawn > A Security > A Site | Retake from A Security together with the team, checking A Secret as you go.',
  'duel: A Tower | Swing from A Tower at the same time to split their attention.',
]);
play('abyss', 'defense', 'B', 'retake', 'Retake B', 'Retake through B Link with B Tower swinging at the same time.', [
  'smoke: Defender Side Spawn > B Link | Smoke B Main and B Nest from B Link.',
  'recon: B Tower | Clear the site with information from B Tower.',
  'flash retake: B Link > B Site | Flash and retake through B Link together.',
  'duel: B Tower > B Site | Swing from B Tower at the same time.',
]);

// ---------------------------------------------------------------- Ascent

play('ascent', 'attack', 'A', 'hit', 'A hit through Main', 'Smokes cut A Rafters (Heaven) and A Tree, and the team takes A Main together.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Rafters (Heaven) and A Tree from A Lobby.',
  'recon: A Lobby > A Main | Clear A Main and A Wine with information before the push.',
  'flash entry: A Lobby > A Main > A Site | Flash over A Main and take A Wine, then the site.',
  'clear: A Lobby > A Main > A Site | Clear the close corners on site with utility as the team arrives.',
]);
play('ascent', 'attack', 'A', 'split', 'A split through Tree', 'Mid players take Catwalk and come through A Tree while the rest hit A Main.', [
  'recon lurk: Mid Courtyard > Mid Catwalk > A Tree | Take Mid Catwalk early and push A Tree as the hit starts.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Rafters (Heaven) and A Garden.',
  'entry flash: A Lobby > A Main > A Site | Hit A Main with flashes when A Tree is yours.',
]);
play('ascent', 'attack', 'B', 'hit', 'B hit through Main', 'A fast B take behind smokes on Mid Market and the back of the site.', [
  'smoke: Attacker Side Spawn > B Lobby | Smoke Mid Market and the back of B Site from B Lobby.',
  'recon: B Lobby > B Main | Clear B Main and the site corners with information.',
  'flash entry: B Lobby > B Main > B Site | Flash B Main and take the site, checking B Boat House.',
  'postplant: B Lobby > B Main | Hold the plant from B Main with mollies on the default spot.',
]);
play('ascent', 'attack', 'B', 'split', 'B split through Market', 'Mid players come through Mid Market as the rest hit B Main.', [
  'recon lurk: Mid Courtyard > Mid Bottom > Mid Market | Take mid, then hit B through Mid Market as the main group enters.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke the back of B Site so rotations arrive blind.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main together when mid is ready.',
]);
play('ascent', 'attack', null, 'default', 'Win mid first', 'Ascent is won in mid, and taking it opens up both sites.', [
  'recon: Mid Top > Mid Courtyard | Clear mid with information early, since it opens both sites.',
  'duel: Mid Top | Hold Mid Top with an Operator for an early pick.',
  'flank: A Lobby | Watch A Main for a push and the spawn flank.',
  'smoke: Mid Courtyard | Smoke Mid Market or Mid Cubby for the mid push.',
  'entry: B Lobby | Wait at B Lobby, ready for the hit the mid fight opens.',
]);
play('ascent', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with a player in mid to stop splits through Market and A Tree.', [
  'anchor: A Site | Hold A with your setup and watch A Tree and A Main.',
  'recon: A Rafters | Gather information on A Main from A Rafters (Heaven).',
  'duel: Mid Market | Hold mid from Mid Market or Mid Pizza with an Operator.',
  'stall: B Site | Hold B and slow a B Main rush with utility.',
  'smoke: Mid Pizza | Play between the sites with smokes ready for either, and smoke Mid Top early.',
]);
midControl('ascent', 'Mid Bottom > Mid Courtyard', 'Mid Market');
play('ascent', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Garden with A Rafters (Heaven) swinging at the same time.', [
  'smoke: Defender Side Spawn > A Garden | Smoke A Main and A Tree so the attackers on site are cut off.',
  'recon: A Garden | Clear the site with information from A Garden and A Window.',
  'flash retake: A Garden > A Site | Flash and retake together from A Garden.',
  'duel: A Rafters | Swing from A Rafters (Heaven) at the same time.',
]);
play('ascent', 'defense', 'B', 'retake', 'Retake B', 'Retake through Mid Market and from spawn at the same time.', [
  'smoke: Mid Market | Smoke B Main from Mid Market so the attackers in it can’t help.',
  'recon: Mid Market | Clear the site with information first.',
  'flash retake: Mid Market > B Site | Flash and retake through Mid Market together.',
  'duel: Defender Side Spawn > B Site | Come from spawn at the same time to split their attention.',
]);

// ---------------------------------------------------------------- Bind

play('bind', 'attack', 'A', 'split', 'A split through Short and Showers', 'Hits A from A Short and A Bath (Showers) at once, so the site can’t watch both.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower (Heaven) and A Lamps from A Lobby.',
  'clear: A Lobby > A Bath | Clear A Bath (Showers) with utility and push out onto the site.',
  'flash entry: A Link > A Short > A Site | Flash and take A Short, then the site, checking A Cubby.',
  'postplant: A Lobby > A Bath > A Site | Follow through A Bath and hold the plant from there.',
]);
play('bind', 'attack', 'A', 'fake', 'Show B, hit A', 'Utility in B Long pulls defenders over, then the team hits A Bath (Showers).', [
  'lurk: B Fountain > B Long | Make noise in B Long with utility to pull defenders, then hold the flank.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower (Heaven) and A Lamps once B has drawn attention.',
  'entry flash: A Lobby > A Bath > A Site | Hit A Bath (Showers) together as the rotation commits to B.',
  'clear: A Link > A Short | Clear A Short and A Cubby and join the site take.',
]);
play('bind', 'attack', 'B', 'hit', 'B hit down Long', 'A wall down B Long and smokes on B Elbow and B Hall make the site take safe.', [
  'smoke: Attacker Side Spawn > B Fountain | Smoke B Elbow and B Hall from B Fountain.',
  'wall: B Fountain > B Long | Wall down B Long to cut off B Garden and the site.',
  'flash entry: B Fountain > B Long > B Site | Flash and take the site from B Long, and clear B Garden.',
  'clear: B Short > B Window | Clear B Window (Hookah) and join the site take from there.',
]);
play('bind', 'attack', 'B', 'split', 'B split through Long and Hookah', 'Takes B Window (Hookah) first, then hits B Long and the window at once.', [
  'recon clear: B Short > B Window | Take B Window (Hookah) with information and utility.',
  'smoke: Attacker Side Spawn > B Fountain | Smoke B Elbow and B Hall.',
  'entry flash: B Fountain > B Long > B Site | Hit B Long as B Window falls and trade each other onto the site.',
]);
play('bind', 'attack', null, 'default', 'Take Short and Hookah first', 'Early control of A Short and B Window (Hookah) lets you hit either site or use a teleporter.', [
  'recon: A Link > A Short | Gather information on A Short early with utility.',
  'clear: B Short > B Window | Take B Window (Hookah) early.',
  'flank: B Fountain | Hold B Long for a push and watch the flank.',
  'smoke: Attacker Side Cave | Keep your smokes for the hit, since you can reach either site from here.',
  'entry: A Lobby | Wait at A Lobby, ready to hit A Bath (Showers) or rotate.',
]);
play('bind', 'defense', null, 'setup', 'Two on A, two on B, one between', 'The standard hold, with a player between the sites ready to rotate either way.', [
  'anchor: A Site | Hold A with your setup on A Short and A Bath (Showers).',
  'stall: A Lamps | Slow A Short and A Bath with utility from A Lamps.',
  'smoke: Defender Side Spawn | Play between the sites and smoke A Short or B Long at the first sign of a hit.',
  'duel: B Site | Hold B Long from the site.',
  'stall: B Garden | Slow B Window (Hookah) and B Long from B Garden.',
]);
play('bind', 'defense', null, 'setup', 'Early looks at Hookah and Short', 'Early information on both chokes, then fall back to the sites.', [
  'recon: B Window | Take an early look in B Window (Hookah) with information, then fall back.',
  'duel: A Short | Peek A Short early for a pick and fall back to A Lamps.',
  'anchor: A Site | Hold A alone with your setup.',
  'smoke: Defender Side Spawn | Stay between the sites with smokes for either.',
  'stall: B Site | Hold B and slow a B Long rush.',
]);
play('bind', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Lamps with A Tower (Heaven) swinging at the same time.', [
  'smoke: A Lamps | Smoke A Short and A Bath (Showers) so the attackers on site are alone.',
  'recon: A Tower | Clear the site with information from A Tower (Heaven).',
  'flash retake: A Lamps > A Site | Flash and retake together from A Lamps.',
  'duel: A Tower > A Site | Swing from A Tower (Heaven) at the same time.',
]);
play('bind', 'defense', 'B', 'retake', 'Retake B', 'Retake through B Hall with B Elbow swinging at the same time.', [
  'smoke: B Hall | Smoke B Long and B Window (Hookah) from B Hall.',
  'recon: B Hall | Clear the site with information first.',
  'flash retake: B Hall > B Site | Flash and retake through B Hall together.',
  'duel: B Elbow > B Site | Swing from B Elbow at the same time.',
]);

// ---------------------------------------------------------------- Breeze

play('breeze', 'attack', 'A', 'hit', 'A hit through Shop', 'A long wall makes the huge site crossable, so the team can take A Pyramids and then plant.', [
  'wall: Attacker Side Spawn > A Shop | Wall across A Site from A Shop to cut off A Bridge and A Ramp.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Bridge and A Ramp.',
  'recon: A Lobby > A Shop | Clear A Pyramids and the back of the site with information.',
  'entry flash: A Lobby > A Shop > A Site | Flash and take A Pyramids, then the site.',
]);
play('breeze', 'attack', 'A', 'split', 'A split through Mid Hall', 'Mid players come through Mid Hall as the rest hit A Shop.', [
  'recon lurk: Mid Bottom > Mid Pillar > Mid Hall | Take mid and push Mid Hall toward A Site as the hit starts.',
  'wall: Attacker Side Spawn > A Shop | Wall the site from A Shop.',
  'entry flash: A Lobby > A Shop > A Site | Hit through A Shop when mid is ready.',
]);
play('breeze', 'attack', 'B', 'hit', 'B hit through Main', 'A wall across B Site and utility in B Elbow, then a fast take.', [
  'wall: B Main | Wall across B Site from B Main to cut off B Wall and B Tunnel.',
  'smoke: Attacker Side Spawn > B Main | Smoke B Tunnel and B Back.',
  'clear: B Window > B Elbow | Clear B Elbow with utility and push into the site.',
  'entry flash: B Main > B Site | Flash and take the site through B Main.',
]);
play('breeze', 'attack', 'B', 'split', 'B split through Tunnel', 'Mid players come through B Tunnel as the rest hit B Main.', [
  'recon lurk: Mid Bottom > Mid Top > B Tunnel | Take mid and come through B Tunnel as the hit starts.',
  'wall: B Main | Wall across the site from B Main.',
  'entry flash: B Window > B Main > B Site | Hit B Main together when the tunnel is ready.',
]);
play('breeze', 'attack', null, 'default', 'Picks first, then hit', 'Breeze’s long lines reward early picks, with the wall saved for the hit.', [
  'duel: Mid Cannon | Hold Mid Cannon and mid with an Operator for an early pick.',
  'recon: A Shop | Gather information on A early.',
  'flank: B Window | Watch B Window and the flank.',
  'wall: Attacker Side Spawn | Keep your wall for the hit, because it’s what makes a site take safe.',
  'entry: Mid Bottom | Play mid, ready to hit whichever site the information opens.',
]);
play('breeze', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with an Operator in mid.', [
  'anchor: A Site | Hold A from the site with your setup.',
  'duel: Mid Nest | Hold mid from Mid Nest with an Operator.',
  'recon: A Bridge | Gather information on A Shop and the site from A Bridge.',
  'stall: B Site | Hold B and slow B Main with utility.',
  'smoke: Defender Side Arches | Play between B and mid with smokes for either.',
]);
midControl('breeze', 'Mid Top > Mid Pillar', 'Mid Nest');
play('breeze', 'defense', 'A', 'retake', 'Retake A', 'Wall the site from A Bridge and retake through A Ramp together.', [
  'wall: A Bridge | Wall the site from A Bridge so the team can cross safely.',
  'recon: A Bridge | Clear the site with information.',
  'flash retake: A Ramp > A Site | Flash and retake through A Ramp together.',
  'duel: Mid Hall > A Site | Swing from Mid Hall at the same time.',
]);
play('breeze', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Wall with B Tunnel swinging at the same time.', [
  'smoke: Defender Side Arches | Smoke B Main and B Elbow.',
  'recon: B Wall | Clear the site with information from B Wall.',
  'flash retake: B Wall > B Site | Flash and retake together.',
  'duel: B Tunnel > B Site | Swing from B Tunnel at the same time.',
]);

// ---------------------------------------------------------------- Corrode

play('corrode', 'attack', 'A', 'hit', 'A hit through Main', 'Clears A Yard’s many corners with utility before the site take.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Crane and A Link from A Lobby.',
  'wall: A Lobby > A Main | Wall down A Main into A Yard to cover the crossing.',
  'recon clear: A Lobby > A Main > A Yard | Clear A Yard, A Pocket and A Elbow with information and utility.',
  'entry: A Lobby > A Main > A Yard > A Site | Take the site first once the corners are cleared.',
]);
play('corrode', 'attack', 'A', 'split', 'A split through Link', 'Mid players come through A Link as the rest hit A Main.', [
  'recon lurk: Mid Bottom > Mid Stairs > A Link | Take mid and push A Link as the main group enters.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Crane and the back of the site.',
  'entry flash: A Lobby > A Main > A Site | Hit A Main with flashes once A Link is yours.',
]);
play('corrode', 'attack', 'B', 'hit', 'B hit through Main', 'Smokes on B Tower and B Arch and a wall to hide the plant.', [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and B Arch from B Lobby.',
  'wall: B Lobby > B Main | Wall the site from B Main to hide the plant.',
  'flash: B Lobby > B Main | Flash B Elbow and the site corners for the entry.',
  'entry: B Main > B Site | Take the site first and clear B Elbow.',
  'postplant: B Lobby > B Main | Hold the plant from B Main with lineups.',
]);
play('corrode', 'attack', 'B', 'fake', 'Show A, hit B', 'Utility in A Main pulls defenders toward A, then the team hits B Main.', [
  'lurk: A Lobby > A Main | Make noise in A Main with utility to pull defenders toward A, then hold the flank.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and B Arch once A has drawn attention.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main together as the rotation commits to A, and clear B Elbow first.',
  'postplant: B Lobby > B Main | Hold the plant from B Main with lineups.',
]);
play('corrode', 'attack', 'B', 'split', 'B split through Link', 'Mid players come through B Link as the rest hit B Main.', [
  'recon lurk: Mid Bottom > B Link | Take mid and push B Link as the hit starts.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and B Arch.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main when B Link is ready.',
]);
play('corrode', 'attack', null, 'default', 'Win a mid lane first', 'Mid has three lanes, and winning one tells you where to hit.', [
  'recon: Mid Bottom | Gather information on mid, because its lanes decide the rotations.',
  'duel: Mid Top | Hold a mid lane for an early pick.',
  'flank: A Lobby | Watch A Main and the spawn flank.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit.',
  'entry: B Lobby | Wait at B Lobby, ready to hit or rotate.',
]);
play('corrode', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with a player in mid to stop splits through the links.', [
  'anchor: A Site | Hold A with your setup and watch A Yard and A Link.',
  'recon: A Crane | Gather information on A Main from A Crane.',
  'smoke: Mid Window | Play mid with smokes for either site.',
  'stall: B Site | Hold B and slow B Main.',
  'duel: B Tower | Hold the site from B Tower.',
]);
midControl('corrode', 'Mid Top', 'Mid Window');
play('corrode', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Crane with A Link swinging at the same time.', [
  'smoke: A Crane | Smoke A Main and A Yard from A Crane.',
  'recon: A Link | Clear the site with information.',
  'flash retake: A Crane > A Site | Flash and retake together.',
  'duel: A Link > A Site | Swing from A Link at the same time.',
]);
play('corrode', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Arch with B Tower swinging at the same time.', [
  'smoke: B Arch | Smoke B Main from B Arch.',
  'recon: B Link | Clear the site with information.',
  'flash retake: B Arch > B Site | Flash and retake together.',
  'duel: B Tower > B Site | Swing from B Tower at the same time.',
]);

// ---------------------------------------------------------------- Fracture

play('fracture', 'attack', 'A', 'split', 'A pincer from both ends', 'Hits A from A Main and from A Dish at the same moment, which is the best trick Fracture has.', [
  'smoke: Attacker Side Spawn > A Main | Smoke A Link and the defender side of the site.',
  'entry flash: Attacker Side Spawn > A Main > A Site | Hit A Main with flashes as the other side arrives.',
  'lurk: Attacker Side Bridge > A Gate > A Dish > A Drop | Go round through A Gate and A Dish to hit A from the top at the same time.',
  'flank: A Hall | Watch A Hall and A Door so no one comes behind the main group.',
]);
play('fracture', 'attack', 'A', 'hit', 'A hit from Dish', 'Drops onto A from A Dish while one player pushes A Main late.', [
  'smoke: Attacker Side Bridge | Smoke A Link and the bottom of the site from the top.',
  'recon: Attacker Side Bridge > A Gate > A Dish | Clear A Dish with information.',
  'entry flash: A Gate > A Dish > A Drop > A Site | Drop into the site from A Dish together.',
  'flank: Attacker Side Spawn > A Main | Push A Main late to catch defenders sliding round.',
]);
play('fracture', 'attack', 'B', 'split', 'B pincer from both ends', 'Hits B from B Tree and through B Arcade at the same moment.', [
  'smoke: Attacker Side Spawn > B Main | Smoke B Canteen and B Generator.',
  'entry flash: Attacker Side Spawn > B Main > B Tree > B Site | Hit B Tree with flashes as the other side arrives.',
  'lurk: Attacker Side Bridge > B Bench > B Arcade | Go round through B Arcade to hit from the top at the same time.',
  'flank: B Tunnel | Take B Tunnel and cut off the rotation from the middle.',
]);
play('fracture', 'attack', 'B', 'hit', 'B hit through Arcade', 'Takes B from the top through B Arcade, with a late push from B Main.', [
  'smoke: Attacker Side Bridge > B Bench | Smoke B Canteen and B Generator.',
  'recon: B Bench > B Arcade | Clear B Arcade and B Tower with information.',
  'entry flash: B Bench > B Arcade > B Site | Take the site through B Arcade together.',
  'flank: Attacker Side Spawn > B Main | Push B Main late to catch defenders sliding round.',
]);
play('fracture', 'attack', null, 'default', 'Spread across both ends', 'Defenders can’t watch both ends, so show yourselves everywhere, then collapse on one site.', [
  'recon: A Main | Gather information on A Main early.',
  'flank: Attacker Side Bridge | Hold the top for flanks, since Fracture has two sides to watch.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit.',
  'duel: B Main | Hold B Main for an early pick.',
  'entry: Attacker Side Spawn | Stay ready to hit either site from both ends.',
]);
play('fracture', 'defense', null, 'setup', 'Two on A, one middle, two on B', 'Hold each site with someone watching the top route in.', [
  'anchor: A Site | Hold A with your setup and watch A Main and A Drop.',
  'stall: A Dish | Slow attackers coming through A Dish with utility.',
  'smoke: Defender Side Spawn | Stay in the middle with smokes, where you can reach both sites fast.',
  'stall: B Site | Hold B and slow B Tree and B Arcade.',
  'duel: B Generator | Hold B Generator and B Arcade.',
]);
play('fracture', 'defense', null, 'setup', 'Early push through Dish', 'An early look through A Dish for information and picks, then fall back.', [
  'duel recon: A Dish | Take an early look through A Dish for picks, then fall back.',
  'smoke: Defender Side Spawn | Stay in the middle with smokes for either site.',
  'anchor: A Site | Hold A alone with your setup.',
  'stall: B Site | Hold B alone and slow a rush.',
]);
play('fracture', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Link with A Dish swinging at the same time.', [
  'smoke: A Link | Smoke A Main and A Drop from A Link.',
  'recon: A Link | Clear the site with information.',
  'flash retake: A Link > A Site | Flash and retake together.',
  'duel: A Dish > A Drop | Swing from A Dish at the same time.',
]);
play('fracture', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Link with B Canteen swinging at the same time.', [
  'smoke: B Link | Smoke B Tree and B Arcade from B Link.',
  'recon: B Generator | Clear the site with information.',
  'flash retake: B Link > B Site | Flash and retake together.',
  'duel: B Canteen > B Site | Swing from B Canteen at the same time.',
]);

// ---------------------------------------------------------------- Haven

play('haven', 'attack', 'A', 'split', 'A split through Long and Sewer', 'Hits A from A Long and A Sewer at once, with smokes on A Tower (Heaven) and A Link.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower (Heaven) and A Link from A Lobby.',
  'recon: A Lobby > A Long | Clear A Long and the site corners with information.',
  'entry flash: A Lobby > A Long > A Site | Take A Long with flashes and push onto the site.',
  'clear: A Lobby > A Sewer > A Site | Clear A Sewer with utility and join the site take.',
]);
play('haven', 'attack', 'A', 'fake', 'Show C, hit A', 'Utility on C Long pulls defenders to C, then the team hits A.', [
  'lurk: C Lobby > C Long | Make noise on C Long with utility, then hold the flank.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower (Heaven) and A Link once C has drawn rotations.',
  'entry flash: A Lobby > A Long > A Site | Hit A Long together as the defenders commit to C.',
  'clear: A Lobby > A Sewer | Clear A Sewer and join the site take.',
]);
play('haven', 'attack', 'B', 'hit', 'B hit through mid', 'B is small and quick to take, and just as quick to retake, so plant fast and hold.', [
  'smoke: Mid Courtyard | Smoke A Link and C Garage so only B Back can see you.',
  'recon: Mid Window > Mid Courtyard | Clear B Site and B Back with information.',
  'entry flash: Mid Courtyard > B Site | Flash B Back and take the site quickly.',
  'postplant: Mid Courtyard | Hold the plant from Mid Courtyard, because B is quick to retake.',
]);
play('haven', 'attack', 'C', 'hit', 'C hit down Long', 'C is far from defender spawn, so take C Long and hold the plant from there.', [
  'smoke: Attacker Side Spawn > C Lobby | Smoke C Link and C Window from C Lobby.',
  'recon: C Lobby > C Long | Clear C Long and C Cubby with information.',
  'entry flash: C Lobby > C Long > C Site | Take C Long with flashes and push onto the site.',
  'postplant: C Lobby > C Long | Hold the plant from C Long with lineups.',
]);
play('haven', 'attack', 'C', 'split', 'C split through Garage', 'Takes C Garage from mid and hits C Long at the same time.', [
  'smoke: Attacker Side Spawn > C Lobby | Smoke C Link and C Window from C Lobby.',
  'entry flash: C Lobby > C Long > C Site | Hit C Long with flashes.',
  'recon lurk: Mid Doors > C Garage | Take C Garage with information and pinch the site as the hit lands.',
]);
play('haven', 'attack', null, 'default', 'Spread out, then hit the weak site', 'Three sites stretch the defenders, so find the thin one first.', [
  'recon: Mid Courtyard | Gather information on mid, which leads to every site.',
  'lurk: A Lobby > A Long | Hold A Long for picks.',
  'duel: C Lobby > C Long | Hold C Long for picks.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit on whichever site is weakest.',
  'flank: Mid Doors | Watch Mid Doors and C Garage for a defender push.',
]);
play('haven', 'defense', null, 'setup', 'One on each site, two floating', 'Three sites mean holding alone, so call early and rotate fast.', [
  'anchor: A Site | Hold A alone with your setup and call early.',
  'stall: B Site | Hold B from B Back and help either side.',
  'smoke: C Site | Hold C with smokes ready for C Long.',
  'duel: A Tower | Hold A Long from A Tower (Heaven) with an Operator.',
  'recon: C Link | Gather information on C Long and C Garage from C Link.',
]);
play('haven', 'defense', null, 'setup', 'Hold mid and Garage', 'Stops splits through C Garage and wins early information in mid.', [
  'duel recon: Mid Window | Take mid early through Mid Window with information, then fall back to B.',
  'smoke: C Garage | Smoke and hold C Garage so attackers can’t split through it.',
  'anchor: A Site | Hold A alone with your setup.',
  'stall: C Site | Hold C and slow a C Long rush.',
]);
play('haven', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Link with A Tower (Heaven) swinging at the same time.', [
  'smoke: A Link | Smoke A Long and A Sewer from A Link.',
  'recon: A Link | Clear the site with information.',
  'flash retake: A Link > A Site | Flash and retake together.',
  'duel: A Tower > A Site | Swing from A Tower (Heaven) at the same time.',
]);
play('haven', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Back with A Link swinging at the same time.', [
  'smoke: B Back | Smoke Mid Courtyard from B Back so attackers in mid can’t help.',
  'recon: A Link | Clear B Site with information from A Link.',
  'flash retake: B Back > B Site | Flash and retake from B Back together.',
  'duel: A Link > B Site | Swing from A Link at the same time.',
]);
play('haven', 'defense', 'C', 'retake', 'Retake C', 'Retake from C Link with C Window swinging at the same time.', [
  'smoke: C Link | Smoke C Long and C Garage from C Link.',
  'recon: C Window | Clear the site with information from C Window.',
  'flash retake: C Link > C Site | Flash and retake together.',
  'duel: C Window > C Site | Swing from C Window at the same time.',
]);

// ---------------------------------------------------------------- Icebox

play('icebox', 'attack', 'A', 'hit', 'A hit through Belt', 'A wall cuts off A Rafters and A Screen. Clear A Pipes and A Nest, then plant and hold it from A Belt.', [
  'wall: A Belt | Wall from A Belt across the site to cut off A Rafters and A Screen.',
  'postplant: Attacker Side Spawn > A Belt | Follow the hit in and hold the plant from A Belt, on your side of the wall.',
  'clear: A Belt > A Pipes | Clear A Pipes and A Nest with utility.',
  'entry flash: A Belt > A Nest > A Site | Take A Nest with flashes and push onto the site.',
]);
play('icebox', 'attack', 'A', 'split', 'A split through mid', 'Mid players push toward A Screen as the rest hit A Belt.', [
  'recon lurk: Mid Blue > Mid Pallet > A Screen | Take mid and push toward A Screen as the hit starts.',
  'smoke: Attacker Side Spawn > A Belt | Smoke A Rafters and the back of the site.',
  'entry flash: A Belt > A Nest > A Site | Hit A Nest when mid is ready.',
]);
play('icebox', 'attack', 'B', 'hit', 'B hit through Yellow', 'A wall from B Yellow cuts off B Back and B Hall, and the team takes the site fast behind it.', [
  'wall: B Yellow | Wall from B Yellow across the site to cut off B Back and B Hall.',
  'postplant: Attacker Side Spawn > B Yellow | Follow the hit in and hold the plant from B Yellow, on your side of the wall.',
  'recon: B Green > B Yellow | Clear the site with information from B Yellow.',
  'entry flash: B Yellow > B Site | Take the site with flashes, checking B Fence and B Snowman.',
]);
play('icebox', 'attack', 'B', 'split', 'B split through Kitchen', 'Mid players come through B Kitchen as the rest hit B Yellow.', [
  'recon lurk: Mid Blue > B Tube > B Kitchen | Take mid and push B Kitchen as the hit starts.',
  'smoke: Attacker Side Spawn > B Yellow | Smoke B Snowman and B Back.',
  'entry flash: B Green > B Yellow > B Site | Hit B Yellow when mid is ready.',
]);
play('icebox', 'attack', null, 'default', 'Picks first, then hit', 'Icebox’s open lanes reward early picks, with the wall kept for the hit.', [
  'recon: Mid Blue | Gather information on mid early.',
  'duel: B Yellow | Hold B Yellow for picks with an Operator.',
  'flank: A Belt | Watch A Belt and the flank.',
  'wall: Attacker Side Spawn | Keep your wall for the hit, because Icebox is too open to cross without it.',
  'entry: B Green | Wait at B Green, ready to hit either site.',
]);
play('icebox', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with an Operator watching A Belt.', [
  'anchor: A Site | Hold A with your setup on A Belt and A Nest.',
  'duel: A Rafters | Hold A Belt from A Rafters with an Operator.',
  'smoke: Mid Boiler | Play mid with smokes ready for either site.',
  'stall: B Site | Hold B and slow B Yellow.',
  'recon: B Hut | Gather information on B Yellow and B Orange from B Hut.',
]);
midControl('icebox', 'Mid Blue', 'Mid Boiler');
play('icebox', 'defense', 'A', 'retake', 'Retake A', 'Wall the site from A Screen and retake together.', [
  'wall: A Screen | Wall the site from A Screen so the team can cross safely.',
  'recon: A Screen | Clear the site with information.',
  'flash retake: A Screen > A Site | Flash and retake together.',
  'duel: A Rafters > A Site | Swing from A Rafters at the same time.',
]);
play('icebox', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Hall with B Back swinging at the same time.', [
  'smoke: B Kitchen | Smoke B Yellow and B Orange from B Kitchen.',
  'recon: B Hall | Clear the site with information.',
  'flash retake: B Hall > B Site | Flash and retake together.',
  'duel: B Back > B Site | Swing from B Back at the same time.',
]);

// ---------------------------------------------------------------- Lotus

play('lotus', 'attack', 'A', 'hit', 'A hit through Main', 'Clears A Main and A Hut, with smokes on A Tree and A Stairs.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tree and A Stairs from A Lobby.',
  'clear: A Lobby > A Rubble | Clear A Rubble and A Hut with utility.',
  'recon: A Lobby > A Root | Clear A Main and A Hut with information.',
  'entry flash: A Root > A Main > A Site | Take A Main with flashes and push onto the site.',
]);
play('lotus', 'attack', 'A', 'split', 'A split through Root and Rubble', 'Hits A from A Main and A Rubble at once.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tree and A Stairs.',
  'entry flash: A Lobby > A Root > A Main > A Site | Hit through A Root and A Main.',
  'clear lurk: A Lobby > A Rubble > A Site | Break in through A Rubble and pinch the site.',
]);
play('lotus', 'attack', 'B', 'hit', 'B hit through Main', 'B is small and in the middle, so take it fast and hold the plant from B Pillars.', [
  'smoke: Attacker Side Spawn > B Pillars | Smoke B Upper and A Link.',
  'recon: B Pillars > B Main | Clear B Main and the site with information.',
  'entry flash: B Pillars > B Main > B Site | Flash and take the site together.',
  'postplant: B Pillars | Hold the plant from B Pillars and B Main.',
]);
play('lotus', 'attack', 'C', 'hit', 'C hit through Main', 'Smokes on C Hall and C Waterfall and a wall from C Mound, then take C Main.', [
  'smoke: Attacker Side Spawn > C Lobby | Smoke C Hall and C Waterfall from C Lobby.',
  'wall: C Lobby > C Mound | Wall from C Mound across the site to cut off C Gravel and C Hall.',
  'recon: C Mound > C Main | Clear C Main and the site with information.',
  'entry flash: C Mound > C Main > C Site | Take the site with flashes, checking C Bend.',
]);
play('lotus', 'attack', 'C', 'fake', 'Show A, hit C', 'Utility at A Root and A Rubble pulls defenders toward A, then the team hits C Main.', [
  'lurk: A Lobby > A Root | Make noise at A Root with utility to pull defenders toward A, then hold the flank.',
  'smoke: Attacker Side Spawn > C Lobby | Smoke C Hall and C Waterfall once A has drawn rotations.',
  'entry flash: C Lobby > C Main > C Site | Hit C Main together as the defenders commit to A.',
  'postplant: C Lobby > C Main | Hold the plant from C Main with lineups.',
]);
play('lotus', 'attack', 'C', 'split', 'C split through the door', 'Pinches C from C Waterfall through C Door while the rest hit C Main.', [
  'smoke: Attacker Side Spawn > C Lobby | Smoke C Hall and C Link, and leave C Waterfall open for the pinch.',
  'entry flash: C Lobby > C Mound > C Main > C Site | Hit C Main with flashes.',
  'recon lurk: B Main > C Door > C Waterfall | Push through C Door and pinch from C Waterfall as the hit lands.',
]);
play('lotus', 'attack', null, 'default', 'Spread out, then hit the weak site', 'B connects to everything, so information there decides the hit.', [
  'recon: B Pillars | Gather information on B early, since it connects to all three sites.',
  'lurk: A Lobby > A Root | Hold A Root for picks.',
  'duel: C Lobby > C Mound | Hold C Mound for picks.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit.',
  'flank: B Main | Watch B Main and C Door for flanks.',
]);
play('lotus', 'defense', null, 'setup', 'One on each site, two floating', 'Three sites mean holding alone, so call early and use the doors to rotate.', [
  'anchor: A Site | Hold A with your setup on A Main and A Rubble.',
  'stall: B Site | Hold B and help either side.',
  'smoke: C Site | Hold C with smokes ready for C Main and C Mound.',
  'duel: A Stairs | Hold A Main from A Stairs.',
  'recon: C Waterfall | Gather information on C Mound from C Waterfall.',
]);
play('lotus', 'defense', null, 'setup', 'Early look in B Main', 'Early information in B Main tells you where they’re going.', [
  'duel recon: B Main | Take an early look in B Main with information, then fall back.',
  'smoke: C Link | Stay central with smokes, where you can reach B and C quickly.',
  'anchor: A Site | Hold A alone with your setup.',
  'stall: C Site | Hold C alone and slow a rush.',
]);
play('lotus', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Drop with A Tree swinging at the same time.', [
  'smoke: A Stairs | Smoke A Main and A Rubble from A Stairs.',
  'recon: A Top | Clear the site with information from A Top.',
  'flash retake: A Drop > A Site | Flash and retake together.',
  'duel: A Link > A Tree | Swing from A Tree at the same time.',
]);
play('lotus', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Upper with A Link swinging at the same time.', [
  'smoke: B Upper | Smoke B Main from B Upper.',
  'recon: B Upper | Clear the site with information.',
  'flash retake: B Upper > B Site | Flash and retake together.',
  'duel: A Link > B Site | Swing from A Link at the same time.',
]);
play('lotus', 'defense', 'C', 'retake', 'Retake C', 'Retake from C Hall with C Waterfall swinging at the same time.', [
  'smoke: C Hall | Smoke C Main and C Mound from C Hall.',
  'recon: C Gravel | Clear the site with information.',
  'flash retake: C Hall > C Site | Flash and retake together.',
  'duel: C Waterfall > C Site | Swing from C Waterfall at the same time.',
]);

// ---------------------------------------------------------------- Pearl

play('pearl', 'attack', 'A', 'hit', 'A hit through Main', 'Smokes on A Flowers and A Secret, then take A Main and plant.', [
  'smoke: Attacker Side Spawn > A Restaurant | Smoke A Flowers and A Secret from A Restaurant.',
  'recon: A Art > A Main | Clear A Main and A Dugout with information.',
  'entry flash: A Art > A Main > A Site | Take A Main with flashes and push onto the site.',
  'postplant: A Restaurant > A Main | Hold the plant from A Main with lineups.',
]);
play('pearl', 'attack', 'A', 'split', 'A split through Link', 'Mid players come through A Link as the rest hit A Main.', [
  'recon lurk: Mid Top > Mid Doors > Mid Connector > A Link | Take mid and push A Link as the hit starts.',
  'smoke: Attacker Side Spawn > A Restaurant | Smoke A Flowers and A Secret.',
  'entry flash: A Art > A Main > A Site | Hit A Main when A Link is ready.',
]);
play('pearl', 'attack', 'B', 'hit', 'B hit down Long', 'A wall down B Main (B Long) makes the long walk safe.', [
  'wall: B Ramp > B Main | Wall down B Main (B Long) to cut off B Screen and B Tower.',
  'smoke: Attacker Side Spawn > B Ramp | Smoke B Hall and B Tunnel.',
  'recon: B Ramp > B Main | Clear the site corners with information.',
  'entry flash: B Ramp > B Main > B Site | Take the site with flashes, checking B Screen.',
]);
play('pearl', 'attack', 'B', 'split', 'B split through Link', 'Mid players come through B Link as the rest hit B Main (B Long).', [
  'recon lurk: Mid Plaza > B Link | Take mid and push B Link as the hit starts.',
  'smoke: Attacker Side Spawn > B Ramp | Smoke B Hall and B Tower.',
  'entry flash: B Ramp > B Main > B Site | Hit B Main (B Long) when B Link is ready.',
]);
play('pearl', 'attack', null, 'default', 'Take mid first', 'Mid connects to both sites, and owning it makes every split possible.', [
  'recon: Mid Top | Gather information on mid early.',
  'duel: B Main | Hold B Main (B Long) for picks.',
  'flank: A Restaurant | Watch A Restaurant and A Art for a defender push.',
  'smoke: Mid Shops | Keep your smokes for the hit, since mid connects to both sites.',
  'entry: Mid Plaza | Play mid, ready to hit either site.',
]);
play('pearl', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with a smoker in mid.', [
  'anchor: A Site | Hold A with your setup on A Main.',
  'recon: A Link | Gather information on A Main and mid from A Link.',
  'smoke: Defender Side Water | Play mid with smokes ready for either site.',
  'stall: B Site | Hold B and slow B Main (B Long).',
  'duel: B Tower | Hold B Main from B Tower with an Operator.',
]);
midControl('pearl', 'Mid Connector > Mid Doors', 'Defender Side Water');
play('pearl', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Flowers with A Secret swinging at the same time.', [
  'smoke: A Flowers | Smoke A Main and A Link from A Flowers.',
  'recon: A Secret | Clear the site with information.',
  'flash retake: A Flowers > A Site | Flash and retake together.',
  'duel: A Secret > A Site | Swing from A Secret at the same time.',
]);
play('pearl', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Tunnel with B Hall swinging at the same time.', [
  'smoke: B Tunnel | Smoke B Main from B Tunnel.',
  'recon: B Hall | Clear the site with information.',
  'flash retake: B Tunnel > B Site | Flash and retake together.',
  'duel: B Hall > B Site | Swing from B Hall at the same time.',
]);

// ---------------------------------------------------------------- Split

play('split', 'attack', 'A', 'hit', 'A hit through Main', 'Smokes on A Tower (A Heaven) and A Screens and a wall from A Main.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower (A Heaven) and A Screens from A Lobby.',
  'wall: A Lobby > A Main | Wall from A Main across the site to cut off A Rafters.',
  'clear: A Main > A Site | Clear A Back and the close corners with utility.',
  'entry flash: A Lobby > A Main > A Site | Take the site with flashes from A Main.',
]);
play('split', 'attack', 'A', 'split', 'A split through Ramps', 'Mid players take A Ramps as the rest hit A Main.', [
  'recon lurk: Mid Bottom > Mid Top > A Ramps | Take mid and push A Ramps as the hit starts.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower (A Heaven) and A Screens.',
  'entry flash: A Lobby > A Main > A Site | Hit A Main when A Ramps is yours.',
]);
play('split', 'attack', 'B', 'hit', 'B hit through Garage', 'Smokes on B Tower (B Heaven) and B Alley and a wall from B Garage.', [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower (B Heaven) and B Alley from B Lobby.',
  'wall: B Lobby > B Garage | Wall across the site from B Garage.',
  'clear: B Garage > B Site | Clear B Back and the close corners with utility.',
  'entry flash: B Lobby > B Garage > B Site | Take the site with flashes through B Garage.',
]);
play('split', 'attack', 'B', 'split', 'B split through Mail', 'Mid players take B Tower (B Heaven) through Mid Mail as the rest hit B Garage.', [
  'recon lurk: Mid Bottom > Mid Mail > B Tower | Take mid and push into B Tower (B Heaven) as the hit starts.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Alley and B Back.',
  'entry flash: B Lobby > B Garage > B Site | Hit B Garage when B Tower is yours.',
]);
play('split', 'attack', null, 'default', 'Take mid first', 'Mid leads into both sites from above, so own it before you hit.', [
  'recon: Mid Bottom | Gather information on mid, which leads into both sites from above.',
  'duel: Mid Top | Hold Mid Top for picks.',
  'flank: A Sewer | Watch A Sewer and the spawn flank.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit.',
  'entry: B Lobby | Wait at B Lobby, ready to hit either site.',
]);
play('split', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, using both heavens.', [
  'anchor: A Site | Hold A with your setup on A Main.',
  'stall: A Tower | Slow A Ramps and A Main from A Tower (A Heaven).',
  'smoke: Mid Vent | Play mid from Mid Vent with smokes for either site.',
  'duel: B Tower | Hold B Garage from B Tower (B Heaven).',
  'stall: B Site | Hold B and slow B Garage with utility.',
]);
midControl('split', 'Mid Top', 'Mid Vent');
play('split', 'defense', 'A', 'retake', 'Retake A', 'Drop onto A from A Tower (A Heaven) with A Screens swinging at the same time.', [
  'smoke: A Tower | Smoke A Main and A Ramps from A Tower (A Heaven).',
  'recon: A Rafters | Clear the site with information.',
  'flash retake: A Tower > A Site | Flash and drop onto the site together.',
  'duel: A Screens > A Site | Swing from A Screens at the same time.',
]);
play('split', 'defense', 'B', 'retake', 'Retake B', 'Drop onto B from B Tower (B Heaven) with B Alley swinging at the same time.', [
  'smoke: B Stairs | Smoke B Garage from B Stairs.',
  'recon: B Tower | Clear the site with information from B Tower (B Heaven).',
  'flash retake: B Tower > B Site | Flash and drop onto the site together.',
  'duel: B Alley > B Site | Swing from B Alley at the same time.',
]);

// ---------------------------------------------------------------- Summit

play('summit', 'attack', 'A', 'hit', 'A hit through Main', 'Smokes on A Hall and A Cave, then take A Garden and the site.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Hall and A Cave from A Lobby.',
  'recon: A Lobby > A Main | Clear A Main and A Garden with information.',
  'entry flash: A Main > A Garden > A Site | Take A Garden with flashes and push onto the site.',
  'postplant: A Lobby > A Main | Hold the plant from A Main.',
]);
play('summit', 'attack', 'A', 'fake', 'Show B, hit A', 'Utility in B Main pulls defenders toward B, then the team hits A Main.', [
  'lurk: B Lobby > B Main | Make noise in B Main with utility to pull defenders toward B, then hold the flank.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Hall and A Cave once B has drawn attention.',
  'entry flash: A Lobby > A Main > A Garden > A Site | Hit A Main together as the rotation commits to B, and take A Garden on the way.',
  'postplant: A Lobby > A Main | Hold the plant from A Main.',
]);
play('summit', 'attack', 'A', 'split', 'A split through Link', 'Mid players come through A Link as the rest hit A Main.', [
  'recon lurk: Mid Top > Mid Fountain > Mid Bend > A Link | Take mid and push A Link as the hit starts.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Cave and A Art.',
  'entry flash: A Lobby > A Main > A Site | Hit A Main when A Link is ready.',
]);
play('summit', 'attack', 'B', 'hit', 'B hit through Main', 'A wall from B Main cuts off B Drop and B Tower, and the team takes the site behind it.', [
  'postplant: Attacker Side Spawn > B Lobby > B Main | Follow the hit in and hold the plant from B Main, on your side of the wall.',
  'wall: B Lobby > B Main | Wall the site from B Main to cut off B Drop and B Tower.',
  'recon: B Lobby > B Main | Clear B Main and the site corners with information.',
  'entry flash: B Main > B Site | Take the site with flashes.',
]);
play('summit', 'attack', 'B', 'split', 'B split through Link', 'Mid players come through B Link as the rest hit B Main.', [
  'recon lurk: Mid Top > Mid Tiles > B Link | Take mid and push B Link as the hit starts.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and B Gym.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main when B Link is ready.',
]);
play('summit', 'attack', null, 'default', 'Take mid first', 'The wide mid around Mid Fountain leads to both sites.', [
  'recon: Mid Fountain | Gather information on mid early.',
  'duel: Mid Top | Hold mid for picks.',
  'flank: A Lobby | Watch A Main and the flank.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit.',
  'entry: B Lobby | Wait at B Lobby, ready to hit either site.',
]);
play('summit', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with a smoker in mid.', [
  'anchor: A Site | Hold A with your setup on A Garden.',
  'recon: A Hall | Gather information on A Main from A Hall.',
  'smoke: Mid Window | Play mid with smokes for either site.',
  'stall: B Site | Hold B and slow B Main.',
  'duel: B Tower | Hold B Main from B Tower.',
]);
midControl('summit', 'Mid Bottom > Mid Fountain', 'Mid Window');
play('summit', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Art with A Cave swinging at the same time.', [
  'smoke: A Hall | Smoke A Main and A Link from A Hall.',
  'recon: A Art | Clear the site with information.',
  'flash retake: A Art > A Site | Flash and retake together.',
  'duel: A Cave > A Site | Swing from A Cave at the same time.',
]);
play('summit', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Tower with B Drop swinging at the same time.', [
  'smoke: B Gym | Smoke B Main and B Link from B Gym.',
  'recon: B Trophy | Clear the site with information.',
  'flash retake: B Tower > B Site | Flash and retake together.',
  'duel: B Drop > B Site | Swing from B Drop at the same time.',
]);

// ---------------------------------------------------------------- Sunset

play('sunset', 'attack', 'A', 'hit', 'A hit through Main', 'Smokes on A Link and A Alley, then clear A Elbow and take the site.', [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Link and A Alley from A Lobby.',
  'recon: A Lobby > A Main | Clear A Main and A Elbow with information.',
  'entry flash: A Lobby > A Main > A Site | Take A Elbow and the site with flashes.',
  'postplant: A Lobby > A Main | Hold the plant from A Main.',
]);
play('sunset', 'attack', 'A', 'fake', 'Show B, hit A', 'Utility in B Main pulls defenders toward B, then the team hits A Main.', [
  'lurk: B Lobby > B Main | Make noise in B Main with utility to pull defenders toward B, then hold the flank.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Link and A Alley once B has drawn attention.',
  'entry flash: A Lobby > A Main > A Site | Hit A Main together as the rotation commits to B, and take A Elbow on the way.',
  'postplant: A Lobby > A Main | Hold the plant from A Main.',
]);
play('sunset', 'attack', 'A', 'split', 'A split through Link', 'Mid players pinch through A Link as the rest hit A Main.', [
  'recon lurk: Mid Bottom > Mid Courtyard > Mid Top > A Link | Take mid and pinch through A Link as the hit starts.',
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Alley and the back of the site.',
  'entry flash: A Lobby > A Main > A Site | Hit A Main when mid is ready.',
]);
play('sunset', 'attack', 'B', 'hit', 'B hit through Main', 'Smokes on B Boba and B Market, then a fast take through B Main.', [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Boba and B Market from B Lobby.',
  'clear: B Lobby > B Main | Clear B Main and the site corners with utility.',
  'entry flash: B Lobby > B Main > B Site | Take the site with flashes.',
  'postplant: B Lobby > B Main | Hold the plant from B Main.',
]);
play('sunset', 'attack', 'B', 'split', 'B split through Market', 'Mid players come through B Market as the rest hit B Main.', [
  'recon lurk: Mid Bottom > Mid Courtyard > B Market | Take mid and push B Market as the hit starts.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Boba.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main when B Market is ready.',
]);
play('sunset', 'attack', null, 'default', 'Take mid first', 'Mid connects to both sites, and winning it opens splits through B Market and A Link.', [
  'recon: Mid Courtyard | Gather information on mid, since it connects to both sites.',
  'duel: Mid Tiles | Hold Mid Tiles for picks.',
  'flank: B Lobby | Watch B Main and the flank.',
  'smoke: Attacker Side Spawn | Keep your smokes for the hit.',
  'entry: A Lobby | Wait at A Lobby, ready to hit either site.',
]);
play('sunset', 'defense', null, 'setup', 'Two on A, one mid, two on B', 'The standard hold, with a smoker in mid.', [
  'anchor: A Site | Hold A with your setup on A Main and A Elbow.',
  'recon: A Link | Gather information on A Main and mid from A Link.',
  'smoke: Mid Top | Play mid with smokes ready for either site.',
  'stall: B Site | Hold B and slow B Main.',
  'duel: B Market | Hold B Market and mid.',
]);
midControl('sunset', 'Mid Courtyard', 'Mid Top');
play('sunset', 'defense', 'A', 'retake', 'Retake A', 'Retake from A Link with A Alley swinging at the same time.', [
  'smoke: A Alley | Smoke A Main and A Elbow from A Alley.',
  'recon: A Link | Clear the site with information.',
  'flash retake: A Link > A Site | Flash and retake together.',
  'duel: A Alley > A Site | Swing from A Alley at the same time.',
]);
play('sunset', 'defense', 'B', 'retake', 'Retake B', 'Retake from B Boba with B Market swinging at the same time.', [
  'smoke: B Boba | Smoke B Main from B Boba.',
  'recon: B Market | Clear the site with information.',
  'flash retake: B Boba > B Site | Flash and retake together.',
  'duel: B Market > B Site | Swing from B Market at the same time.',
]);

// ---------------------------------------------------------------- defense by site

/**
 * What defense needs to know about a site for its setups: the way most hits come in (`way`) and the
 * spot that holds it (`angle`); where the site's smoker stands (`smoke`, a route); where one player
 * can watch it alone and stay alive (`watch`); two ways in for a retake (`retake`); what a retake
 * smokes off (`cut`, callouts in words); and where its one player stands when the team plays
 * elsewhere (`hold`, the site itself unless set).
 */
interface SiteHold { way: string; angle: string; smoke: string; watch: string; retake: readonly [string, string]; cut: string; hold?: string }
/** Every site's hold, and where the fifth player gathers information on a two-site map (a spot and its words, by site when it differs). */
interface MapHolds { sites: Partial<Record<SiteId, SiteHold>>; mid?: readonly [string, string] | Partial<Record<SiteId, readonly [string, string]>> }
/** Each map's holds, kept for the plays written after the setups. */
const HOLDS = new Map<string, MapHolds>();
/** A site's hold on a map, from its setups (throws when there's none, so a bad edit fails the tests). */
const holdOf = (map: string, site: SiteId): SiteHold => {
  const h = HOLDS.get(map)?.sites[site];
  if (!h) throw new Error(`${map}: no hold for ${site}`);
  return h;
};

/**
 * For each site, three setups, so defense has as many choices as attack: a stack (three on the
 * site, the rest light), an early push in front of it for a pick and information, and a setup that
 * gives it up lightly to win it back with a retake.
 */
function siteSetups(map: string, h: MapHolds) {
  HOLDS.set(map, h);
  const ids = Object.keys(h.sites) as SiteId[];
  for (const id of ids) {
    const s = h.sites[id]!;
    const others = ids.filter((x) => x !== id).map((x) => ({ id: x, at: h.sites[x]!.hold ?? `${x} Site` }));
    const [o1, o2] = [others[0]!, others[1]];
    const mid = !h.mid ? undefined : Array.isArray(h.mid) ? h.mid as readonly [string, string] : (h.mid as Partial<Record<SiteId, readonly [string, string]>>)[id];
    const fifth = o2
      ? `recon: ${o2.at} | Hold ${o2.id} alone, watch ${h.sites[o2.id]!.way} with information, call the hit early and stay alive until help comes.`
      : `recon: ${mid![0]} | Gather information on ${mid![1]} and call where they go, then rotate toward ${id} if the hit comes there.`;
    play(map, 'defense', id, 'stack', `Stack ${id}`, `Three hold ${id}, so a hit there meets a full site, while ${o2 ? 'one player holds each other site' : `one player holds ${o1.id}`} and plays for time.`, [
      `anchor: ${id} Site | Hold ${id} with your setup and call the hit as it comes.`,
      `duel: ${s.angle} | Hold ${s.way} from ${s.angle}, with an Operator if you have one.`,
      `smoke@hit: ${s.smoke} | Smoke ${s.way} as they come out of it, so they walk into the stack blind.`,
      `stall: ${o1.at} | Hold ${o1.id} alone, slow a hit with utility and call it early.`,
      fifth,
    ]);
    play(map, 'defense', id, 'push', `Push ${s.way} early`, `Two take an early fight in ${s.way} for a pick and information, then fall back to ${id} before the hit comes.`, o2 ? [
      `entry flash: ${id} Site > ${s.way} | Flash up ${s.way} early, take the first fight and fall back if it goes wrong.`,
      `recon: ${s.angle} | Gather information for the push from ${s.angle}, then hold ${id} as the pushers come back.`,
      `stall: ${o1.at} | Hold ${o1.id} alone and slow a rush until help arrives.`,
      `anchor: ${o2.at} | Hold ${o2.id} alone with your setup and call the hit early.`,
    ] : [
      `entry recon: ${id} Site > ${s.way} | Push up ${s.way} early with information and take the first fight.`,
      `flash: ${id} Site > ${s.way} | Flash ${s.way} for the push and trade the first fight.`,
      `duel: ${s.angle} | Cover the push from ${s.angle}, then hold ${id} as the pushers fall back.`,
      `stall: ${o1.at} | Hold ${o1.id} alone and slow a rush until help arrives.`,
    ]);
    play(map, 'defense', id, 'fallback', `Play ${id} for the retake`, `One player watches ${id} and stays alive while the rest wait out of reach, then the team retakes it together once the Spike is down.`, [
      `recon: ${s.watch} | Watch ${s.way} alone with information, call the hit and stay alive without taking the fight.`,
      `smoke@late: ${s.smoke} | Smoke ${s.cut} once the Spike is down, so the retake only faces the site.`,
      ...(o2 ? [
        `retake: ${s.retake[0]} | Wait out of reach, then retake ${id} together behind the smokes.`,
        `anchor: ${o1.at} | Hold ${o1.id} with your setup while ${id} is played for the retake.`,
        `stall: ${o2.at} | Hold ${o2.id} alone and slow a hit there until help arrives.`,
      ] : [
        `flash@late: ${s.retake[0]} | Flash the site for the retake and go in with it.`,
        `retake: ${s.retake[1]} | Retake ${id} together from a second way in as the flash goes.`,
        `anchor: ${o1.at} | Hold ${o1.id} with your setup while ${id} is played for the retake.`,
      ]),
    ]);
  }
}

siteSetups('abyss', { mid: ['Mid Top', 'mid'], sites: {
  A: { way: 'A Main', angle: 'A Tower', smoke: 'Defender Side Spawn > A Link', watch: 'A Tower', retake: ['Defender Side Spawn > A Security > A Site', 'Defender Side Spawn > A Link > A Site'], cut: 'A Main and A Lobby' },
  B: { way: 'B Main', angle: 'B Tower', smoke: 'Defender Side Spawn > B Link', watch: 'B Tower', retake: ['Defender Side Spawn > B Link > B Site', 'Defender Side Spawn > B Tower > B Site'], cut: 'B Main and B Nest' },
} });
siteSetups('ascent', { mid: ['Mid Pizza', 'mid'], sites: {
  A: { way: 'A Main', angle: 'A Rafters', smoke: 'Defender Side Spawn > A Garden', watch: 'A Rafters', retake: ['Defender Side Spawn > A Garden > A Site', 'Defender Side Spawn > A Rafters > A Site'], cut: 'A Main and A Tree' },
  B: { way: 'B Main', angle: 'B Boat House', smoke: 'Defender Side Spawn > Mid Market', watch: 'Mid Market', retake: ['Mid Pizza > Mid Market > B Site', 'Defender Side Spawn > B Boat House > B Site'], cut: 'B Main and B Lobby' },
} });
siteSetups('bind', { mid: { A: ['B Elbow', 'B'], B: ['A Lamps', 'A'] }, sites: {
  A: { way: 'A Short', angle: 'A Tower', smoke: 'Defender Side Spawn > A Lamps', watch: 'A Tower', retake: ['Defender Side Spawn > A Lamps > A Site', 'Defender Side Spawn > A Tower > A Site'], cut: 'A Short and A Bath' },
  B: { way: 'B Long', angle: 'B Elbow', smoke: 'Defender Side Spawn > B Hall', watch: 'B Elbow', retake: ['Defender Side Spawn > B Hall > B Site', 'Defender Side Spawn > B Elbow > B Site'], cut: 'B Long and B Window' },
} });
siteSetups('breeze', { mid: ['Mid Nest', 'mid'], sites: {
  A: { way: 'A Shop', angle: 'A Pyramids', smoke: 'Defender Side Spawn > A Bridge', watch: 'A Bridge', retake: ['Defender Side Spawn > A Ramp > A Site', 'Defender Side Spawn > A Bridge > A Site'], cut: 'A Shop and A Lobby' },
  B: { way: 'B Main', angle: 'B Elbow', smoke: 'Defender Side Spawn > Defender Side Arches', watch: 'B Elbow', retake: ['Defender Side Spawn > B Elbow > B Site', 'Mid Nest > B Tunnel > B Site'], cut: 'B Main and B Window' },
} });
siteSetups('corrode', { mid: ['Mid Window', 'mid'], sites: {
  A: { way: 'A Main', angle: 'A Crane', smoke: 'Defender Side Spawn > A Elbow', watch: 'A Crane', retake: ['Defender Side Spawn > A Elbow > A Site', 'Mid Window > A Link > A Site'], cut: 'A Main and A Yard' },
  B: { way: 'B Main', angle: 'B Tower', smoke: 'Defender Side Spawn > B Elbow', watch: 'B Tower', retake: ['Defender Side Spawn > B Elbow > B Site', 'Mid Window > B Link > B Site'], cut: 'B Main and B Arch' },
} });
siteSetups('fracture', { mid: { A: ['B Generator', 'B'], B: ['A Dish', 'A'] }, sites: {
  A: { way: 'A Main', angle: 'A Link', smoke: 'Defender Side Spawn > A Link', watch: 'A Link', retake: ['Defender Side Spawn > A Link > A Site', 'A Dish > A Site'], cut: 'A Main and A Drop' },
  B: { way: 'B Main', angle: 'B Tower', smoke: 'Defender Side Spawn > B Link', watch: 'B Tower', retake: ['Defender Side Spawn > B Link > B Site', 'B Canteen > B Site'], cut: 'B Tree and B Arcade' },
} });
siteSetups('haven', { sites: {
  A: { way: 'A Long', angle: 'A Tower', smoke: 'Defender Side Spawn > A Link', watch: 'A Tower', retake: ['Defender Side Spawn > A Link > A Site', 'Defender Side Spawn > A Tower > A Site'], cut: 'A Long and A Sewer' },
  B: { way: 'Mid Courtyard', angle: 'B Back', smoke: 'Defender Side Spawn > B Back', watch: 'B Back', retake: ['Defender Side Spawn > B Back > B Site', 'A Link > B Site'], cut: 'Mid Courtyard and Mid Window' },
  C: { way: 'C Long', angle: 'C Cubby', smoke: 'Defender Side Spawn > C Link', watch: 'C Cubby', retake: ['Defender Side Spawn > C Link > C Site', 'C Window > C Site'], cut: 'C Long and C Garage' },
} });
siteSetups('icebox', { mid: ['Mid Boiler', 'mid'], sites: {
  A: { way: 'A Belt', angle: 'A Rafters', smoke: 'Defender Side Spawn > A Screen', watch: 'A Rafters', retake: ['Defender Side Spawn > A Screen > A Site', 'Defender Side Spawn > A Rafters > A Site'], cut: 'A Belt and A Pipes' },
  B: { way: 'B Yellow', angle: 'B Back', smoke: 'Defender Side Spawn > B Kitchen', watch: 'B Back', retake: ['Defender Side Spawn > B Hall > B Site', 'B Kitchen > B Site'], cut: 'B Yellow and B Orange' },
} });
siteSetups('lotus', { sites: {
  A: { way: 'A Main', angle: 'A Stairs', smoke: 'Defender Side Spawn > A Stairs', watch: 'A Top', retake: ['Defender Side Spawn > A Drop > A Site', 'Defender Side Spawn > A Link > A Tree > A Site'], cut: 'A Main and A Rubble' },
  B: { way: 'B Main', angle: 'B Upper', smoke: 'Defender Side Spawn > B Upper', watch: 'B Upper', retake: ['Defender Side Spawn > B Upper > B Site', 'C Link > B Pillars > B Site'], cut: 'B Main' },
  C: { way: 'C Main', angle: 'C Waterfall', smoke: 'Defender Side Spawn > C Hall', watch: 'C Waterfall', retake: ['Defender Side Spawn > C Hall > C Site', 'C Link > C Site'], cut: 'C Main and C Mound' },
} });
siteSetups('pearl', { mid: ['Defender Side Water', 'mid'], sites: {
  A: { way: 'A Main', angle: 'A Secret', smoke: 'Defender Side Spawn > A Flowers', watch: 'A Flowers', retake: ['Defender Side Spawn > A Flowers > A Site', 'Defender Side Spawn > A Secret > A Site'], cut: 'A Main and A Link' },
  B: { way: 'B Main', angle: 'B Tower', smoke: 'Defender Side Spawn > B Tunnel', watch: 'B Tower', retake: ['Defender Side Spawn > B Tunnel > B Site', 'Defender Side Spawn > B Hall > B Site'], cut: 'B Main and B Screen' },
} });
siteSetups('split', { mid: ['Mid Vent', 'mid'], sites: {
  A: { way: 'A Main', angle: 'A Tower', smoke: 'Defender Side Spawn > A Screens', watch: 'A Tower', retake: ['Defender Side Spawn > A Tower > A Site', 'Defender Side Spawn > A Screens > A Site'], cut: 'A Main and A Ramps' },
  B: { way: 'B Garage', angle: 'B Tower', smoke: 'Defender Side Spawn > B Stairs', watch: 'B Tower', retake: ['Defender Side Spawn > B Tower > B Site', 'Defender Side Spawn > B Alley > B Site'], cut: 'B Garage and B Lobby' },
} });
siteSetups('summit', { mid: ['Mid Window', 'mid'], sites: {
  A: { way: 'A Main', angle: 'A Art', smoke: 'Defender Side Spawn > A Hall', watch: 'A Cave', retake: ['Defender Side Spawn > A Art > A Site', 'Defender Side Spawn > A Cave > A Site'], cut: 'A Main and A Link' },
  B: { way: 'B Main', angle: 'B Tower', smoke: 'Defender Side Spawn > B Gym', watch: 'B Tower', retake: ['Defender Side Spawn > B Tower > B Site', 'Defender Side Spawn > B Gym > B Site'], cut: 'B Main and B Link' },
} });
siteSetups('sunset', { mid: ['Mid Top', 'mid'], sites: {
  A: { way: 'A Main', angle: 'A Alley', smoke: 'Defender Side Spawn > A Link', watch: 'A Alley', retake: ['Defender Side Spawn > A Link > A Site', 'Defender Side Spawn > A Alley > A Site'], cut: 'A Main and A Elbow' },
  B: { way: 'B Main', angle: 'B Boba', smoke: 'Defender Side Spawn > B Market', watch: 'B Market', retake: ['Defender Side Spawn > B Boba > B Site', 'Defender Side Spawn > B Market > B Site'], cut: 'B Main' },
} });

// ---------------------------------------------------------------- pistol and eco rounds
// For every map: a pistol-round play and an eco play for each side. With little to
// spend, a team plays together and close, where a pistol can win a fight (see BUY_GUIDE).

const PISTOL_ATTACK = 'On the pistol round, five together win the first fights with numbers';
const PISTOL_DEFENSE = 'On the pistol round, close angles win fights';
const ECO_ATTACK = 'Low on credits, play together and close';
const ECO_DEFENSE = 'Low on credits, three hide in close corners on one site, where a pistol can beat a rifle';

play('abyss', 'attack', 'B', 'pistol', 'Five through B Main', `${PISTOL_ATTACK}. B Main is short, so the hit lands before a rotation does.`, [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower from B Lobby, so the hit only faces the site.',
  'flash: B Lobby > B Main | Flash B Danger and the site corners as the entry goes.',
  'entry: B Lobby > B Main > B Site | Go in first and clear B Danger, with the team trading right behind you.',
  'clear: B Lobby > B Main > B Site | Clear the rest of the site and plant behind cover.',
  'postplant: B Lobby > B Main > B Nest | Hold the plant from B Nest, close enough to trade.',
]);
play('abyss', 'attack', 'A', 'eco', 'One close fight in A Main', `${ECO_ATTACK}. Take one fight in A Main, where it’s close, trade every kill, and plant if the site opens.`, [
  'recon: A Lobby | Gather information on A Main before anyone peeks, and call where they are.',
  'flash: A Lobby > A Main | Flash the first fight with what you have.',
  'entry: A Lobby > A Main | Take the first fight in A Main up close, and stay off the long angles.',
  'duel: A Lobby > A Main | Stay right behind the entry and trade the first kill.',
  'lurk: Mid Bend > Mid Catwalk | Look for one close pick in mid, then join the others for the plant.',
]);
play('abyss', 'defense', null, 'pistol', 'Two and two, one to retake', `${PISTOL_DEFENSE}. Two hold each site close to its way in, and one waits between them to retake with the rotation.`, [
  'anchor: A Secret | Hold A from a close angle at A Secret and call the hit.',
  'duel: A Tower | Play A Main close from A Tower, and fall back if they come five.',
  'stall: B Site | Hold B close and slow the hit with what you have.',
  'duel: B Tower | Play B Main close from B Tower and trade the site player.',
  'retake: Defender Side Spawn > A Link | Wait between the sites and retake together with the rotation.',
]);
play('abyss', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Danger | Hide close at B Danger and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade the first fight.',
  'stall: B Tower | Slow the hit with what you have, then fight up close.',
  'recon: A Tower | Watch A Main alone, call a hit early and stay out of far fights.',
  'flank: Mid Top | Watch mid, then come in behind the B hit.',
]);

play('bind', 'attack', 'A', 'pistol', 'Five through Showers', `${PISTOL_ATTACK}. A Bath (Showers) is close to spawn and opens straight onto a small site.`, [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Tower (Heaven) and A Lamps from A Lobby.',
  'flash: A Lobby > A Bath | Flash out of A Bath (Showers) as the entry goes.',
  'entry: A Lobby > A Bath > A Site | Go out first and clear the close corners, with the team trading right behind you.',
  'clear: A Lobby > A Bath > A Site | Clear A Cubby and plant behind cover.',
  'lurk: A Link > A Short | Push A Short as the hit lands, so A Lamps faces two ways.',
]);
play('bind', 'attack', 'B', 'eco', 'Take Hookah close', `${ECO_ATTACK}. B Window (Hookah) is a tight room where a pistol wins fights. Trade every kill, and plant if the site opens.`, [
  'flash: B Short | Flash into B Window (Hookah) as the entry goes.',
  'entry: B Short > B Window | Push into B Window (Hookah) and take the first close fight.',
  'duel: B Short > B Window | Trade the entry at once, since fights in Hookah are close.',
  'clear: B Short > B Window > B Site | Once Hookah falls, go onto the site and plant.',
  'flank: B Fountain | Watch B Long and B Fountain for a push behind you.',
]);
play('bind', 'defense', null, 'pistol', 'Two and two, one between', `${PISTOL_DEFENSE}. Two hold each site close, and one waits between them, ready to retake whichever is hit.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'stall: A Lamps | Slow A Short and A Bath (Showers) from A Lamps.',
  'duel: B Site | Hold B Long close from the site.',
  'stall: B Garden | Slow B Window (Hookah) from B Garden.',
  'retake: Defender Side Spawn | Wait between the sites and retake together with the rotation.',
]);
play('bind', 'defense', 'A', 'eco', 'Stack A close', `${ECO_DEFENSE}. One watches B and one waits between the sites.`, [
  'duel: A Cubby | Hide in A Cubby and fight the first player through A Short.',
  'duel: A Site | Play a close corner on the site and trade.',
  'stall: A Lamps | Slow A Bath (Showers), then fight up close.',
  'recon: B Garden | Watch B Long alone, call a hit early and stay out of far fights.',
  'retake: Defender Side Spawn | Wait between the sites and come in behind whichever hit comes.',
]);

play('corrode', 'attack', 'B', 'pistol', 'Five through B Main', `${PISTOL_ATTACK}. B Main leads straight onto a site ringed by corners, so clear them as a group.`, [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower and B Arch from B Lobby.',
  'flash: B Lobby > B Main | Flash B Elbow and the site corners as the entry goes.',
  'entry: B Lobby > B Main > B Site | Go in first and clear B Elbow, with the team trading right behind you.',
  'clear: B Lobby > B Main > B Site | Clear the rest of the site and plant behind cover.',
  'postplant: B Lobby > B Main | Hold the plant from B Main, close enough to trade.',
]);
play('corrode', 'attack', 'A', 'eco', 'One close fight in A Yard', `${ECO_ATTACK}. A Yard’s corners are close, so a pistol can win the first fight there. Trade every kill, and plant if the site opens.`, [
  'recon: A Lobby > A Main | Gather information on A Yard before anyone peeks.',
  'flash: A Lobby > A Main | Flash the first fight with what you have.',
  'entry: A Lobby > A Main > A Yard | Take the first close fight in A Yard.',
  'duel: A Lobby > A Main > A Yard | Trade the entry at once.',
  'flank: Mid Bottom | Watch mid for a push behind the team.',
]);
play('corrode', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Two hold each site close, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Crane | Play A Main close from A Crane.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Tower | Play B Main close from B Tower.',
  'retake: Mid Window | Watch mid from Mid Window and retake together with the rotation.',
]);
play('corrode', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Elbow | Hide close at B Elbow and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: B Tower | Slow B Main, then fight up close.',
  'recon: A Crane | Watch A Main alone, call a hit early and stay out of far fights.',
  'flank: Mid Window | Watch mid, then come in behind the B hit through B Link.',
]);

play('haven', 'attack', 'C', 'pistol', 'Five down C Long', `${PISTOL_ATTACK}. C Long is wide enough for five to cross together.`, [
  'smoke: Attacker Side Spawn > C Lobby | Smoke C Link and C Window from C Lobby.',
  'flash: C Lobby > C Long | Flash C Long and the site corners as the entry goes.',
  'entry: C Lobby > C Long > C Site | Go in first and clear C Cubby, with the team trading right behind you.',
  'clear: C Lobby > C Long > C Site | Clear the rest of the site and plant behind cover.',
  'flank: Mid Doors > C Garage | Watch C Garage so no one comes round behind the plant.',
]);
play('haven', 'attack', 'B', 'eco', 'Take B close through mid', `${ECO_ATTACK}. B through mid is short and its fights are close. Trade every kill, and plant if the site opens.`, [
  'recon: Mid Window > Mid Courtyard | Gather information on B before anyone peeks.',
  'flash: Mid Courtyard | Flash B Back with what you have as the entry goes.',
  'entry: Mid Courtyard > B Site | Take the first close fight on B.',
  'duel: Mid Courtyard > B Site | Trade the entry at once.',
  'flank: Mid Doors | Watch Mid Doors and C Garage for a push behind the team.',
]);
play('haven', 'defense', null, 'pistol', 'One on each site, two to retake', `${PISTOL_DEFENSE}. One holds each site close, and two wait on the links to retake together with the site player.`, [
  'anchor: A Site | Hold A close and call the hit early.',
  'duel: Mid Window | Play mid close from Mid Window, then fall back to B.',
  'stall: C Site | Hold C close and slow the hit.',
  'retake: A Link | Wait at A Link and retake A or B together.',
  'retake: C Link | Wait at C Link and retake C or B together.',
]);
play('haven', 'defense', 'C', 'eco', 'Stack C close', `${ECO_DEFENSE}. One watches A and one mid from a distance.`, [
  'duel: C Cubby | Hide in C Cubby and fight the first player off C Long.',
  'duel: C Site | Play a close corner on the site and trade.',
  'stall: C Window | Slow the hit from C Window, then fight up close.',
  'recon: A Link | Watch A Long alone, call a hit early and stay out of far fights.',
  'flank: Mid Window | Watch mid and B, then come in behind the C hit.',
]);

play('lotus', 'attack', 'B', 'pistol', 'Five through B Main', `${PISTOL_ATTACK}. B is small and quick to take, so plant fast and hold it close.`, [
  'smoke: Attacker Side Spawn > B Pillars | Smoke B Upper and A Link from B Pillars.',
  'flash: B Pillars > B Main | Flash the site as the entry goes.',
  'entry: B Pillars > B Main > B Site | Go in first with the team right behind you to trade.',
  'clear: B Pillars > B Main > B Site | Clear the site corners and plant behind cover.',
  'postplant: B Pillars | Hold the plant from B Pillars and B Main, close enough to trade.',
]);
play('lotus', 'attack', 'A', 'eco', 'One close fight in A Main', `${ECO_ATTACK}. A Main and A Rubble are tight, so a pistol can win the first fight. Trade every kill, and plant if the site opens.`, [
  'recon: A Lobby > A Root | Gather information on A Main before anyone peeks.',
  'flash: A Lobby > A Root | Flash the first fight with what you have.',
  'entry: A Root > A Main | Take the first close fight in A Main.',
  'duel: A Root > A Main | Trade the entry at once.',
  'lurk: A Lobby > A Rubble | Look for a close pick in A Rubble, then join the plant.',
]);
play('lotus', 'defense', null, 'pistol', 'One on each site, two to retake', `${PISTOL_DEFENSE}. One holds each site close, and two wait at A Link and C Link to retake together, since the rotating doors make the way between the sites short.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'stall: B Site | Hold B close and slow a rush.',
  'duel: C Site | Hold C close from the site and call the hit.',
  'retake: A Link | Wait at A Link and retake A or B together.',
  'retake: C Link | Wait at C Link and retake B or C together.',
]);
play('lotus', 'defense', 'A', 'eco', 'Stack A close', `${ECO_DEFENSE}. One watches B and one C from a distance.`, [
  'duel: A Hut | Hide in A Hut and fight the first player in.',
  'duel: A Site | Play a close corner on the site and trade.',
  'stall: A Stairs | Slow A Main from A Stairs, then fight up close.',
  'recon: C Waterfall | Watch C Main alone, call a hit early and stay out of far fights.',
  'flank: B Upper | Watch B, then come in behind the A hit through A Link.',
]);

play('summit', 'attack', 'A', 'pistol', 'Five through A Main', `${PISTOL_ATTACK}. Take A Garden as a group and the site falls with it.`, [
  'smoke: Attacker Side Spawn > A Lobby | Smoke A Hall and A Cave from A Lobby.',
  'flash: A Lobby > A Main | Flash A Garden and the site as the entry goes.',
  'entry: A Lobby > A Main > A Garden > A Site | Go in first with the team right behind you to trade.',
  'clear: A Lobby > A Main > A Garden > A Site | Clear the site corners and plant behind cover.',
  'postplant: A Lobby > A Main | Hold the plant from A Main, close enough to trade.',
]);
play('summit', 'attack', 'B', 'eco', 'One close fight in B Main', `${ECO_ATTACK}. Take one fight in B Main, where it’s close, trade every kill, and plant if the site opens.`, [
  'recon: B Lobby > B Main | Gather information on B Main before anyone peeks.',
  'flash: B Lobby | Flash the first fight with what you have.',
  'entry: B Lobby > B Main | Take the first close fight in B Main.',
  'duel: B Lobby > B Main | Trade the entry at once.',
  'flank: Mid Tiles | Watch mid for a push behind the team.',
]);
play('summit', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Two hold each site close, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Hall | Play A Main close from A Hall.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Tower | Play B Main close from B Tower.',
  'retake: Mid Window | Watch mid from Mid Window and retake together with the rotation.',
]);
play('summit', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Drop | Hide at B Drop and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: B Tower | Slow B Main, then fight up close.',
  'recon: A Hall | Watch A Main alone, call a hit early and stay out of far fights.',
  'flank: Mid Window | Watch mid, then come in behind the B hit through B Link.',
]);

play('sunset', 'attack', 'B', 'pistol', 'Five through B Main', `${PISTOL_ATTACK}. B Main is short and opens straight onto the site.`, [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Boba and B Market from B Lobby.',
  'flash: B Lobby > B Main | Flash the site corners as the entry goes.',
  'entry: B Lobby > B Main > B Site | Go in first with the team right behind you to trade.',
  'clear: B Lobby > B Main > B Site | Clear the site corners and plant behind cover.',
  'postplant: B Lobby > B Main | Hold the plant from B Main, close enough to trade.',
]);
play('sunset', 'attack', 'A', 'eco', 'One close fight in A Main', `${ECO_ATTACK}. Take one fight in A Main, where it’s close, trade every kill, and plant if the site opens.`, [
  'recon: A Lobby > A Main | Gather information on A Main before anyone peeks.',
  'flash: A Lobby | Flash the first fight with what you have.',
  'entry: A Lobby > A Main | Take the first close fight in A Main.',
  'duel: A Lobby > A Main | Trade the entry at once.',
  'flank: Mid Bottom | Watch mid for a push behind the team.',
]);
play('sunset', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Two hold each site close, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Link | Play A Main and mid close from A Link.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Market | Play B Main and mid close from B Market.',
  'retake: Mid Top | Watch mid from Mid Top and retake together with the rotation.',
]);
play('sunset', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Boba | Hide in B Boba and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: B Market | Slow the hit from B Market, then fight up close.',
  'recon: A Link | Watch A Main alone, call a hit early and stay out of far fights.',
  'flank: Mid Top | Watch mid, then come in behind the B hit.',
]);

play('ascent', 'attack', 'B', 'pistol', 'Five through B Main', `${PISTOL_ATTACK}. B Main is short and opens straight onto the site.`, [
  'smoke: Attacker Side Spawn > B Lobby | Smoke Mid Market and B Boat House from B Lobby, so the hit only faces the site.',
  'flash: B Lobby > B Main | Flash the site corners as the entry goes.',
  'entry: B Lobby > B Main > B Site | Go in first with the team right behind you to trade.',
  'clear: B Lobby > B Main > B Site | Clear the rest of the site and plant behind cover.',
  'postplant: B Lobby > B Main | Hold the plant from B Main, close enough to trade.',
]);
play('ascent', 'attack', 'A', 'eco', 'One close fight in A Main', `${ECO_ATTACK}. Take one fight in A Main, where it’s close, trade every kill, and plant if the site opens.`, [
  'recon: A Lobby > A Main | Gather information on A Main before anyone peeks.',
  'flash: A Lobby | Flash the first fight with what you have.',
  'entry: A Lobby > A Main | Take the first close fight in A Main instead of peeking A Rafters from far off.',
  'duel: A Lobby > A Main | Trade the entry at once.',
  'flank: Mid Top | Watch mid for a push behind the team.',
]);
play('ascent', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Two hold each site close, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Rafters | Play A Main close from A Rafters, and fall back if they come five.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Boat House | Play B Main close from B Boat House and trade the site player.',
  'retake: Mid Market | Watch mid from Mid Market and retake together with the rotation.',
]);
play('ascent', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Boat House | Hide close at B Boat House and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: Mid Market | Slow the hit from Mid Market, then fight up close.',
  'recon: A Rafters | Watch A Main alone, call a hit early and stay out of far fights.',
  'flank: Mid Pizza | Watch mid, then come in behind the B hit.',
]);

play('breeze', 'attack', 'B', 'pistol', 'Five through B Main', `${PISTOL_ATTACK}. B Main is the narrowest way in on Breeze, so pistols fight at close range there.`, [
  'smoke: Attacker Side Spawn > B Main | Smoke B Tunnel and B Back from B Main, so the hit only faces the site.',
  'flash: B Main | Flash the site corners as the entry goes.',
  'entry: B Main > B Site | Go in first with the team right behind you to trade.',
  'clear: B Main > B Site | Clear the pillar and the close corners, and plant behind cover.',
  'postplant: B Main | Hold the plant from B Main, close enough to trade.',
]);
play('breeze', 'attack', 'A', 'eco', 'One close fight in A Shop', `${ECO_ATTACK}. A Shop is a small room on the way to A, where a pistol can win the first fight. Trade every kill, and plant if the site opens.`, [
  'recon: A Lobby > A Shop | Gather information on A Shop before anyone peeks.',
  'flash: A Lobby | Flash the first fight with what you have.',
  'entry: A Lobby > A Shop | Take the first close fight in A Shop instead of peeking the long angles on the site.',
  'duel: A Lobby > A Shop | Trade the entry at once.',
  'flank: Mid Bottom | Watch mid for a push behind the team.',
]);
play('breeze', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Breeze is long, so two hold each site from its close corners, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Pyramids | Play A Shop close from A Pyramids, and fall back if they come five.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Wall | Hold the site close from B Wall and trade the site player.',
  'retake: Mid Top | Watch mid from Mid Top and retake together with the rotation.',
]);
play('breeze', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Back | Hide close at B Back and fight the first player in.',
  'duel: B Site | Play a close corner by the pillar and trade.',
  'stall: B Wall | Slow the hit from B Wall, then fight up close.',
  'recon: A Bridge | Watch A Shop alone, call a hit early and stay out of far fights.',
  'flank: Mid Top | Watch mid, then come in behind the B hit through B Tunnel.',
]);

play('fracture', 'attack', 'B', 'pistol', 'Five through B Main', `${PISTOL_ATTACK}. B Main is close to the attackers’ spawn and comes onto the site from one side.`, [
  'smoke: Attacker Side Spawn > B Tree | Smoke B Tower and B Generator from B Tree, so the hit only faces the site.',
  'flash: B Tree > B Main | Flash the site corners as the entry goes.',
  'entry: B Tree > B Main > B Site | Go in first with the team right behind you to trade.',
  'clear: B Tree > B Main > B Site | Clear the rest of the site and plant behind cover.',
  'postplant: B Tree > B Main | Hold the plant from B Main, close enough to trade.',
]);
play('fracture', 'attack', 'A', 'eco', 'One close fight in A Main', `${ECO_ATTACK}. Take one fight in A Main, where it’s close, trade every kill, and plant if the site opens.`, [
  'recon: A Hall | Gather information on A Main before anyone peeks.',
  'flash: A Hall > A Main | Flash the first fight with what you have.',
  'entry: A Hall > A Main | Take the first close fight in A Main.',
  'duel: A Hall > A Main | Trade the entry at once.',
  'flank: A Rope | Watch A Rope for a push behind the team.',
]);
play('fracture', 'defense', null, 'pistol', 'Two and two, one in the middle', `${PISTOL_DEFENSE}. Two hold each site close, and one waits in the middle of the map, ready to retake whichever is hit.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Drop | Hold A Dish close from A Drop, and fall back if they come five.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Tower | Play B Main close from B Tower and trade the site player.',
  'retake: Defender Side Spawn | Wait in the middle and retake together with the rotation.',
]);
play('fracture', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. One watches A and one waits in the middle.`, [
  'duel: B Tower | Hide close at B Tower and fight the first player in from B Main.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: B Generator | Slow B Arcade from B Generator, then fight up close.',
  'recon: A Drop | Watch A Dish alone, call a hit early and stay out of far fights.',
  'retake: B Link | Wait in B Link and come in behind the B hit.',
]);

play('icebox', 'attack', 'B', 'pistol', 'Five through B Yellow', `${PISTOL_ATTACK}. B Yellow leads straight onto the site, and its corners are close enough for pistols.`, [
  'smoke: Attacker Side Spawn > B Yellow | Smoke B Kitchen and B Snowman from B Yellow, so the hit only faces the site.',
  'flash: B Yellow | Flash the site corners as the entry goes.',
  'entry: B Yellow > B Site | Go in first with the team right behind you to trade.',
  'clear: B Yellow > B Site | Clear the rest of the site and plant behind cover.',
  'postplant: B Yellow | Hold the plant from B Yellow, close enough to trade.',
]);
play('icebox', 'attack', 'A', 'eco', 'One close fight in A Nest', `${ECO_ATTACK}. Take one fight in A Nest, where it’s close, trade every kill, and plant if the site opens.`, [
  'recon: A Belt | Gather information on A Nest before anyone peeks.',
  'flash: A Belt > A Nest | Flash the first fight with what you have.',
  'entry: A Belt > A Nest | Take the first close fight in A Nest instead of peeking A Rafters from far off.',
  'duel: A Belt > A Nest | Trade the entry at once.',
  'flank: Mid Blue | Watch mid for a push behind the team.',
]);
play('icebox', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Two hold each site close, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Screen | Play A Nest close from A Screen, and fall back if they come five.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Snowman | Play B Yellow close from B Snowman and trade the site player.',
  'retake: Mid Boiler | Watch mid from Mid Boiler and retake together with the rotation.',
]);
play('icebox', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Back | Hide close at B Back and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: B Snowman | Slow B Yellow from B Snowman, then fight up close.',
  'recon: A Screen | Watch A Belt alone, call a hit early and stay out of far fights.',
  'flank: Mid Boiler | Watch mid, then come in behind the B hit through B Kitchen.',
]);

play('pearl', 'attack', 'A', 'pistol', 'Five through A Main', `${PISTOL_ATTACK}. A Main is narrow and comes out onto a site with close corners.`, [
  'smoke: Attacker Side Spawn > A Restaurant | Smoke A Flowers and A Secret from A Restaurant, so the hit only faces the site.',
  'flash: A Art > A Main | Flash the site corners as the entry goes.',
  'entry: A Art > A Main > A Site | Go in first with the team right behind you to trade.',
  'clear: A Art > A Main > A Site | Clear A Dugout and the close corners, and plant behind cover.',
  'postplant: A Art > A Main | Hold the plant from A Main, close enough to trade.',
]);
play('pearl', 'attack', 'B', 'eco', 'One close fight at B Ramp', `${ECO_ATTACK}. Take one fight at the top of B Main from B Ramp, trade every kill, and plant if the site opens.`, [
  'recon: B Club > B Ramp | Gather information on B Main before anyone peeks.',
  'flash: B Ramp | Flash the first fight with what you have.',
  'entry: B Ramp > B Main | Take the first close fight at the top of B Main instead of peeking down the long lane.',
  'duel: B Ramp > B Main | Trade the entry at once.',
  'flank: Mid Plaza | Watch mid for a push behind the team.',
]);
play('pearl', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Two hold each site close, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Link | Play A Main close from A Link, and fall back if they come five.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Screen | Play B Main close from B Screen and trade the site player.',
  'retake: Mid Connector | Watch mid from Mid Connector and retake together with the rotation.',
]);
play('pearl', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Screen | Hide close at B Screen and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: B Hall | Slow the hit from B Hall, then fight up close.',
  'recon: A Link | Watch A Main alone, call a hit early and stay out of far fights.',
  'flank: Mid Connector | Watch mid, then come in behind the B hit through B Link.',
]);

play('split', 'attack', 'B', 'pistol', 'Five through B Garage', `${PISTOL_ATTACK}. B Garage is short and its fights are close.`, [
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower (B Heaven) and B Alley from B Lobby, so the hit only faces the site.',
  'flash: B Lobby > B Garage | Flash the site corners as the entry goes.',
  'entry: B Lobby > B Garage > B Site | Go in first with the team right behind you to trade.',
  'clear: B Lobby > B Garage > B Site | Clear B Back and the close corners, and plant behind cover.',
  'postplant: B Lobby > B Garage | Hold the plant from B Garage, close enough to trade.',
]);
play('split', 'attack', 'A', 'eco', 'One close fight in A Main', `${ECO_ATTACK}. Take one fight in A Main, where it’s close, trade every kill, and plant if the site opens.`, [
  'recon: A Lobby > A Main | Gather information on A Main before anyone peeks.',
  'flash: A Lobby | Flash the first fight with what you have.',
  'entry: A Lobby > A Main | Take the first close fight in A Main.',
  'duel: A Lobby > A Main | Trade the entry at once.',
  'flank: Mid Bottom | Watch mid for a push behind the team.',
]);
play('split', 'defense', null, 'pistol', 'Two and two, one in mid', `${PISTOL_DEFENSE}. Two hold each site close, one watches mid, and the retake goes in together.`, [
  'anchor: A Site | Hold A close and call the hit.',
  'duel: A Rafters | Play A Main close from A Rafters, and fall back if they come five.',
  'stall: B Site | Hold B close and slow the hit.',
  'duel: B Tower | Play B Garage close from B Tower (B Heaven) and trade the site player.',
  'retake: Mid Vent | Watch mid from Mid Vent and retake together with the rotation.',
]);
play('split', 'defense', 'B', 'eco', 'Stack B close', `${ECO_DEFENSE}. Two watch A and mid from a distance and stay alive.`, [
  'duel: B Back | Hide close at B Back and fight the first player in.',
  'duel: B Site | Play a close corner on the site and trade.',
  'stall: B Tower | Slow B Garage from B Tower (B Heaven), then fight up close.',
  'recon: A Tower | Watch A Main alone, call a hit early and stay out of far fights.',
  'flank: Mid Vent | Watch mid, then come in behind the B hit through B Stairs.',
]);

// ---------------------------------------------------------------- Fakes on the maps out of the pool
// The same shape as the pool's fakes: one player makes noise at one site to pull the rotation, and
// the rest hit the other as it commits.

play('ascent', 'attack', 'B', 'fake', 'Show A, hit B', 'Utility in A Main pulls defenders toward A, then the team hits B Main.', [
  'lurk: A Lobby > A Main | Make noise in A Main with utility to pull defenders toward A, then hold the flank.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke Mid Market and the back of B Site once A has drawn attention.',
  'entry flash: B Lobby > B Main > B Site | Hit B Main together as the rotation commits to A, checking B Boat House on the way.',
  'postplant: B Lobby > B Main | Hold the plant from B Main.',
]);
play('breeze', 'attack', 'B', 'fake', 'Show A, hit B', 'Utility in A Shop pulls defenders toward A, then the team hits B Main.', [
  'lurk: A Lobby > A Shop | Make noise in A Shop with utility to pull defenders toward A, then hold the flank.',
  'smoke: Attacker Side Spawn > B Main | Smoke B Tunnel and B Back once A has drawn attention.',
  'entry flash: B Main > B Site | Hit B Main together as the rotation commits to A.',
  'clear: B Window > B Elbow | Clear B Elbow with utility and join the site take.',
]);
play('fracture', 'attack', 'A', 'fake', 'Show B, hit A', 'Utility in B Arcade pulls defenders toward B, then the team drops onto A from A Dish.', [
  'lurk: Attacker Side Bridge > B Bench > B Arcade | Make noise in B Arcade with utility to pull defenders toward B, then hold there.',
  'smoke: Attacker Side Bridge > A Gate | Smoke A Link and A Hall once B has drawn attention.',
  'entry flash: A Gate > A Dish > A Drop > A Site | Drop into the site together as the rotation commits to B.',
  'flank: Attacker Side Spawn > A Main | Push A Main late to catch defenders rotating through it.',
]);
play('icebox', 'attack', 'B', 'fake', 'Show A, hit B', 'Utility in A Belt pulls defenders toward A, then the team hits B Yellow.', [
  'lurk: Attacker Side Spawn > A Belt | Make noise in A Belt with utility to pull defenders toward A, then hold the flank.',
  'smoke: Attacker Side Spawn > B Yellow | Smoke B Kitchen and B Snowman once A has drawn attention.',
  'entry flash: B Yellow > B Site | Hit B Yellow together as the rotation commits to A, checking B Fence on the way.',
  'recon: B Green > B Yellow | Clear the site with information as the team goes in.',
]);
play('pearl', 'attack', 'A', 'fake', 'Show B, hit A', 'Utility down B Main (B Long) pulls defenders toward B, then the team hits A Main.', [
  'lurk: B Ramp > B Main | Make noise in B Main (B Long) with utility to pull defenders toward B, then hold the flank.',
  'smoke: Attacker Side Spawn > A Restaurant | Smoke A Flowers and A Secret once B has drawn attention.',
  'entry flash: A Art > A Main > A Site | Hit A Main together as the rotation commits to B.',
  'postplant: A Restaurant > A Main | Hold the plant from A Main.',
]);
play('split', 'attack', 'B', 'fake', 'Show A, hit B', 'Utility in A Main pulls defenders toward A, then the team hits B Garage.', [
  'lurk: A Lobby > A Main | Make noise in A Main with utility to pull defenders toward A, then hold the flank.',
  'smoke: Attacker Side Spawn > B Lobby | Smoke B Tower (B Heaven) and B Alley once A has drawn attention.',
  'entry flash: B Lobby > B Garage > B Site | Hit B Garage together as the rotation commits to A.',
  'clear: B Garage > B Site | Clear B Back and the close corners with utility.',
]);

// ---------------------------------------------------------------- Simple plays, for any team
// One plan the whole team plays together, for teams that don't time utility between groups or call
// a change of plan mid-round (most teams below Silver, and anyone playing with strangers): on attack,
// all five go in one way, throw their utility at once and trade each other onto the site; on defense,
// two hold each site side by side so no one fights alone, and one waits to help whichever site is hit.

/** All five on one site, through `way` (callouts joined by ` > `, ending on the site), after a smoke thrown along `smokeFrom`. */
const together = (map: string, site: SiteId, smokeFrom: string, way: string, smokes: string, hold: string) => {
  const path = way.split(' > ');
  play(map, 'attack', site, 'hit', `Five together on ${site}`, `All five take ${site} through ${path[path.length - 2]} at once and trade each other in. Any team can run it.`, [
    `smoke: ${smokeFrom} | Smoke ${smokes} as the team walks out, all at once.`,
    `flash: ${way} | Flash the site the moment the team is ready to go in.`,
    `entry duel: ${way} | Go in together, with the first player taking the closest fight and the second trading right behind.`,
    `postplant: ${way} | Follow close, plant the Spike behind cover and hold it with the team from ${hold}.`,
  ]);
};
/** Two side by side on each of two sites (spots `[site, first, second]`), and one at `between` who goes to help. */
const inPairs = (map: string, one: readonly [SiteId, string, string], two: readonly [SiteId, string, string], between: string, wait: string) =>
  play(map, 'defense', null, 'setup', 'Hold in pairs', `Two players on ${one[0]} and two on ${two[0]}, close enough to trade each other, and one who goes where the hit is, so nobody fights alone.`, [
    `anchor: ${one[1]} | Hold a close angle on ${one[0]} with your utility down, near your partner.`,
    `recon: ${one[2]} | Hold beside your partner on ${one[0]}, call what comes through ${holdOf(map, one[0]).way} with information and trade whoever shoots them.`,
    `stall: ${two[1]} | Slow a hit on ${two[0]} with your utility and call it straight away.`,
    `duel: ${two[2]} | Hold beside your partner on ${two[0]}. If the site falls, back off together and wait for help.`,
    `smoke: ${between} | ${wait}, then smoke the site that is hit as soon as it’s called and help retake it.`,
  ]);
const SPAWN = 'Attacker Side Spawn', BETWEEN = 'Wait between the sites';

together('abyss', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Main > A Site', 'A Tower and A Link', 'A Main');
together('abyss', 'B', `${SPAWN} > B Lobby`, 'B Lobby > B Main > B Site', 'B Tower and B Link', 'B Main');
inPairs('abyss', ['A', 'A Site', 'A Tower'], ['B', 'B Site', 'B Tower'], 'Defender Side Spawn', BETWEEN);
together('ascent', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Main > A Site', 'A Rafters and A Tree', 'A Main');
together('ascent', 'B', `${SPAWN} > B Lobby`, 'B Lobby > B Main > B Site', 'Mid Market and the back of B Site', 'B Main');
inPairs('ascent', ['A', 'A Site', 'A Rafters'], ['B', 'B Site', 'B Boat House'], 'Defender Side Spawn', BETWEEN);
together('bind', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Bath > A Site', 'A Tower and A Cubby', 'A Bath');
together('bind', 'B', `${SPAWN} > B Fountain`, 'B Fountain > B Long > B Site', 'B Elbow and B Hall', 'B Long');
inPairs('bind', ['A', 'A Site', 'A Lamps'], ['B', 'B Site', 'B Garden'], 'Defender Side Spawn', BETWEEN);
together('breeze', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Shop > A Site', 'A Bridge and A Ramp', 'A Shop');
together('breeze', 'B', `${SPAWN} > B Main`, 'B Main > B Site', 'B Tunnel and the back of B Site', 'B Main');
inPairs('breeze', ['A', 'A Site', 'A Bridge'], ['B', 'B Site', 'B Wall'], 'Defender Side Spawn', BETWEEN);
together('corrode', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Main > A Yard > A Site', 'A Crane and A Link', 'A Yard');
together('corrode', 'B', `${SPAWN} > B Lobby`, 'B Lobby > B Main > B Site', 'B Tower and B Arch', 'B Main');
inPairs('corrode', ['A', 'A Site', 'A Crane'], ['B', 'B Site', 'B Tower'], 'Defender Side Spawn', BETWEEN);
together('fracture', 'A', 'Attacker Side Bridge > A Gate', 'A Gate > A Dish > A Drop > A Site', 'A Link and A Hall', 'A Drop');
together('fracture', 'B', 'Attacker Side Bridge > B Bench', 'B Bench > B Arcade > B Site', 'B Canteen and B Generator', 'B Arcade');
inPairs('fracture', ['A', 'A Site', 'A Dish'], ['B', 'B Site', 'B Generator'], 'Defender Side Spawn', BETWEEN);
together('haven', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Long > A Site', 'A Tower and A Link', 'A Long');
together('haven', 'C', `${SPAWN} > C Lobby`, 'C Lobby > C Long > C Site', 'C Link and C Window', 'C Long');
inPairs('haven', ['A', 'A Site', 'A Tower'], ['C', 'C Site', 'C Link'], 'B Site', 'Hold B alone and call a hit early');
together('icebox', 'A', `${SPAWN} > A Belt`, 'A Belt > A Nest > A Site', 'A Screen and A Rafters', 'A Nest');
together('icebox', 'B', `${SPAWN} > B Yellow`, 'B Yellow > B Site', 'B Kitchen and B Snowman', 'B Yellow');
inPairs('icebox', ['A', 'A Site', 'A Rafters'], ['B', 'B Site', 'B Kitchen'], 'Defender Side Spawn', BETWEEN);
together('lotus', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Root > A Main > A Site', 'A Tree and A Stairs', 'A Main');
together('lotus', 'C', `${SPAWN} > C Lobby`, 'C Lobby > C Mound > C Main > C Site', 'C Hall and C Waterfall', 'C Main');
inPairs('lotus', ['A', 'A Site', 'A Tree'], ['C', 'C Site', 'C Hall'], 'B Site', 'Hold B alone and call a hit early');
together('pearl', 'A', `${SPAWN} > A Restaurant`, 'A Art > A Main > A Site', 'A Flowers and A Secret', 'A Main');
together('pearl', 'B', `${SPAWN} > B Ramp`, 'B Ramp > B Main > B Site', 'B Hall and B Tower', 'B Main');
inPairs('pearl', ['A', 'A Site', 'A Link'], ['B', 'B Site', 'B Tower'], 'Defender Side Spawn', BETWEEN);
together('split', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Main > A Site', 'A Tower and A Screens', 'A Main');
together('split', 'B', `${SPAWN} > B Lobby`, 'B Lobby > B Garage > B Site', 'B Tower and B Alley', 'B Garage');
inPairs('split', ['A', 'A Site', 'A Tower'], ['B', 'B Site', 'B Tower'], 'Defender Side Spawn', BETWEEN);
together('summit', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Main > A Garden > A Site', 'A Hall and A Cave', 'A Main');
together('summit', 'B', `${SPAWN} > B Lobby`, 'B Lobby > B Main > B Site', 'B Tower and B Gym', 'B Main');
inPairs('summit', ['A', 'A Site', 'A Hall'], ['B', 'B Site', 'B Tower'], 'Defender Side Spawn', BETWEEN);
together('sunset', 'A', `${SPAWN} > A Lobby`, 'A Lobby > A Main > A Site', 'A Link and A Alley', 'A Main');
together('sunset', 'B', `${SPAWN} > B Lobby`, 'B Lobby > B Main > B Site', 'B Boba and B Market', 'B Main');
inPairs('sunset', ['A', 'A Site', 'A Link'], ['B', 'B Site', 'B Market'], 'Defender Side Spawn', BETWEEN);

// ---------------------------------------------------------------- Against an eco
// When the other team saves, rifles win at range and their shotguns and pistols win up close, where a
// saving team waits in the corners for a cheap kill and a rifle to pick up. So on attack the team
// checks the corners by the way in with information and flashes them before walking past, goes in
// together and holds the Spike from out of shotgun range. On defense two hold one site from deep,
// two smoke the way onto the other and hold it from its usual angle, and the fifth helps retake:
// nobody takes a close fight, and the team gives ground rather than fight five.

const ANTI_ATTACK = 'Against a saving team, your rifles win at range and their shotguns win up close';
const ANTI_DEFENSE = 'Against a saving team, hold from range where a rifle wins and give them no close fight';

/**
 * Taking `site` through `way` (callouts joined by ` > `, ending on the site), checking and flashing
 * `corners` (the spots by the way in where a saving team waits, in words), and holding the plant from `hold`.
 */
const atRange = (map: string, site: SiteId, way: string, corners: string, hold: string) => {
  const path = way.split(' > '), main = path.slice(0, -1).join(' > ');
  play(map, 'attack', site, 'antieco', `Slow and together on ${site}`, `${ANTI_ATTACK}. Check the corners by ${path[path.length - 2]} before walking past them, take ${site} together and hold the Spike from range.`, [
    `recon: ${main} | Check ${corners} with information before anyone walks past, because a saving team waits in spots like these with a shotgun.`,
    `flash: ${way} | Flash ${corners} as the team goes in, so whoever waits there is blind when you check it.`,
    `entry duel: ${way} | Go in together and trade each other, without peeking alone or chasing a kill past the site.`,
    `postplant: ${main} | Hold the plant from ${hold}, out of shotgun range, and let them come to you.`,
  ]);
};
/**
 * Two from deep on one site (`[site, first spot, second spot]`); on the other, one smokes the way
 * in and one holds it from its usual angle (both from the site's hold in siteSetups); and one at
 * `between`, who helps retake.
 */
const fromRange = (map: string, one: readonly [SiteId, string, string], other: SiteId, between: string, wait: string) => {
  const s = holdOf(map, other);
  play(map, 'defense', null, 'antieco', 'Hold back, retake together', `${ANTI_DEFENSE}. Two hold each site from deep and call the rush early, and the team wins back whatever site it takes.`, [
    `anchor: ${one[1]} | Hold ${one[0]} from deep in the site, away from the close corners, so a rush has to cross open ground to reach you.`,
    `recon: ${one[2]} | Call a rush through ${holdOf(map, one[0]).way} early with information, and don’t take a close fight for a pick.`,
    `smoke@hit: ${s.smoke} | Smoke ${s.way} when a rush comes and call it at once. They come out of it onto open ground, where your rifles win.`,
    `duel: ${s.angle} | Hold ${s.way} from ${s.angle} beside your partner. If five come, back off together and wait for help.`,
    `retake: ${between} | ${wait}, then retake the site they hit with the others, together and from range.`,
  ]);
};

atRange('abyss', 'A', 'A Lobby > A Main > A Site', 'A Bridge and A Tower', 'A Main');
fromRange('abyss', ['A', 'A Site', 'A Tower'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('ascent', 'A', 'A Lobby > A Main > A Site', 'A Tree and A Rafters', 'A Main');
fromRange('ascent', ['A', 'A Site', 'A Rafters'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('bind', 'B', 'B Fountain > B Long > B Site', 'B Elbow and B Window', 'B Long');
fromRange('bind', ['A', 'A Site', 'A Lamps'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('breeze', 'A', 'A Lobby > A Shop > A Site', 'A Pyramids', 'A Shop');
fromRange('breeze', ['A', 'A Site', 'A Bridge'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('corrode', 'A', 'A Lobby > A Main > A Yard > A Site', 'A Pocket and A Elbow', 'A Yard');
fromRange('corrode', ['A', 'A Site', 'A Crane'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('fracture', 'A', 'A Gate > A Dish > A Drop > A Site', 'A Link', 'A Drop');
fromRange('fracture', ['A', 'A Site', 'A Dish'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('haven', 'A', 'A Lobby > A Long > A Site', 'A Tower and A Link', 'A Long');
fromRange('haven', ['A', 'A Site', 'A Tower'], 'C', 'B Site', 'Hold B alone and call a rush early');
atRange('icebox', 'B', 'B Yellow > B Site', 'B Snowman', 'B Yellow');
fromRange('icebox', ['A', 'A Site', 'A Rafters'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('lotus', 'A', 'A Lobby > A Root > A Main > A Site', 'A Tree and A Hut', 'A Main');
fromRange('lotus', ['A', 'A Site', 'A Tree'], 'C', 'B Site', 'Hold B alone and call a rush early');
atRange('pearl', 'B', 'B Ramp > B Main > B Site', 'B Screen and B Tower', 'B Main');
fromRange('pearl', ['A', 'A Site', 'A Link'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('split', 'A', 'A Lobby > A Main > A Site', 'A Rafters and A Tower', 'A Main');
fromRange('split', ['A', 'A Site', 'A Tower'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('summit', 'A', 'A Lobby > A Main > A Garden > A Site', 'A Art and A Cave', 'A Garden');
fromRange('summit', ['A', 'A Site', 'A Hall'], 'B', 'Defender Side Spawn', BETWEEN);
atRange('sunset', 'A', 'A Lobby > A Main > A Site', 'A Elbow and A Alley', 'A Main');
fromRange('sunset', ['A', 'A Site', 'A Link'], 'B', 'Defender Side Spawn', BETWEEN);

// ---------------------------------------------------------------- Read and react, for teams that call
// A default that turns on what the team finds out early. One player takes information where the
// defenders show themselves first and calls how many hold each site; the team waits, then hits the
// site that's thin, or, when two or more hold it, shows that site to keep them there and hits the
// other. Each branch is drawn as its own set of routes.

interface ReadSite { site: SiteId; smokeFrom: string; way: string; smokes: string }
/**
 * A read-and-react default on `map`: `info` is the route to where the read is taken, `hold` where
 * a player waits for a pick, and the team hits `first` when it's thin, or shows it through `show`
 * (a route) and hits `other` when two or more hold it.
 */
const readReact = (map: string, spot: string, info: string, hold: string, first: ReadSite, show: string, other: ReadSite) => {
  const name = `Read ${spot}, then hit`;
  const read = `recon: ${info} | Take ${info.split(' > ').pop()} early with information and call how many hold each site.`;
  const lastOf = (r: string) => r.split(' > ').pop()!;
  play(map, 'attack', null, 'default', name, `Wait on the read from ${spot}. When ${first.site} is thin, the team hits it together.`, [
    read,
    `lurk: ${hold} | Hold ${lastOf(hold)} for a pick and watch for a push while the team waits on the call.`,
    `smoke: ${first.smokeFrom} | Smoke ${first.smokes} as soon as the call is to hit ${first.site}.`,
    `entry flash: ${first.way} | On the call, flash and take the site together, then plant for the team.`,
  ], `${first.site} is thin`);
  play(map, 'attack', null, 'default', name, `Wait on the read from ${spot}. When two or more hold ${first.site}, show it to keep them there and hit ${other.site}.`, [
    read,
    `lurk: ${show} | Show ${lastOf(show)} with utility to keep the defenders on ${first.site}, then hold the flank.`,
    `smoke: ${other.smokeFrom} | Smoke ${other.smokes} as the team swings to ${other.site}.`,
    `entry flash: ${other.way} | Swing to ${other.site} and take the site together while ${first.site} is held.`,
  ], `Two or more on ${first.site}`);
};
const at = (site: SiteId, from: string, way: string, smokes: string): ReadSite => ({ site, smokeFrom: `${SPAWN} > ${from}`, way, smokes });

readReact('abyss', 'mid', 'Mid Bend > Mid Catwalk', 'Mid Bottom > Mid Library', at('A', 'A Lobby', 'A Lobby > A Main > A Site', 'A Tower and A Link'), 'A Lobby > A Main', at('B', 'B Lobby', 'B Lobby > B Main > B Site', 'B Tower and B Link'));
readReact('bind', 'A Short', 'A Link > A Short', 'B Short > B Window', at('B', 'B Fountain', 'B Fountain > B Long > B Site', 'B Elbow and B Hall'), 'B Fountain > B Long', at('A', 'A Lobby', 'A Lobby > A Bath > A Site', 'A Tower and A Cubby'));
readReact('corrode', 'mid', 'Mid Bottom > Mid Stairs', 'Mid Bottom > B Link', at('B', 'B Lobby', 'B Lobby > B Main > B Site', 'B Tower and B Arch'), 'B Lobby > B Main', at('A', 'A Lobby', 'A Lobby > A Main > A Yard > A Site', 'A Crane and A Link'));
readReact('haven', 'mid', 'Mid Window > Mid Courtyard', 'Mid Doors > C Garage', at('C', 'C Lobby', 'C Lobby > C Long > C Site', 'C Link and C Window'), 'C Lobby > C Long', at('A', 'A Lobby', 'A Lobby > A Long > A Site', 'A Tower and A Link'));
readReact('lotus', 'B Main', 'B Pillars > B Main', 'A Lobby > A Rubble', at('A', 'A Lobby', 'A Lobby > A Root > A Main > A Site', 'A Tree and A Stairs'), 'A Lobby > A Root', at('C', 'C Lobby', 'C Lobby > C Mound > C Main > C Site', 'C Hall and C Waterfall'));
readReact('summit', 'mid', 'Mid Top > Mid Fountain', 'Mid Top > Mid Tiles', at('A', 'A Lobby', 'A Lobby > A Main > A Garden > A Site', 'A Hall and A Cave'), 'A Lobby > A Main', at('B', 'B Lobby', 'B Lobby > B Main > B Site', 'B Tower and B Gym'));
readReact('sunset', 'mid', 'Mid Bottom > Mid Courtyard', 'Mid Tiles', at('B', 'B Lobby', 'B Lobby > B Main > B Site', 'B Boba and B Market'), 'B Lobby > B Main', at('A', 'A Lobby', 'A Lobby > A Main > A Site', 'A Link and A Alley'));
readReact('ascent', 'mid', 'Mid Top > Mid Courtyard', 'Mid Link', at('A', 'A Lobby', 'A Lobby > A Main > A Site', 'A Rafters and A Tree'), 'A Lobby > A Main', at('B', 'B Lobby', 'B Lobby > B Main > B Site', 'Mid Market and the back of B Site'));
readReact('breeze', 'mid', 'Mid Bottom > Mid Pillar', 'Mid Bottom > Mid Cannon', at('A', 'A Lobby', 'A Lobby > A Shop > A Site', 'A Bridge and A Ramp'), 'A Lobby > A Shop', at('B', 'B Main', 'B Main > B Site', 'B Tunnel and the back of B Site'));
readReact('fracture', 'B Arcade', 'Attacker Side Bridge > B Bench > B Arcade', 'A Hall > A Main', { site: 'B', smokeFrom: 'Attacker Side Bridge > B Bench', way: 'B Bench > B Arcade > B Site', smokes: 'B Canteen and B Generator' }, 'Attacker Side Bridge > B Bench', { site: 'A', smokeFrom: 'Attacker Side Bridge > A Gate', way: 'A Gate > A Dish > A Drop > A Site', smokes: 'A Link and A Rope' });
readReact('icebox', 'mid', 'Mid Blue', 'A Belt', at('B', 'B Yellow', 'B Yellow > B Site', 'B Kitchen and B Snowman'), 'B Green > B Yellow', at('A', 'A Belt', 'A Belt > A Nest > A Site', 'A Screen and A Rafters'));
readReact('pearl', 'mid', 'Mid Plaza > Mid Doors', 'Mid Top', at('A', 'A Restaurant', 'A Art > A Main > A Site', 'A Flowers and A Secret'), 'A Art > A Main', at('B', 'B Ramp', 'B Ramp > B Main > B Site', 'B Hall and B Tower'));
readReact('split', 'mid', 'Mid Bottom > Mid Top', 'Mid Bottom > Mid Mail', at('B', 'B Lobby', 'B Lobby > B Garage > B Site', 'B Tower and B Alley'), 'B Lobby > B Garage', at('A', 'A Lobby', 'A Lobby > A Main > A Site', 'A Tower and A Screens'));

export const PLAYS: readonly Play[] = ALL;

/** The branches of a play that reads and reacts, in the order written (just the play, for any other). */
export const branchesOf = (p: Play): Play[] => (p.branch ? PLAYS.filter((o) => o.branch && o.map === p.map && o.side === p.side && o.name === p.name) : [p]);

/** The round a pistol or eco play is for, as BUY_GUIDE names it. */
export const roundOf = (p: Play) => (isRoundPlay(p.kind) ? BUY_GUIDE.find((r) => r.id === p.kind) : undefined);
/** A play's name as shown on its own: "Pistol round: Five through B Main", or just the name. */
export const playTitle = (p: Play): string => {
  const round = roundOf(p);
  return round ? `${round.name}: ${p.name}` : p.name;
};

/**
 * A map's plays for a side, and for some of its sites (none: all of them). Whole-map plays always
 * come too, and so do any of `more` (the plays you drew) that fit.
 */
export function playsOn(map: string, side: Side, sites: readonly SiteId[] = [], more: readonly Play[] = []): Play[] {
  return [...PLAYS, ...more].filter((p) => p.map === map && p.side === side && (!p.site || !sites.length || sites.includes(p.site)));
}

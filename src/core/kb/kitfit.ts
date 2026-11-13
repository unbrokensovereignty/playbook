/**
 * How a kit plays on a particular map, side or site: the part of an agent's strength that depends
 * on where they are. An agent's strengths in agents.ts are the same everywhere; these raise or
 * lower them where the kit does more or less, for a reason a coach would give.
 *
 * Each rule names the agent, where it applies and the change, written like agent strengths with a
 * sign (`disrupt +.15; clear -.1`), and says why in one sentence. The sentence is what a comp's pros
 * (for a rule that helps) or cons (for one that hurts) say when the rule matters to its score, so
 * it has to stand on its own; `{map}` becomes the map's name. Where a rule applies:
 * - `map`: one map (and `site`, one of its sites);
 * - `mechanic`: every map with that mechanic (Lotus's and Ascent's doors, say; see maps.ts);
 * - `space`: every map, or chosen site, that open or that tight (see maps.ts);
 * - none of these: every map.
 * `side` limits a rule to attack or defense. A strength never goes below 0 or above 1. `solo`
 * changes how well the agent works alone there, for the low ranks' reward for that, and `skill` how
 * hard the kit is to play well there, for what the low ranks get out of it.
 *
 * Sources: the game's own ability text (content.gen.ts) for what each kit can do, and how pro
 * teams use the agents on each map (pro.ts). Every rule is judgment, kept small: a few hundredths
 * to two tenths of a strength. A typo in a rule throws, so a bad edit fails the tests.
 */
import { MAPS, mapById, type Mechanic, type Side, type SiteId, type Space } from './maps.ts';
import { isDim, type Dim } from './roles.ts';

export interface KitRule {
  agent: string;
  map?: string;
  site?: SiteId;
  mechanic?: Mechanic;
  space?: Space;
  side?: Side;
  /** The change, as "dim ±value; …". */
  caps: string;
  /**
   * The ability keys behind what the rule adds, when they aren't the ones the agent uses for that
   * strength everywhere (agents.ts): on Breeze, Viper's Toxic Screen (E) does a smoke's work.
   */
  via?: string;
  /**
   * How much more (or less) the agent works alone there than their `solo` in agents.ts says, for the
   * reward the low ranks give that (FIT.solo in engine/weights.ts): Phoenix wins his own fights with
   * his flash and molly at close range, and few fights are close on an open map.
   */
  solo?: number;
  /**
   * How much easier (below 0) or harder the kit is to play well there than its `skill` in agents.ts
   * says, for what the low ranks get out of it (EXEC and HARD in engine/weights.ts): on Breeze, Viper's
   * main job is one long wall, and even a rough one does it.
   */
  skill?: number;
  why: string;
  /**
   * How to play around what the rule takes away, as a sentence that follows `why` in a con: every
   * rule that costs a kit something has one, so a con about a pick says what to do with it.
   */
  around?: string;
}

export const KIT_RULES: readonly KitRule[] = [
  // ------------------------------------------------ Hush
  {
    agent: 'hush', mechanic: 'doors', side: 'attack', caps: 'entry +.25; disrupt +.2; postplant +.15; flash +.05',
    why: 'Hush’s Telekinesis works door switches from range, so on {map} she can open a way in for the hit or shut a retake path without standing in the doorway.',
  },
  {
    agent: 'hush', mechanic: 'doors', side: 'defense', caps: 'stall +.1; retake +.05',
    why: 'Hush’s Telekinesis works door switches from range, so on {map} she can shut a way in from cover to slow a push, or open one for a retake.',
  },
  {
    agent: 'hush', space: 'tight', caps: 'disrupt +.1; clear +.1; entry +.05',
    why: 'Hush’s Displacement concusses anyone it pulls into a wall, and {map}’s tight spaces are full of them, so she can pull a defender out of a close corner before the team swings it.',
  },
  {
    agent: 'hush', space: 'open', caps: 'disrupt -.25; clear -.2',
    why: 'Hush’s Displacement only concusses enemies it pulls into a wall or into each other, and {map}’s open ground has few walls to pull them into.',
    around: 'Save it for enemies standing by a wall or next to each other, where the pull still concusses.',
  },
  {
    agent: 'hush', space: 'open', side: 'attack', caps: 'entry -.1; mobility -.1',
    why: 'Hush’s Flow is a slow, delayed move, which leaves her exposed crossing {map}’s open ground.',
    around: 'Use Flow only behind smokes or across the short gaps between cover.',
  },
  // ------------------------------------------------ utility that needs walls and chokes
  {
    agent: 'raze', space: 'open', caps: 'clear -.2; entry -.1',
    why: 'Raze’s Paint Shells and Boom Bot need corners to clear, and {map}’s wide, open spaces give them little to do.',
    around: 'Save them for the close corners on site and for whoever plants or defuses the Spike.',
  },
  {
    agent: 'raze', space: 'tight', side: 'defense', caps: 'stall +.15; clear +.1',
    why: 'Raze’s Boom Bot and Paint Shells do the most in {map}’s tight chokes, where a push or a planted Spike has no room to get away from them.',
  },
  {
    agent: 'raze', map: 'split', caps: 'mobility +.15; entry +.1',
    why: 'Raze’s Blast Pack jumps reach Split’s high ground, A Tower and B Tower, faster than the ropes.',
  },
  {
    agent: 'breach', space: 'tight', caps: 'clear +.15; disrupt +.05; flash +.05',
    why: 'Breach’s stuns and flashes go through walls, which works best on {map}’s narrow ways in.',
  },
  {
    agent: 'breach', space: 'open', caps: 'disrupt -.2; clear -.1; flash -.05',
    why: 'Breach’s Fault Line and Aftershock cover a narrow lane and Flashpoint needs a wall to blind through, and {map}’s wide spaces leave room to get out of them.',
    around: 'Aim them down the narrower lanes and doorways, where there’s less room to step aside.',
  },
  {
    agent: 'phoenix', space: 'open', caps: 'flash -.2; entry -.15; clear -.1; duel -.05', solo: -0.2,
    why: 'Phoenix’s Curveball and Hot Hands work at close range, and {map}’s long sightlines keep most fights out of their reach.',
    around: 'Keep him for the close corners around the site, and let teammates take the long fights.',
  },
  {
    agent: 'phoenix', space: 'open', caps: 'wall -.1; stall -.1',
    why: 'Phoenix’s Blaze is a short wall, so it can’t cut {map}’s longest sightlines the way a long wall does, and a push can walk around it.',
    around: 'Use it to cut a close angle or split a site, and smoke the long sightlines instead.',
  },
  {
    agent: 'phoenix', space: 'tight', caps: 'entry +.05; clear +.05',
    why: 'Phoenix’s Curveball and Hot Hands win {map}’s close-range fights around corners.',
  },
  {
    agent: 'iso', space: 'open', caps: 'entry -.15',
    why: 'Iso’s Contingency covers only a short crossing, too short for {map}’s open ground.',
    around: 'Use it for the short gaps between cover, and cross the wider ones behind a smoke.',
  },
  {
    agent: 'iso', space: 'tight', caps: 'duel +.05; entry +.05',
    why: 'Iso’s Double Tap and Undercut win the one-at-a-time fights that {map}’s tight angles make.',
  },
  {
    agent: 'clove', space: 'open', caps: 'entry -.15; duel -.1; sustain -.1',
    why: 'Clove’s Pick-me-up and Not Dead Yet pay off in close trades, and {map}’s long sightlines leave her fewer of them to take.',
    around: 'Keep her close behind whoever takes the first fight, so she’s in range to trade it.',
  },
  {
    agent: 'skye', space: 'tight', caps: 'clear +.1',
    why: 'Skye’s Trailblazer clears {map}’s close corners before anyone has to peek them.',
  },
  {
    agent: 'gekko', space: 'tight', caps: 'clear +.05; postplant +.05',
    why: 'Gekko’s Mosh Pit and Wingman are at their best in {map}’s small plant spots and close corners.',
  },
  {
    agent: 'kayo', space: 'tight', caps: 'clear +.05',
    why: 'KAY/O’s FRAG/ment clears {map}’s many close corners.',
  },
  {
    agent: 'deadlock', space: 'tight', caps: 'stall +.1; anchor +.05',
    why: 'Deadlock’s Barrier Mesh closes a whole choke on {map}, so one player can stop a rush.',
  },
  {
    agent: 'deadlock', space: 'open', caps: 'stall -.2; anchor -.1',
    why: 'Deadlock’s Barrier Mesh can’t close {map}’s wide ways in.',
    around: 'Put it on the narrowest way in, and watch the others with her Sonic Sensors.',
  },
  {
    agent: 'sage', space: 'tight', side: 'defense', caps: 'stall +.1',
    why: 'Sage’s Barrier Orb walls off a whole choke on {map} for the first seconds of a push.',
  },
  {
    agent: 'sage', space: 'open', caps: 'stall -.1',
    why: 'Sage’s Barrier Orb can’t wall off {map}’s wide ways in.',
    around: 'Use it to block the narrowest lane, or as cover to plant or defuse behind.',
  },
  {
    agent: 'cypher', space: 'open', caps: 'flank -.15; anchor -.15',
    why: 'Cypher’s Trapwires need two walls close together, and {map}’s wide lanes have few.',
    around: 'Set them in the few doorways there are, and watch the open lanes with his Spycam.',
  },
  {
    agent: 'cypher', space: 'tight', caps: 'flank +.05; anchor +.05',
    why: 'Cypher’s Trapwires fit {map}’s narrow doorways, where nobody gets past them unseen.',
  },
  {
    agent: 'brimstone', map: 'bind', side: 'attack', caps: 'smoke +.1',
    why: 'Bind’s sites sit close to the attackers’ side, so Brimstone’s Sky Smokes reach every way in at once for a fast hit.',
  },
  {
    agent: 'brimstone', map: 'fracture', side: 'attack', caps: 'smoke +.15',
    why: 'Fracture’s sites each have several ways in, and Brimstone’s three Sky Smokes go down at once, so the team can smoke them all and hit fast from either end.',
  },
  {
    agent: 'brimstone', map: 'bind', side: 'defense', caps: 'retake +.1',
    why: 'Bind’s sites are small enough for Brimstone’s Sky Smokes to cover a whole retake, and his Stim Beacon speeds the team back on.',
  },
  {
    agent: 'brimstone', space: 'open', caps: 'smoke -.15; postplant -.1',
    why: 'Brimstone’s Sky Smoke and Incendiary only reach so far from him, which leaves much of {map}’s wide, spread-out ground out of reach.',
    around: 'Play him near the site the team is hitting or holding, so every smoke reaches it.',
  },
  {
    agent: 'viper', map: 'breeze', caps: 'smoke +.27', via: 'E', skill: -0.1,
    why: 'Viper’s Toxic Screen does the work of several smokes on Breeze, since one wall cuts off the long sightlines across a whole site, and even a rough one does the job.',
  },
  {
    agent: 'viper', map: 'corrode', site: 'A', side: 'attack', caps: 'smoke +.2', via: 'E',
    why: 'Viper’s Toxic Screen stretches across Corrode’s A Site and cuts off the defenders’ high spots, so an A hit can be built around one wall.',
  },
  {
    agent: 'viper', map: 'split', caps: 'stall +.1; postplant +.05',
    why: 'Split’s sites are closed in, so Viper’s Snake Bite and her ultimate cover most of a site, and her wall and orb wear down anyone who pushes through them.',
  },
  {
    agent: 'vyse', space: 'tight', caps: 'stall +.05; anchor +.05',
    why: 'Vyse’s Shear and Razorvine shut {map}’s narrow chokes on whoever walks in first.',
  },
  {
    agent: 'sova', space: 'tight', caps: 'recon -.1; postplant -.05',
    why: 'Sova’s Recon Bolt sees little in {map}’s small, walled-in spaces, where it’s easy to shoot or hide from.',
    around: 'Shoot it deep, past the site’s first walls, and check the close corners with his Owl Drone.',
  },
  {
    agent: 'sova', space: 'open', caps: 'recon +.1; retake +.1',
    why: 'Sova’s Recon Bolt and Owl Drone see across {map}’s long, open ground, where one bolt can show a whole site, or a whole retake.',
  },
  {
    agent: 'fade', space: 'open', caps: 'recon -.1; disrupt -.05',
    why: 'Fade’s Prowlers have to cross {map}’s long, open ground to reach anyone, and her Haunt is spotted and shot from far off.',
    around: 'Throw Haunt from behind cover, and keep her Prowlers for the close corners on site.',
  },
  // ------------------------------------------------ map mechanics
  {
    agent: 'yoru', mechanic: 'teleporters', side: 'attack', caps: 'entry +.1; mobility +.1', via: 'E',
    why: 'Yoru’s Gatecrash and {map}’s teleporters together give him two quick ways onto a site, so the defenders can’t tell which way he’ll come.',
  },
  {
    agent: 'cypher', mechanic: 'teleporters', caps: 'flank +.1',
    why: 'A Cypher Trapwire on a teleporter exit catches anyone who comes through it on {map}.',
  },
  {
    agent: 'killjoy', mechanic: 'teleporters', caps: 'flank +.1',
    why: 'A Killjoy Alarmbot by a teleporter exit catches anyone who comes through it on {map}.',
  },
  {
    agent: 'deadlock', mechanic: 'teleporters', caps: 'flank +.1',
    why: 'A Deadlock Sonic Sensor by a teleporter exit catches anyone who comes through it on {map}.',
  },
  {
    agent: 'jett', mechanic: 'ropes', caps: 'mobility +.1; angles +.05',
    why: 'Jett’s Updraft takes her to {map}’s high ground without a slow climb up a rope.',
  },
  {
    agent: 'waylay', mechanic: 'ropes', caps: 'mobility +.1',
    why: 'Waylay’s Lightspeed can launch her up to {map}’s high ground without a slow climb up a rope.',
  },
];

/** "entry +.15; disrupt -.1" → changes by strength. Throws on a typo, so a bad edit fails the tests. */
export function parseBumps(spec: string, who: string): Partial<Record<Dim, number>> {
  const out: Partial<Record<Dim, number>> = {};
  for (const part of spec.split(';').map((p) => p.trim()).filter(Boolean)) {
    const [dim, value] = part.split(/\s+/);
    const v = Number(value);
    if (!isDim(dim) || !/^[+-]/.test(value ?? '') || !Number.isFinite(v) || Math.abs(v) > 0.3) throw new Error(`${who}: can't read the change "${part}"`);
    out[dim] = (out[dim] ?? 0) + v;
  }
  return out;
}

export interface ParsedRule extends KitRule { bumps: Partial<Record<Dim, number>> }

export const RULES: readonly ParsedRule[] = KIT_RULES.map((r, i) => {
  const who = `kit rule ${i + 1} (${r.agent})`;
  if (r.map && !mapById(r.map)) throw new Error(`${who}: no map "${r.map}"`);
  if (r.site && !(r.map && mapById(r.map)!.sites.some((s) => s.id === r.site))) throw new Error(`${who}: no site ${r.site} on its map`);
  if (r.mechanic && !MAPS.some((m) => m.mechanics?.some((x) => x.id === r.mechanic))) throw new Error(`${who}: no map has ${r.mechanic}`);
  if (r.via !== undefined && !/^[CQEX]+$/.test(r.via)) throw new Error(`${who}: can't read the ability keys "${r.via}"`);
  const bumps = parseBumps(r.caps, who);
  if ((Object.values(bumps).some((v) => v < 0) || (r.solo ?? 0) < 0 || (r.skill ?? 0) > 0) !== (r.around !== undefined)) throw new Error(`${who}: a rule says how to play around it exactly when it takes something away`);
  return { ...r, bumps };
});

/** How open a map is where the team plays: the chosen site's own space when there's one chosen and it has one. */
export function spaceOf(mapId: string, sites: readonly SiteId[]): Space | undefined {
  const map = mapById(mapId);
  if (!map) return undefined;
  if (sites.length === 1) return map.sites.find((s) => s.id === sites[0])?.space ?? map.space;
  return map.space;
}

/** Whether a rule applies on a map and side, for the chosen sites (empty for all). */
export function ruleApplies(r: KitRule, mapId: string, side: Side, sites: readonly SiteId[]): boolean {
  if (r.side && r.side !== side) return false;
  if (r.map && r.map !== mapId) return false;
  if (r.site && sites.length && !sites.includes(r.site)) return false;
  if (r.mechanic && !mapById(mapId)?.mechanics?.some((m) => m.id === r.mechanic)) return false;
  if (r.space && spaceOf(mapId, sites) !== r.space) return false;
  return true;
}

/** How much a mechanic's rules count on a map (its `weight` in maps.ts): 1 for a map built around it. */
export const mechanicWeight = (mapId: string, mechanic: Mechanic): number =>
  mapById(mapId)?.mechanics?.find((m) => m.id === mechanic)?.weight ?? 1;

// a mechanic's rules as they count on each map with a weight of its own, made once so each stays the same object
const weighted = new Map<string, ParsedRule>();
function onMap(r: ParsedRule, mapId: string): ParsedRule {
  const w = r.mechanic ? mechanicWeight(mapId, r.mechanic) : 1;
  if (w === 1) return r;
  const key = `${RULES.indexOf(r)}|${mapId}`;
  let out = weighted.get(key);
  if (!out) {
    out = { ...r, bumps: Object.fromEntries(Object.entries(r.bumps).map(([d, v]) => [d, v * w])), ...(r.solo === undefined ? {} : { solo: r.solo * w }), ...(r.skill === undefined ? {} : { skill: r.skill * w }) };
    weighted.set(key, out);
  }
  return out;
}

/** The rules for an agent on a map and side, each as much as it counts there. */
export const rulesFor = (agent: string, mapId: string, side: Side, sites: readonly SiteId[]): ParsedRule[] =>
  RULES.filter((r) => r.agent === agent && ruleApplies(r, mapId, side, sites)).map((r) => onMap(r, mapId));

/**
 * A rule's reason for a map: "{map}" filled in. A rule about how open the ground is that holds
 * because of the one site chosen (its space differs from the map's) names that site ("Haven B"),
 * so it never says the whole map is tight or open.
 */
export function ruleWhy(r: KitRule, mapId: string, sites: readonly SiteId[] = []): string {
  const map = mapById(mapId);
  const bySite = !!r.space && !!map && sites.length === 1 && spaceOf(mapId, sites) !== map.space;
  return r.why.replaceAll('{map}', !map ? 'this map' : bySite ? `${map.name} ${sites[0]}` : map.name);
}

/** A rule's reason for the maps it covers: one map by name, several as "these maps". */
export const ruleWhyAt = (r: KitRule, mapIds: readonly string[]): string =>
  mapIds.length === 1 ? ruleWhy(r, mapIds[0]!) : r.why.replaceAll('{map}’s', 'these maps’').replaceAll('{map}', 'these maps');

/** An agent's rules, each with the maps it applies on (on either side, for all sites), in map order. */
export function agentRules(agent: string): { rule: ParsedRule; maps: string[] }[] {
  return RULES.filter((r) => r.agent === agent).map((rule) => ({
    rule,
    maps: MAPS.filter((m) => (['attack', 'defense'] as const).some((side) => ruleApplies(rule, m.id, side, []))).map((m) => m.id),
  })).filter((x) => x.maps.length);
}

/** Whether a rule helps (it adds more than it takes away). */
export const ruleHelps = (r: ParsedRule): boolean => Object.values(r.bumps).reduce((a, b) => a + b, 0) > 0;

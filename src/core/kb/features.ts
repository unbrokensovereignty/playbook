/**
 * What each map has besides its callouts, for the minimap's layers: where the ultimate orbs lie,
 * the features that change how you move or what you see (doors, walls you can break or drop,
 * teleporters, ropes, ziplines and silent drops), and two plant spots on each site. Spots are
 * fractions of the minimap's width and height, as callouts are, placed by hand against the minimap
 * and checked against several callout maps and map guides; the specs check that each one stands on
 * the floor. A feature with two ends (a teleporter, rope or zipline) has `to` for the other end, and
 * a mark can be turned (`angle`) to lie the way its door or wall does.
 *
 * Plant spots are inside the area the minimap tints for planting: the default plant in the middle
 * of it, and the safe plant on the edge nearest the way most of the map's plays come onto the site
 * (its `about` names that way). Plays put the Spike on one of them (engine/plays.ts, plantOf).
 */
import type { Spot } from './floor.ts';
import { mapById, type SiteId } from './maps.ts';

export type FeatureKind = 'orb' | 'door' | 'breakable' | 'wall' | 'teleporter' | 'rope' | 'zipline' | 'drop' | 'plant' | 'safeplant';
/** The minimap's layers, each shown or hidden on its own. */
export type MapLayer = 'orbs' | 'features' | 'plants';

export interface MapFeature {
  kind: FeatureKind;
  at: Spot;
  /** The other end, for a teleporter, rope or zipline. */
  to?: Spot;
  /** What it is, in a few words: "Rotating door between A Main and A Rubble". */
  about: string;
  /** How far its mark is turned, in degrees clockwise (a door or wall that lies across the map's lines). */
  angle?: number;
}

/** Each kind in words, for the legend, in the order the legend lists them. */
export const FEATURE_KINDS: readonly { kind: FeatureKind; name: string; layer: MapLayer }[] = [
  { kind: 'orb', name: 'Ultimate orb', layer: 'orbs' },
  { kind: 'door', name: 'Door', layer: 'features' },
  { kind: 'breakable', name: 'Breakable wall', layer: 'features' },
  { kind: 'wall', name: 'Droppable wall', layer: 'features' },
  { kind: 'teleporter', name: 'Teleporter', layer: 'features' },
  { kind: 'rope', name: 'Rope', layer: 'features' },
  { kind: 'zipline', name: 'Zipline', layer: 'features' },
  { kind: 'drop', name: 'Silent drop', layer: 'features' },
  { kind: 'plant', name: 'Default plant', layer: 'plants' },
  { kind: 'safeplant', name: 'Safe plant', layer: 'plants' },
];

/** The layer a kind of mark is on. */
export const layerOf = (kind: FeatureKind): MapLayer => FEATURE_KINDS.find((k) => k.kind === kind)!.layer;

export const FEATURES: Record<string, readonly MapFeature[]> = {
  ascent: [
    { kind: 'orb', at: [0.478, 0.265], about: 'Ultimate orb in A Main' },
    { kind: 'orb', at: [0.381, 0.747], about: 'Ultimate orb in B Main' },
    { kind: 'door', at: [0.396, 0.235], about: 'A door, between A Link and the site, which a switch beside it shuts or opens. It breaks after enough damage' },
    { kind: 'door', at: [0.288, 0.598], about: 'B door, between Mid Market and the site, which a switch in the site shuts or opens. It breaks after enough damage' },
    { kind: 'breakable', at: [0.267, 0.284], about: 'Glass pane in A Window, looking into A Garden, which breaks at the first shot', angle: 90 },
    { kind: 'breakable', at: [0.5, 0.554], about: 'Panel on the wall between Mid Courtyard and Mid Link, which stops bullets until it’s broken and then lets them through the wall' },
    { kind: 'breakable', at: [0.55, 0.554], about: 'Panel on the other wall between Mid Courtyard and Mid Link, which stops bullets until it’s broken and then lets them through the wall' },
    { kind: 'plant', at: [0.303, 0.15], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.34, 0.169], about: 'Safe plant on A Site, just in from A Main' },
    { kind: 'plant', at: [0.257, 0.789], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.324, 0.76], about: 'Safe plant on B Site, just in from B Main' },
  ],
  bind: [
    { kind: 'orb', at: [0.84, 0.476], about: 'Ultimate orb at the back of A Bath' },
    { kind: 'orb', at: [0.192, 0.425], about: 'Ultimate orb in B Long, in front of the B teleporter' },
    { kind: 'teleporter', at: [0.15, 0.432], to: [0.925, 0.516], about: 'One-way teleporter from B Long to A Exit, by A Bath, loud at both ends' },
    { kind: 'teleporter', at: [0.611, 0.408], to: [0.486, 0.44], about: 'One-way teleporter from A Short to B Exit, by B Window, loud at both ends' },
    { kind: 'door', at: [0.877, 0.515], about: 'A Exit door, which opens by itself only for someone inside the exit room. Bullets go through it', angle: 90 },
    { kind: 'door', at: [0.431, 0.443], about: 'B Exit door, which opens by itself only for someone inside the exit room. Bullets go through it', angle: 90 },
    { kind: 'plant', at: [0.718, 0.315], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.758, 0.361], about: 'Safe plant on A Site, just in from A Bath' },
    { kind: 'plant', at: [0.29, 0.262], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.257, 0.296], about: 'Safe plant on B Site, just in from B Long' },
  ],
  breeze: [
    { kind: 'orb', at: [0.768, 0.625], about: 'Ultimate orb in A Shop' },
    { kind: 'orb', at: [0.141, 0.475], about: 'Ultimate orb in B Main' },
    { kind: 'door', at: [0.587, 0.561], about: 'Door at the mid end of Mid Hall, which opens by itself, loudly, for anyone or anything that comes near from either side', angle: 90 },
    { kind: 'rope', at: [0.731, 0.217], about: 'Rope from the back of A Site up to A Bridge' },
    { kind: 'plant', at: [0.922, 0.438], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.921, 0.478], about: 'Safe plant on A Site, just in from A Shop' },
    { kind: 'plant', at: [0.126, 0.265], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.117, 0.317], about: 'Safe plant on B Site, just in from B Main' },
  ],
  corrode: [
    { kind: 'orb', at: [0.613, 0.193], about: 'Ultimate orb in A Main' },
    { kind: 'orb', at: [0.528, 0.701], about: 'Ultimate orb at the top of B Main, on the way from B Lobby' },
    { kind: 'plant', at: [0.392, 0.189], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.422, 0.215], about: 'Safe plant on A Site, just in from A Yard' },
    { kind: 'plant', at: [0.396, 0.767], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.428, 0.792], about: 'Safe plant on B Site, just in from B Main' },
  ],
  fracture: [
    { kind: 'orb', at: [0.762, 0.786], about: 'Ultimate orb in A Hall' },
    { kind: 'orb', at: [0.715, 0.321], about: 'Ultimate orb by A Dish' },
    { kind: 'orb', at: [0.181, 0.753], about: 'Ultimate orb between B Main and B Tree' },
    { kind: 'orb', at: [0.284, 0.341], about: 'Ultimate orb in B Arcade' },
    { kind: 'zipline', at: [0.482, 0.2], to: [0.482, 0.765], about: 'One-way zipline under Defender Side Spawn, from the Attacker Side Bridge to Attacker Side Spawn' },
    { kind: 'zipline', at: [0.517, 0.765], to: [0.517, 0.2], about: 'One-way zipline under Defender Side Spawn, from Attacker Side Spawn to the Attacker Side Bridge' },
    { kind: 'rope', at: [0.617, 0.64], about: 'A Rope, up from A Hall toward A Link' },
    { kind: 'rope', at: [0.156, 0.371], about: 'Rope up to B Tower' },
    { kind: 'door', at: [0.706, 0.704], about: 'A Door, between A Hall and A Main, which opens by itself, loudly, when anyone comes near', angle: 315 },
    { kind: 'plant', at: [0.878, 0.5], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.844, 0.454], about: 'Safe plant on A Site, just in from A Drop' },
    { kind: 'plant', at: [0.094, 0.521], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.154, 0.478], about: 'Safe plant on B Site, just in from B Arcade' },
  ],
  haven: [
    { kind: 'orb', at: [0.56, 0.135], about: 'Ultimate orb in A Long' },
    { kind: 'orb', at: [0.701, 0.845], about: 'Ultimate orb in C Long' },
    { kind: 'breakable', at: [0.554, 0.619], about: 'Panel over one of the double doors between Mid Doors and C Garage, which stops bullets until it’s broken', angle: 45 },
    { kind: 'breakable', at: [0.545, 0.641], about: 'Panel over the other double door between Mid Doors and C Garage, which stops bullets until it’s broken', angle: 45 },
    { kind: 'breakable', at: [0.653, 0.455], about: 'Panel over part of the wall at Mid Window, which stops bullets until it’s broken' },
    { kind: 'plant', at: [0.372, 0.132], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.411, 0.178], about: 'Safe plant on A Site, just in from A Long' },
    { kind: 'plant', at: [0.428, 0.472], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.428, 0.525], about: 'Safe plant on B Site, just in from Mid Courtyard' },
    { kind: 'plant', at: [0.353, 0.842], about: 'Default plant in the middle of C Site' },
    { kind: 'safeplant', at: [0.403, 0.842], about: 'Safe plant on C Site, just in from C Long' },
  ],
  icebox: [
    { kind: 'orb', at: [0.585, 0.826], about: 'Ultimate orb between A Nest and A Pipes' },
    { kind: 'orb', at: [0.421, 0.339], about: 'Ultimate orb in B Green, by the way out of B Garage' },
    { kind: 'zipline', at: [0.539, 0.811], to: [0.708, 0.811], about: 'Zipline across A Site, from A Nest to the site' },
    { kind: 'rope', at: [0.523, 0.749], about: 'Rope up to the top of A Nest' },
    { kind: 'rope', at: [0.72, 0.744], about: 'Rope up to the high ground on A Site, at its mid end' },
    { kind: 'rope', at: [0.719, 0.834], about: 'Rope up to the high ground on A Site, at its far end' },
    { kind: 'rope', at: [0.599, 0.195], about: 'Rope up to the high ground on B Site' },
    { kind: 'plant', at: [0.69, 0.783], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.689, 0.829], about: 'Safe plant on A Site, just in from A Nest' },
    { kind: 'plant', at: [0.581, 0.22], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.56, 0.174], about: 'Safe plant on B Site, just in from B Yellow' },
  ],
  lotus: [
    { kind: 'orb', at: [0.783, 0.492], about: 'Ultimate orb in A Main' },
    { kind: 'orb', at: [0.236, 0.651], about: 'Ultimate orb on C Mound' },
    { kind: 'door', at: [0.831, 0.517], about: 'A Door, between A Main and A Tree. A button on either side turns it, slowly and loudly, and players can get through while it turns' },
    { kind: 'door', at: [0.336, 0.57], about: 'C Door, between C Mound and B Main. A button on either side turns it, slowly and loudly, and players can get through while it turns', angle: 90 },
    { kind: 'breakable', at: [0.657, 0.455], about: 'Wall between A Main and A Link, which can be broken to open a second way toward A for the rest of the round', angle: 90 },
    { kind: 'rope', at: [0.811, 0.287], about: 'Rope from A Site up to A Top' },
    { kind: 'drop', at: [0.88, 0.23], about: 'Silent drop from A Top down to A Drop, where nobody hears you land' },
    { kind: 'plant', at: [0.886, 0.311], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.896, 0.367], about: 'Safe plant on A Site, just in from A Main' },
    { kind: 'plant', at: [0.46, 0.404], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.463, 0.444], about: 'Safe plant on B Site, just in from B Main' },
    { kind: 'plant', at: [0.118, 0.463], about: 'Default plant in the middle of C Site' },
    { kind: 'safeplant', at: [0.146, 0.492], about: 'Safe plant on C Site, just in from C Main' },
  ],
  pearl: [
    { kind: 'orb', at: [0.91, 0.544], about: 'Ultimate orb in A Main' },
    { kind: 'orb', at: [0.089, 0.714], about: 'Ultimate orb in B Ramp' },
    { kind: 'plant', at: [0.85, 0.329], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.906, 0.36], about: 'Safe plant on A Site, just in from A Main' },
    { kind: 'plant', at: [0.185, 0.397], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.158, 0.451], about: 'Safe plant on B Site, just in from B Main' },
  ],
  split: [
    { kind: 'orb', at: [0.485, 0.213], about: 'Ultimate orb in A Main' },
    { kind: 'orb', at: [0.541, 0.913], about: 'Ultimate orb in B Garage' },
    { kind: 'rope', at: [0.608, 0.22], about: 'Two ropes between A Sewer and A Main' },
    { kind: 'rope', at: [0.423, 0.446], about: 'Two ropes from mid up into Mid Vent' },
    { kind: 'rope', at: [0.367, 0.412], about: 'Two ropes from Mid Vent up toward A Tower (Heaven)' },
    { kind: 'rope', at: [0.42, 0.717], about: 'Rope from B Site up to B Tower (Heaven)' },
    { kind: 'plant', at: [0.319, 0.079], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.367, 0.138], about: 'Safe plant on A Site, just in from A Main' },
    { kind: 'plant', at: [0.313, 0.819], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.351, 0.806], about: 'Safe plant on B Site, just in from B Garage' },
  ],
  summit: [
    { kind: 'orb', at: [0.778, 0.549], about: 'Ultimate orb in A Main' },
    { kind: 'orb', at: [0.122, 0.505], about: 'Ultimate orb in B Main' },
    { kind: 'wall', at: [0.808, 0.318], about: 'A wall, between A Art and A Garden, which drops when its switch is shot and shuts the way for the rest of the round' },
    { kind: 'wall', at: [0.484, 0.353], about: 'Mid wall, between Mid Window and Mid Bottom, which drops when its switch is shot and shuts the way for the rest of the round' },
    { kind: 'wall', at: [0.138, 0.244], about: 'B wall, between B Tower and B Site, which drops when its switch is shot and shuts the way for the rest of the round' },
    { kind: 'rope', at: [0.205, 0.23], about: 'Rope from B Gym up to B Tower' },
    { kind: 'drop', at: [0.086, 0.211], about: 'Silent drop from B Tower down to B Drop, where nobody hears you land' },
    { kind: 'plant', at: [0.918, 0.433], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.879, 0.443], about: 'Safe plant on A Site, just in from A Garden' },
    { kind: 'plant', at: [0.128, 0.3], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.142, 0.342], about: 'Safe plant on B Site, just in from B Main' },
  ],
  sunset: [
    { kind: 'orb', at: [0.793, 0.477], about: 'Ultimate orb in A Main, by the site' },
    { kind: 'orb', at: [0.186, 0.659], about: 'Ultimate orb in B Main' },
    { kind: 'door', at: [0.369, 0.453], about: 'Door between B Market and Mid Courtyard, which a switch on the Market side shuts or opens. It breaks after enough damage', angle: 90 },
    { kind: 'plant', at: [0.815, 0.368], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.778, 0.422], about: 'Safe plant on A Site, just in from A Main' },
    { kind: 'plant', at: [0.16, 0.47], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.195, 0.462], about: 'Safe plant on B Site, just in from B Main' },
  ],
  abyss: [
    { kind: 'breakable', at: [0.444, 0.291], about: 'Door at the A Tower end of A Vent, which stops bullets until it’s broken' },
    { kind: 'breakable', at: [0.5, 0.435], about: 'Door at the mid end of A Vent, which stops bullets until it’s broken' },
    { kind: 'rope', at: [0.5, 0.204], about: 'Rope from A Site up to A Tower' },
    { kind: 'rope', at: [0.614, 0.683], about: 'Rope from B Main up to Mid Bend' },
    { kind: 'rope', at: [0.839, 0.523], about: 'Rope in Attack spawn' },
    { kind: 'rope', at: [0.452, 0.452], about: 'Rope up to Mid Catwalk, reached by jumping the drop from Mid Top or Mid Library' },
    { kind: 'orb', at: [0.631, 0.193], about: 'Ultimate orb in A Main' },
    { kind: 'orb', at: [0.629, 0.823], about: 'Ultimate orb in B Main' },
    { kind: 'plant', at: [0.389, 0.076], about: 'Default plant in the middle of A Site' },
    { kind: 'safeplant', at: [0.469, 0.144], about: 'Safe plant on A Site, just in from A Main' },
    { kind: 'plant', at: [0.362, 0.904], about: 'Default plant in the middle of B Site' },
    { kind: 'safeplant', at: [0.396, 0.882], about: 'Safe plant on B Site, just in from B Main' },
  ],
};

/** A map's features (none for a map that hasn't been placed). */
export const featuresOf = (map: string): readonly MapFeature[] => FEATURES[map] ?? [];

/** The site a spot is on: the one whose callout is nearest it. */
export function siteAt(map: string, at: Spot): SiteId | undefined {
  const m = mapById(map);
  if (!m) return undefined;
  let best: { id: SiteId; d: number } | undefined;
  for (const s of m.sites) {
    const c = m.callouts.find((x) => x.name === `${s.id} Site`);
    const d = c ? Math.hypot(c.x - at[0], c.y - at[1]) : Infinity;
    if (!best || d < best.d) best = { id: s.id, d };
  }
  return best?.id;
}

/** A site's two plant spots, the default and the safe one, when they're marked. */
export function plantSpots(map: string, site: SiteId): { plant?: MapFeature; safe?: MapFeature } {
  const on = featuresOf(map).filter((f) => (f.kind === 'plant' || f.kind === 'safeplant') && siteAt(map, f.at) === site);
  const plant = on.find((f) => f.kind === 'plant'), safe = on.find((f) => f.kind === 'safeplant');
  return { ...(plant ? { plant } : {}), ...(safe ? { safe } : {}) };
}

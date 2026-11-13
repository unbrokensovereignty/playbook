/**
 * The four roles, and the strengths the engine measures every agent and team by. Each strength
 * is something a round can need: a map, a side and a site each need them in different amounts.
 */

export type Role = 'duelist' | 'initiator' | 'controller' | 'sentinel';
export const ROLES: readonly { id: Role; name: string; plural: string; blurb: string }[] = [
  { id: 'duelist', name: 'Duelist', plural: 'Duelists', blurb: 'Take the first fight and make space for the team.' },
  { id: 'initiator', name: 'Initiator', plural: 'Initiators', blurb: 'Find enemies and set up fights with flashes, stuns and information.' },
  { id: 'controller', name: 'Controller', plural: 'Controllers', blurb: 'Cut sightlines with smokes and walls.' },
  { id: 'sentinel', name: 'Sentinel', plural: 'Sentinels', blurb: 'Hold sites, watch flanks and slow pushes.' },
];
export const ROLE_IDS: readonly Role[] = ROLES.map((r) => r.id);
export const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLE_IDS as readonly string[]).includes(v);
export const roleOf = (id: Role) => ROLES.find((r) => r.id === id)!;

export const DIMS = [
  'smoke', 'wall', 'flash', 'recon', 'entry', 'clear', 'disrupt', 'stall', 'anchor', 'flank', 'retake', 'postplant', 'sustain', 'duel', 'angles', 'mobility',
] as const;
export type Dim = (typeof DIMS)[number];
export const isDim = (v: unknown): v is Dim => typeof v === 'string' && (DIMS as readonly string[]).includes(v);

/**
 * How each strength is named. `name` heads a list, `has` finishes "Strong …" in a pro, and
 * `lacks` finishes "No …" or, in a con, "Few …" (`few`, for things you count) or "Little …".
 * `unnamed` keeps a con about a gap from naming who brings a little of it: a teleport after a shot
 * counts a little toward long angles, but it isn't Operator play.
 */
export const DIM_INFO: Record<Dim, { name: string; has: string; lacks: string; few?: boolean; unnamed?: boolean; blurb: string }> = {
  smoke: { name: 'Smokes', has: 'smokes', lacks: 'smokes', few: true, blurb: 'Blocks sightlines so the team can cross or hold safely.' },
  wall: { name: 'Walls', has: 'long walls', lacks: 'long walls', few: true, blurb: 'Long screens that cut wide-open sightlines in one go.' },
  flash: { name: 'Flashes', has: 'flashes', lacks: 'flashes', few: true, blurb: 'Blinds enemies just before a fight.' },
  recon: { name: 'Information', has: 'information', lacks: 'information', blurb: 'Finds enemies before anyone peeks, with drones, darts and reveals.' },
  entry: { name: 'Entry', has: 'entry power', lacks: 'entry power', blurb: 'Takes the first fight and makes space on site.' },
  clear: { name: 'Clearing', has: 'utility to clear corners', lacks: 'utility to clear corners', blurb: 'Damage and drones that force enemies out of close spots.' },
  disrupt: { name: 'Crowd control', has: 'crowd control', lacks: 'crowd control', blurb: 'Stuns, concussions, slows and suppression that stop enemies fighting back.' },
  stall: { name: 'Delay', has: 'utility to slow a push', lacks: 'utility to slow a push', blurb: 'Mollies, slows and walls that buy time against a rush.' },
  anchor: { name: 'Site hold', has: 'site setups', lacks: 'site setups', few: true, blurb: 'Traps and turrets that let one player hold a site.' },
  flank: { name: 'Flank watch', has: 'flank watch', lacks: 'flank watch', blurb: 'Trips and alarms that warn of enemies coming from behind.' },
  retake: { name: 'Retake', has: 'retake utility', lacks: 'retake utility', blurb: 'Utility that takes a planted site back.' },
  postplant: { name: 'Post-plant', has: 'post-plant utility', lacks: 'post-plant utility', blurb: 'Mollies and lineups that stop a defuse from a distance.' },
  sustain: { name: 'Healing', has: 'healing', lacks: 'healing', blurb: 'Heals and revives that keep players in the round.' },
  duel: { name: 'Firepower', has: 'firepower', lacks: 'firepower', blurb: 'Agents who win fights on their own, with self-heals, kill resets and abilities made for duels.' },
  angles: { name: 'Long angles', has: 'Operator play', lacks: 'Operator play', unnamed: true, blurb: 'Holds a long sightline with the Operator, with a way out after the shot.' },
  mobility: { name: 'Speed', has: 'speed', lacks: 'speed', blurb: 'Fast movement for quick hits, rotations and lurks.' },
};

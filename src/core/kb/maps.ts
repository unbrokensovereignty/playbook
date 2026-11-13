/**
 * The maps: sites, the current competitive pool, and what each map, side and site needs.
 *
 * Needs are written like agent strengths, as bumps over the usual needs of a side: `wall +.5`
 * means long walls count half again as much here. `both` applies to either side; `attack` and
 * `defense` only to that side; `sites` only when planning for that site. Callouts and their places
 * on the minimap come from the game's own content (content.gen.ts).
 */
import { isDim, type Dim } from './roles.ts';
import { CALLOUTS } from './content.gen.ts';

export type Side = 'attack' | 'defense';
export const SIDES: readonly { id: Side; name: string }[] = [{ id: 'attack', name: 'Attack' }, { id: 'defense', name: 'Defense' }];
export type SiteId = 'A' | 'B' | 'C';

/**
 * How open a map or site is. On a tight one, fights happen at chokes and close corners, where
 * utility that needs walls (a concuss on impact, a trap strung between two walls, a wall across a
 * choke) works best; on an open one, fights happen across long sightlines and wide ground.
 */
export type Space = 'tight' | 'mixed' | 'open';

export const SPACE_INFO: Record<Space, { name: string; blurb: string }> = {
  tight: { name: 'Tight', blurb: 'Fights happen at chokes and close corners, where stuns, traps and walls across a way in do the most.' },
  mixed: { name: 'Mixed', blurb: 'Some long sightlines and some close corners, so most kits work.' },
  open: { name: 'Open', blurb: 'Fights happen across long sightlines and wide ground, where long walls, the Operator and information do the most.' },
};

/** Things on a map that change how a round is played, and that some kits use (kb/kitfit.ts). */
export type Mechanic = 'doors' | 'autodoors' | 'teleporters' | 'ropes' | 'ziplines' | 'breakable' | 'walls';
export const MECHANICS: Record<Mechanic, { name: string; blurb: string }> = {
  doors: { name: 'Doors', blurb: 'Doors worked by a switch, which open, shut or turn and can be heard across the map.' },
  autodoors: { name: 'Automatic doors', blurb: 'Doors that open by themselves, loudly, for anyone who comes near, so a push through them is heard.' },
  teleporters: { name: 'Teleporters', blurb: 'One-way teleporters that move a player between sites in a moment, with a sound both teams hear.' },
  ropes: { name: 'Ropes', blurb: 'Ropes up to high ground, which a player climbs slowly and in the open.' },
  ziplines: { name: 'Ziplines', blurb: 'Ziplines that carry a player across a gap fast, with their gun still out.' },
  breakable: { name: 'Breakable walls', blurb: 'Walls, doors, panels or glass that can be shot or blown open, which opens a new way in or a new line to shoot through for the rest of the round.' },
  walls: { name: 'Droppable walls', blurb: 'Walls that drop when their switch is shot, which shuts a way through for the rest of the round.' },
};

export interface SiteDef {
  id: SiteId;
  /** What the site is like, in a sentence or two. */
  about: string;
  /** How open the site is, when it differs from the map. */
  space?: Space;
  needs: { both?: string; attack?: string; defense?: string };
}

export interface MapDef {
  id: string;
  name: string;
  /** In the current competitive pool. */
  pool: boolean;
  about: string;
  /** How open the map is, on the whole. */
  space: Space;
  /**
   * Its mechanics, each with a sentence on where they are and what they change, and how much the
   * kit rules for it count here (`weight`, 1 when left out): a map with a single rope or door gives
   * a kit that uses them less to do than one built around them.
   */
  mechanics?: readonly { id: Mechanic; about: string; weight?: number }[];
  /** What wins on this map, in a sentence. */
  keys: string;
  needs: { both?: string; attack?: string; defense?: string };
  sites: readonly SiteDef[];
  /** Other names players use for a callout: the game's name → what people also call it. */
  aka?: Record<string, string>;
  /**
   * Where a callout really sits on the minimap, when the game's content places it badly: in a wall,
   * on the edge of its site or outside its own area. Each spot is the middle of the area the name
   * covers, where the game's own minimap labels and at least one other callout map put it (laid over
   * this minimap to line them up), and a site's spot is the middle of where the spike can be planted.
   * The specs check that every callout stands on the floor.
   */
  places?: Record<string, readonly [x: number, y: number]>;
}

/**
 * How big each minimap is in the game: the share of the minimap's width one game unit (a centimetre)
 * covers, as the game's content gives it (its maps' xMultiplier, read from valorant-api.com on
 * 5 November 2026). Corrode's wasn't in what could be read, so its rotation times wait for the next
 * refresh of the game's content.
 */
export const MINIMAP_SCALE: Readonly<Record<string, number>> = {
  abyss: 8.1e-5, ascent: 7e-5, bind: 5.9e-5, breeze: 7e-5, fracture: 7.8e-5, haven: 7.5e-5, icebox: 7.2e-5,
  lotus: 7.2e-5, pearl: 7.8e-5, split: 7.8e-5, summit: 7.5e-5, sunset: 7.8e-5,
};
/** How fast a player runs with a rifle out, in metres a second (the Vandal's and Phantom's run speed). */
export const RUN_SPEED = 5.4;

/** The game's patch that the numbers (pick rates, the map pool) were taken at. */
export const PATCH = '13.09';
/** The competitive pool since patch 13.08 (13 October 2026); it changes next on 6 January 2027. */
export const POOL_SINCE = '2026-10-13';

const DEFS: readonly MapDef[] = [
  {
    id: 'abyss', name: 'Abyss', pool: true, space: 'open',
    mechanics: [{ id: 'breakable', about: 'Both ends of A Vent are shut by doors that stop bullets until they’re broken, which opens the vent between mid and A Tower for the rest of the round.' }, { id: 'ropes', about: 'Ropes climb from A Site up to A Tower, from B Main up to Mid Bend and up to Mid Catwalk, and there’s one in Attack spawn, so the high ground over A and mid is slow to reach on foot.' }],
    about: 'An open map with no walls at its edges, so anyone who falls off dies. Long sightlines, a contested mid and two wide sites.',
    keys: 'Information and long walls. Pros run Sova with two controllers, often Harbor and Astra.',
    needs: { both: 'wall +.6; smoke +.15; recon +.35; mobility +.1; angles +.4', attack: 'entry +.1', defense: 'anchor +.1; retake +.1' },
    places: { 'A Bridge': [0.467, 0.041], 'A Link': [0.299, 0.273], 'A Lobby': [0.793, 0.244], 'A Main': [0.63, 0.114], 'A Secret': [0.189, 0.202], 'A Security': [0.257, 0.104], 'A Site': [0.424, 0.097], 'A Tower': [0.487, 0.255], 'A Vent': [0.471, 0.361], 'Attacker Side Spawn': [0.839, 0.485], 'B Danger': [0.556, 0.972], 'B Link': [0.307, 0.659], 'B Lobby': [0.823, 0.793], 'B Main': [0.618, 0.749], 'B Nest': [0.674, 0.904], 'B Site': [0.363, 0.904], 'B Tower': [0.283, 0.798], 'Defender Side Spawn': [0.07, 0.448], 'Mid Bend': [0.582, 0.637], 'Mid Bottom': [0.662, 0.533], 'Mid Catwalk': [0.539, 0.451], 'Mid Library': [0.453, 0.532], 'Mid Top': [0.318, 0.439] },
    sites: [
      { id: 'A', about: 'A large site reached from A Main and A Lobby, overlooked by A Tower and the bridge, with A Secret and A Security behind it.', needs: { both: 'recon +.15', attack: 'flash +.1' } },
      { id: 'B', about: 'Reached down B Main past B Danger and B Nest. B Tower looks over the site, and B Link joins it to mid.', needs: { both: 'wall +.2', attack: 'postplant +.1' } },
    ],
  },
  {
    id: 'ascent', name: 'Ascent', pool: false, space: 'mixed',
    mechanics: [{ id: 'doors', about: 'Each site has a door that a switch shuts or opens, so one way onto that site can be closed for a while.' }, { id: 'breakable', about: 'Panels on the two walls between Mid Courtyard and Mid Link stop bullets until broken, and the glass in A Window breaks at the first shot.' }],
    about: 'A two-site map that’s won in mid, where control of Market and Catwalk opens up both sites. Doors on each site can be shut.',
    keys: 'Mid control, with information and an Operator. Pros always play Omen and Sova, often with Chamber.',
    needs: { both: 'recon +.3; smoke +.1; duel +.15; angles +.4', attack: 'flash +.1', defense: 'anchor +.2; retake +.1; angles +.2' },
    aka: { 'A Tree': 'Tree', 'A Rafters': 'Heaven', 'Mid Bottom': 'Mid', 'Mid Courtyard': 'Mid' },
    places: { 'A Lobby': [0.602, 0.264], 'A Rafters': [0.249, 0.149], 'A Site': [0.311, 0.149], 'A Tree': [0.395, 0.295], 'A Window': [0.247, 0.284], 'A Wine': [0.486, 0.065], 'B Lobby': [0.561, 0.71], 'B Main': [0.398, 0.706], 'B Site': [0.272, 0.793], 'Defender Side Spawn': [0.126, 0.441], 'Mid Bottom': [0.401, 0.496], 'Mid Catwalk': [0.524, 0.411], 'Mid Courtyard': [0.497, 0.494], 'Mid Cubby': [0.464, 0.336], 'Mid Link': [0.524, 0.586], 'Mid Market': [0.302, 0.559], 'Mid Pizza': [0.308, 0.451] },
    sites: [
      { id: 'A', about: 'Entered through A Main (from A Lobby) or from mid through A Garden and Tree. A Rafters (Heaven) and A Wine overlook it.', needs: { both: 'clear +.1', attack: 'smoke +.1' } },
      { id: 'B', about: 'Entered through B Main or from mid through Market. B Boat House sits at the back of a deep site.', needs: { both: 'disrupt +.1', defense: 'stall +.1' } },
    ],
  },
  {
    id: 'bind', name: 'Bind', pool: true, space: 'tight',
    mechanics: [{ id: 'teleporters', about: 'Two one-way teleporters, one by each site, send a player to the other site in a moment. Both are loud, so teams use them for fakes and fast rotations.' }],
    about: 'No mid, but two one-way teleporters move players between sites fast. Narrow entrances make utility on each choke decisive.',
    keys: 'Clearing tight chokes and stopping defuses. Pros pair Viper with Brimstone, and add Fade for information and Yoru to take space.',
    needs: { both: 'clear +.3; flash +.15; smoke +.15; wall +.4; flank +.25; postplant +.15; angles -.6', defense: 'stall +.2; flank +.1' },
    aka: { 'A Bath': 'Showers', 'A Short': 'A Short', 'B Window': 'Hookah', 'A Tower': 'Heaven' },
    places: { 'A Cubby': [0.592, 0.458], 'A Exit': [0.925, 0.516], 'A Lamps': [0.592, 0.322], 'A Link': [0.527, 0.54], 'A Lobby': [0.743, 0.617], 'A Short': [0.64, 0.531], 'A Site': [0.725, 0.327], 'A Teleporter': [0.611, 0.408], 'A Tower': [0.759, 0.21], 'Attacker Side Spawn': [0.6, 0.9], 'B Elbow': [0.162, 0.299], 'B Exit': [0.486, 0.44], 'B Fountain': [0.245, 0.613], 'B Garden': [0.245, 0.421], 'B Link': [0.398, 0.591], 'B Long': [0.192, 0.5], 'B Short': [0.398, 0.513], 'B Site': [0.292, 0.272], 'B Teleporter': [0.15, 0.432], 'B Window': [0.317, 0.392], 'Defender Side Spawn': [0.521, 0.104] },
    sites: [
      { id: 'A', about: 'Hit through A Short and A Bath (Showers). A Lamps and A Tower (Heaven) look down on it, and the teleporter exits in A Short.', needs: { both: 'clear +.2; flash +.1' } },
      { id: 'B', about: 'Hit down B Long or through B Window (Hookah). B Garden and B Elbow give defenders close angles.', needs: { both: 'wall +.15; smoke +.1', defense: 'stall +.1' } },
    ],
  },
  {
    id: 'breeze', name: 'Breeze', pool: false, space: 'open',
    mechanics: [{ id: 'autodoors', about: 'A door at the mid end of Mid Hall opens by itself, loudly, for anyone or anything that comes near, from either side.' }, { id: 'ropes', about: 'A rope climbs from the back of A Site up to A Bridge, off the usual ways in, so it changes little.', weight: 0.25 }],
    about: 'A huge, open map with very long sightlines and wide sites. Crossing open ground is the whole fight.',
    keys: 'Long walls and an Operator. Viper is close to a must, with Sova for information.',
    needs: { both: 'wall +1; smoke +.15; duel +.3; recon +.25; mobility +.2; flank +.1; angles +.6', defense: 'anchor +.15' },
    aka: { 'A Pyramids': 'Pyramids', 'Mid Nest': 'Nest', 'B Elbow': 'Elbow' },
    places: { 'A Bridge': [0.731, 0.237], 'A Lobby': [0.66, 0.83], 'A Pyramids': [0.831, 0.463], 'A Ramp': [0.64, 0.295], 'A Shop': [0.839, 0.641], 'A Site': [0.935, 0.451], 'Attacker Side Spawn': [0.45, 0.88], 'B Back': [0.067, 0.294], 'B Elbow': [0.264, 0.414], 'B Main': [0.135, 0.538], 'B Site': [0.126, 0.275], 'B Tunnel': [0.328, 0.297], 'B Wall': [0.265, 0.232], 'B Window': [0.134, 0.645], 'Defender Side Arches': [0.38, 0.12], 'Defender Side Spawn': [0.565, 0.127], 'Mid Bottom': [0.479, 0.604], 'Mid Cannon': [0.327, 0.623], 'Mid Hall': [0.633, 0.561], 'Mid Nest': [0.431, 0.219], 'Mid Pillar': [0.463, 0.472], 'Mid Top': [0.432, 0.333], 'Mid Wood Doors': [0.639, 0.459] },
    sites: [
      { id: 'A', about: 'A big site with the Pyramids in the middle, reached through A Shop or from mid through Mid Hall. A Bridge links it to defender spawn.', needs: { both: 'wall +.2', attack: 'smoke +.1' } },
      { id: 'B', space: 'mixed', about: 'Reached through B Main and B Window, or from mid through B Tunnel. It’s tighter than A, with B Wall and B Back to clear.', needs: { both: 'clear +.1; smoke +.1' } },
    ],
  },
  {
    id: 'corrode', name: 'Corrode', pool: true, space: 'mixed',
    about: 'A two-site map with a three-lane mid. Mid and A Site have long sightlines, and B is tight, with narrow entries and many corners near the plant spots.',
    keys: 'Pros play two controllers here, Omen and Viper, with Fade for information and Waylay or Yoru to take space.',
    needs: { both: 'wall +.6; smoke +.15; recon +.2; angles -.3', attack: 'entry +.1', defense: 'stall +.15' },
    places: { 'A Crane': [0.189, 0.236], 'A Elbow': [0.331, 0.112], 'A Link': [0.433, 0.402], 'A Lobby': [0.721, 0.347], 'A Main': [0.61, 0.235], 'A Pocket': [0.469, 0.112], 'A Site': [0.398, 0.192], 'A Yard': [0.483, 0.215], 'Attacker Side Spawn': [0.883, 0.501], 'B Arch': [0.177, 0.819], 'B Elbow': [0.317, 0.891], 'B Link': [0.398, 0.612], 'B Lobby': [0.662, 0.725], 'B Main': [0.534, 0.808], 'B Site': [0.401, 0.768], 'B Tower': [0.294, 0.736], 'Defender Side Spawn': [0.127, 0.505], 'Mid Bottom': [0.692, 0.49], 'Mid Stairs': [0.54, 0.498], 'Mid Top': [0.386, 0.501], 'Mid Window': [0.318, 0.501] },
    sites: [
      { id: 'A', about: 'Reached through A Main or from mid through A Link. A Yard, A Pocket, A Elbow and A Crane give defenders many corners.', needs: { both: 'clear +.15; recon +.1' } },
      { id: 'B', space: 'tight', about: 'Reached through B Main or from mid through B Link. B Tower and B Arch overlook the plant.', needs: { both: 'smoke +.1', attack: 'postplant +.1' } },
    ],
  },
  {
    id: 'fracture', name: 'Fracture', pool: false, space: 'mixed',
    mechanics: [{ id: 'ziplines', about: 'Two one-way ziplines under Defender Side Spawn join the two attacker sides, so attackers can switch ends quickly.' }, { id: 'autodoors', about: 'A Door, between A Hall and A Main, opens by itself, loudly, when anyone comes near.' }, { id: 'ropes', about: 'Ropes climb from A Hall toward A Link and up to B Tower.', weight: 0.5 }],
    about: 'Attackers spawn on both ends and can hit a site from two sides at once, while defenders start in the middle.',
    keys: 'Smokes from both sides, and someone to watch the flank. Pros nearly always play Brimstone, with Fade and Cypher, and often Raze.',
    needs: { both: 'flank +.35; disrupt +.25; clear +.15; smoke +.1; mobility +.15; angles -.3', defense: 'stall +.2; retake +.15; recon +.15; flank +.2' },
    places: { 'A Dish': [0.686, 0.258], 'A Door': [0.706, 0.704], 'A Drop': [0.778, 0.407], 'A Gate': [0.681, 0.136], 'A Hall': [0.727, 0.757], 'A Link': [0.663, 0.455], 'A Main': [0.83, 0.65], 'A Rope': [0.617, 0.64], 'A Site': [0.877, 0.507], 'Attacker Side Bridge': [0.503, 0.153], 'Attacker Side Spawn': [0.499, 0.869], 'B Arcade': [0.22, 0.366], 'B Bench': [0.338, 0.285], 'B Canteen': [0.356, 0.575], 'B Generator': [0.315, 0.525], 'B Link': [0.342, 0.439], 'B Main': [0.14, 0.692], 'B Site': [0.099, 0.522], 'B Tower': [0.094, 0.443], 'B Tree': [0.273, 0.81], 'B Tunnel': [0.241, 0.676], 'Defender Side Spawn': [0.511, 0.429] },
    sites: [
      { id: 'A', about: 'Hit from A Main and A Door on one end, or from the other side down A Rope. A Dish and A Drop look over it.', needs: { both: 'disrupt +.15' } },
      { id: 'B', about: 'Hit from B Main and B Tree, or through B Arcade from the far side. B Tower and B Canteen hold over it.', needs: { both: 'clear +.15' } },
    ],
  },
  {
    id: 'haven', name: 'Haven', pool: true, space: 'mixed',
    about: 'Three sites, so defenders spread thin and rotate far. Mid control through Mid Doors and C Garage opens splits.',
    keys: 'Information and speed. Sova and Neon are favorites, and every defender has to hold alone at times.',
    needs: { both: 'recon +.3; mobility +.2; duel +.1; angles +.3', attack: 'entry +.1', defense: 'anchor +.2; retake +.15; mobility +.1' },
    aka: { 'A Tower': 'Heaven', 'A Long': 'A Long', 'C Garage': 'Garage' },
    places: { 'A Garden': [0.745, 0.386], 'A Link': [0.395, 0.323], 'A Lobby': [0.631, 0.378], 'A Long': [0.59, 0.202], 'A Sewer': [0.48, 0.381], 'A Site': [0.378, 0.138], 'A Tower': [0.31, 0.132], 'Attacker Side Spawn': [0.927, 0.533], 'B Back': [0.298, 0.499], 'B Site': [0.394, 0.499], 'C Cubby': [0.602, 0.802], 'C Garage': [0.493, 0.631], 'C Link': [0.32, 0.66], 'C Lobby': [0.732, 0.729], 'C Long': [0.716, 0.812], 'C Site': [0.357, 0.84], 'C Window': [0.416, 0.631], 'Defender Side Spawn': [0.119, 0.406], 'Mid Courtyard': [0.553, 0.509], 'Mid Doors': [0.62, 0.624], 'Mid Window': [0.672, 0.504] },
    sites: [
      { id: 'A', about: 'Hit through A Long or A Sewer (Short). A Tower (Heaven) and A Link let defenders hold from above and behind.', needs: { both: 'flash +.1; clear +.1' } },
      { id: 'B', space: 'tight', about: 'The small middle site, open to Mid Window and Mid Doors. It’s quick to take and just as quick to retake.', needs: { both: 'disrupt +.1', attack: 'postplant +.1' } },
      { id: 'C', about: 'Hit down C Long or from C Garage. C Cubby, C Window and C Link give defenders angles across the site.', needs: { both: 'smoke +.1; wall +.1', attack: 'postplant +.15' } },
    ],
  },
  {
    id: 'icebox', name: 'Icebox', pool: false, space: 'mixed',
    mechanics: [{ id: 'ziplines', about: 'A zipline crosses A Site from A Nest, so players reach the far side of the site fast.' }, { id: 'ropes', about: 'Ropes climb to the top of A Nest, to the high ground at both ends of A Site and to the high ground on B Site, where much of each site is held from.' }],
    about: 'Vertical sites full of tall boxes and high ground reached by ropes, with long open lanes into each site.',
    keys: 'Long walls and an Operator, with information to clear the many high spots.',
    needs: { both: 'wall +.8; recon +.25; duel +.2; clear +.15; angles +.4', attack: 'postplant +.2', defense: 'anchor +.15' },
    places: { 'A Belt': [0.433, 0.85], 'A Nest': [0.523, 0.81], 'A Pipes': [0.587, 0.774], 'A Rafters': [0.772, 0.773], 'A Screen': [0.692, 0.673], 'A Site': [0.699, 0.852], 'Attacker Side Spawn': [0.304, 0.651], 'B Back': [0.804, 0.28], 'B Cubby': [0.393, 0.22], 'B Fence': [0.755, 0.33], 'B Garage': [0.346, 0.401], 'B Green': [0.436, 0.321], 'B Hall': [0.683, 0.338], 'B Hut': [0.781, 0.409], 'B Kitchen': [0.724, 0.471], 'B Orange': [0.568, 0.389], 'B Site': [0.614, 0.219], 'B Snow Pile': [0.641, 0.431], 'B Snowman': [0.761, 0.147], 'B Tube': [0.567, 0.473], 'B Yellow': [0.485, 0.163], 'Defender Side Spawn': [0.855, 0.553], 'Mid Blue': [0.456, 0.522], 'Mid Boiler': [0.682, 0.536], 'Mid Pallet': [0.598, 0.617] },
    sites: [
      { id: 'A', about: 'Entered past A Belt and A Nest. A Pipes, A Rafters and A Screen give defenders high and close spots.', needs: { both: 'clear +.2; recon +.1' } },
      { id: 'B', about: 'Entered through B Yellow and B Green. Defenders hold from B Snowman, B Back, B Hall and B Kitchen.', needs: { both: 'wall +.2', attack: 'postplant +.1' } },
    ],
  },
  {
    id: 'lotus', name: 'Lotus', pool: true, space: 'tight',
    mechanics: [{ id: 'doors', about: 'A Door and C Door are worked by a switch and turn slowly and loudly, which changes the ways between the sites while they move.' }, { id: 'breakable', about: 'A wall on the way into A can be broken, which opens a second way onto the site for the rest of the round.' }, { id: 'ropes', about: 'A rope climbs from A Site up to A Top.', weight: 0.5 }],
    about: 'Three sites linked by rotating doors, with a breakable wall on A. Tight entrances and many corners on every site.',
    keys: 'Clearing corners and smoking chokes. Pros always play Omen, usually with Viper and Fade, and often Chamber.',
    needs: { both: 'clear +.3; recon +.2; smoke +.2; wall +.3; flash +.1; mobility +.15; angles +.1', attack: 'postplant +.1', defense: 'anchor +.1' },
    places: { 'A Door': [0.831, 0.517], 'A Drop': [0.897, 0.23], 'A Hut': [0.856, 0.329], 'A Link': [0.611, 0.469], 'A Lobby': [0.668, 0.728], 'A Main': [0.74, 0.487], 'A Root': [0.698, 0.592], 'A Rubble': [0.804, 0.602], 'A Site': [0.901, 0.302], 'A Stairs': [0.745, 0.331], 'A Top': [0.8, 0.233], 'A Tree': [0.857, 0.47], 'Attacker Side Spawn': [0.522, 0.824], 'B Main': [0.462, 0.574], 'B Pillars': [0.497, 0.672], 'B Site': [0.466, 0.425], 'B Upper': [0.563, 0.373], 'C Bend': [0.075, 0.513], 'C Door': [0.336, 0.57], 'C Gravel': [0.388, 0.262], 'C Hall': [0.185, 0.336], 'C Link': [0.353, 0.377], 'C Lobby': [0.315, 0.763], 'C Main': [0.248, 0.541], 'C Mound': [0.278, 0.621], 'C Site': [0.117, 0.463], 'C Waterfall': [0.294, 0.458], 'Defender Side Spawn': [0.638, 0.179] },
    sites: [
      { id: 'A', about: 'Hit through A Main and A Root or A Rubble. A Hut, A Tree, A Stairs and A Drop give defenders close angles.', needs: { both: 'clear +.15; flash +.1' } },
      { id: 'B', about: 'The small center site, through B Main and B Pillars. B Upper overlooks it.', needs: { both: 'disrupt +.1', attack: 'postplant +.1' } },
      { id: 'C', about: 'Hit through C Main and C Mound. Defenders hold from C Hall, C Gravel and C Waterfall.', needs: { both: 'recon +.1; wall +.1' } },
    ],
  },
  {
    id: 'pearl', name: 'Pearl', pool: false, space: 'mixed',
    about: 'A long, layered mid and two sites with long main entrances, with no doors, ropes or teleporters to play around.',
    keys: 'Smokes that reach anywhere, and information. Astra is the pro pick.',
    needs: { both: 'smoke +.2; recon +.25; wall +.2; mobility +.1; angles +.1', defense: 'anchor +.15' },
    aka: { 'B Main': 'B Long' },
    places: { 'A Art': [0.695, 0.512], 'A Dugout': [0.915, 0.308], 'A Flowers': [0.742, 0.214], 'A Link': [0.69, 0.353], 'A Main': [0.909, 0.499], 'A Restaurant': [0.746, 0.683], 'A Secret': [0.84, 0.184], 'A Site': [0.853, 0.312], 'Attacker Side Spawn': [0.539, 0.886], 'B Club': [0.282, 0.773], 'B Hall': [0.181, 0.289], 'B Link': [0.337, 0.522], 'B Main': [0.09, 0.529], 'B Ramp': [0.089, 0.688], 'B Screen': [0.074, 0.372], 'B Site': [0.185, 0.4], 'B Tower': [0.286, 0.4], 'B Tunnel': [0.341, 0.356], 'Defender Side Records': [0.44, 0.242], 'Defender Side Spawn': [0.57, 0.08], 'Defender Side Water': [0.573, 0.289], 'Mid Connector': [0.51, 0.369], 'Mid Doors': [0.509, 0.547], 'Mid Plaza': [0.544, 0.637], 'Mid Shops': [0.404, 0.741], 'Mid Top': [0.608, 0.728] },
    sites: [
      { id: 'A', about: 'Hit through A Main or from A Art and A Link. A Flowers, A Secret and A Dugout give defenders cover.', needs: { both: 'smoke +.1' } },
      { id: 'B', space: 'open', about: 'Hit down the long B Main from B Ramp, with B Screen, B Tower and B Hall to clear.', needs: { both: 'wall +.15; duel +.1' } },
    ],
  },
  {
    id: 'split', name: 'Split', pool: false, space: 'tight',
    mechanics: [{ id: 'ropes', about: 'Ropes lead from mid up into Mid Vent and on toward A Tower (Heaven), between A Sewer and A Main, and from B Site up to B Tower (Heaven), which defenders use to hold from above.' }],
    about: 'Tight, vertical sites with ropes up to high ground, and a mid that leads to both. Chokes everywhere.',
    keys: 'Smokes and clearing. Pros play Viper and Omen together, with Neon to take space and Fade for information.',
    needs: { both: 'clear +.3; smoke +.25; disrupt +.15; flank +.2; wall +.4; recon +.1; angles -.5', defense: 'stall +.15' },
    aka: { 'A Tower': 'A Heaven', 'B Tower': 'B Heaven', 'Mid Vent': 'Vents' },
    places: { 'A Back': [0.222, 0.146], 'A Lobby': [0.602, 0.143], 'A Main': [0.516, 0.224], 'A Rafters': [0.317, 0.272], 'A Ramps': [0.48, 0.349], 'A Screens': [0.158, 0.212], 'A Sewer': [0.654, 0.316], 'A Site': [0.335, 0.099], 'A Tower': [0.298, 0.33], 'B Alley': [0.213, 0.799], 'B Back': [0.26, 0.944], 'B Link': [0.625, 0.666], 'B Rafters': [0.351, 0.753], 'B Site': [0.321, 0.819], 'B Stairs': [0.315, 0.612], 'B Tower': [0.427, 0.684], 'Mid Bottom': [0.634, 0.547], 'Mid Mail': [0.463, 0.608], 'Mid Vent': [0.407, 0.497] },
    sites: [
      { id: 'A', about: 'Hit through A Main and up A Ramps, with A Rafters, A Screens and A Tower (Heaven) above the site.', needs: { both: 'flash +.1' } },
      { id: 'B', about: 'Hit through B Garage or from mid down B Link. B Tower (Heaven), B Rafters and B Alley overlook the site.', needs: { both: 'clear +.15; disrupt +.1' } },
    ],
  },
  {
    id: 'summit', name: 'Summit', pool: true, space: 'mixed',
    mechanics: [{ id: 'walls', about: 'Three walls, on A between A Art and A Garden, in mid between Mid Window and Mid Bottom, and on B between B Tower and B Site, drop when their switch is shot and stay shut for the rest of the round.' }, { id: 'ropes', about: 'A rope climbs from B Gym up to B Tower.', weight: 0.5 }],
    about: 'A newer two-site map with a wide mid around Mid Fountain and Mid Tiles, and lots of cover on both sites.',
    keys: 'Fast entry and information. Neon and Fade are the pro picks, with Chamber holding angles.',
    needs: { both: 'entry +.15; recon +.25; duel +.15; wall +.15; mobility +.1; angles +.4', defense: 'stall +.15' },
    places: { 'A Art': [0.786, 0.259], 'A Cave': [0.94, 0.245], 'A Garden': [0.786, 0.391], 'A Hall': [0.629, 0.228], 'A Link': [0.65, 0.364], 'A Lobby': [0.693, 0.738], 'A Main': [0.745, 0.568], 'A Site': [0.919, 0.44], 'Attacker Side Spawn': [0.49, 0.903], 'B Drop': [0.058, 0.262], 'B Gym': [0.275, 0.186], 'B Link': [0.326, 0.405], 'B Lobby': [0.266, 0.688], 'B Main': [0.141, 0.495], 'B Site': [0.132, 0.301], 'B Tower': [0.149, 0.216], 'B Trophy': [0.338, 0.273], 'Defender Side Spawn': [0.514, 0.086], 'Mid Bend': [0.637, 0.491], 'Mid Bottom': [0.486, 0.421], 'Mid Fountain': [0.504, 0.582], 'Mid Tiles': [0.363, 0.595], 'Mid Top': [0.532, 0.686], 'Mid Window': [0.485, 0.329] },
    sites: [
      { id: 'A', about: 'Hit through A Main or from mid through A Link. A Garden, A Art, A Hall and A Cave surround the site.', needs: { both: 'clear +.1', attack: 'flash +.1' } },
      { id: 'B', about: 'Hit through B Main or from mid through B Link. B Tower, B Gym, B Trophy and B Drop overlook the plant.', needs: { both: 'smoke +.1', attack: 'postplant +.1' } },
    ],
  },
  {
    id: 'sunset', name: 'Sunset', pool: true, space: 'tight',
    mechanics: [{ id: 'doors', about: 'A door between B Market and Mid Courtyard is shut or opened by a switch on the Market side, and breaks after enough damage, so the way between B and mid can be closed for a while.', weight: 0.5 }],
    about: 'A compact city map with a busy mid. B Market and A Elbow are tight, close-range fights.',
    keys: 'Information and fast entry. Pros play Omen, Neon and Fade, with Chamber as the sentinel.',
    needs: { both: 'recon +.25; entry +.15; clear +.15; smoke +.1; flank +.1; angles +.3' },
    places: { 'A Alley': [0.822, 0.187], 'A Elbow': [0.921, 0.391], 'A Link': [0.664, 0.274], 'A Lobby': [0.751, 0.627], 'A Main': [0.759, 0.5], 'A Site': [0.82, 0.375], 'Attacker Side Spawn': [0.538, 0.907], 'B Boba': [0.209, 0.275], 'B Lobby': [0.367, 0.744], 'B Main': [0.218, 0.617], 'B Market': [0.305, 0.484], 'B Site': [0.141, 0.462], 'Defender Side Spawn': [0.503, 0.081], 'Mid Bottom': [0.487, 0.625], 'Mid Courtyard': [0.465, 0.437], 'Mid Tiles': [0.571, 0.549], 'Mid Top': [0.494, 0.314] },
    sites: [
      { id: 'A', about: 'Hit through A Main and A Lobby, or from A Link. A Elbow and A Alley hold close angles.', needs: { both: 'clear +.1' } },
      { id: 'B', about: 'Hit through B Main or from mid through B Market. B Boba overlooks the site.', needs: { both: 'smoke +.1; disrupt +.1' } },
    ],
  },
];

export interface Callout { name: string; x: number; y: number }
export interface MapInfo extends MapDef {
  callouts: readonly Callout[];
  /** Spawn points on the minimap. */
  spawns: Record<Side, Callout | undefined>;
}

/** "wall +.4; smoke +.15" → bumps by strength. Throws on a typo, so a bad edit fails the tests. */
export function parseNeeds(spec: string | undefined, who: string): Partial<Record<Dim, number>> {
  const out: Partial<Record<Dim, number>> = {};
  for (const part of (spec ?? '').split(';').map((p) => p.trim()).filter(Boolean)) {
    const [dim, value] = part.split(/\s+/);
    const v = Number(value);
    if (!isDim(dim) || !Number.isFinite(v) || Math.abs(v) > 1) throw new Error(`${who}: can't read the need "${part}"`);
    out[dim] = (out[dim] ?? 0) + v;
  }
  return out;
}

export const MAPS: readonly MapInfo[] = DEFS.map((m) => {
  const callouts = (CALLOUTS[m.id] ?? []).map(([name, x, y]) => {
    const [px, py] = m.places?.[name] ?? [x, y];
    return { name, x: px, y: py };
  });
  const find = (name: string) => callouts.find((c) => c.name === name);
  return { ...m, callouts, spawns: { attack: find('Attacker Side Spawn'), defense: find('Defender Side Spawn') } };
});

export type MapId = string;
const BY_ID = new Map(MAPS.map((m) => [m.id, m]));
export const mapById = (id: string): MapInfo | undefined => BY_ID.get(id);
export const isMap = (v: unknown): v is MapId => typeof v === 'string' && BY_ID.has(v);
export const POOL: readonly MapInfo[] = MAPS.filter((m) => m.pool);
/** A callout as players say it: the spawns are "Attack spawn" and "Defense spawn". */
export const spotName = (name: string): string => (name === 'Attacker Side Spawn' ? 'Attack spawn' : name === 'Defender Side Spawn' ? 'Defense spawn' : name);

/** A callout's name with what players also call it: "A Tower (Heaven)". */
export function calloutLabel(map: MapInfo, name: string): string {
  const aka = map.aka?.[name];
  return aka && aka !== name ? `${name} (${aka})` : name;
}

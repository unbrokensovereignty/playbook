/**
 * For a map's page: what each site asks of attackers and of defenders, read off the same needs the
 * engine weighs (kb/maps.ts), and how long a rotation between two sites takes, walked along the
 * floor of the minimap (kb/floor.ts) at running speed.
 */
import { walk, type Spot } from '../kb/floor.ts';
import { MINIMAP_SCALE, parseNeeds, RUN_SPEED, type MapInfo, type SiteDef, type SiteId } from '../kb/maps.ts';
import type { Dim } from '../kb/roles.ts';

/** Most strengths named for a side of a site. */
export const SITE_WANTS = 2;

/** What a site asks for beyond the rest of the map, strongest first, on attack and on defense. */
export function siteWants(map: MapInfo, site: SiteDef): Record<'attack' | 'defense', Dim[]> {
  const of = (side: 'attack' | 'defense') => {
    const needs = parseNeeds(site.needs.both, map.name), mine = parseNeeds(site.needs[side], map.name);
    for (const [d, v] of Object.entries(mine) as [Dim, number][]) needs[d] = (needs[d] ?? 0) + v;
    return (Object.entries(needs) as [Dim, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, SITE_WANTS).map(([d]) => d);
  };
  return { attack: of('attack'), defense: of('defense') };
}

/** How long a run takes along a way on a map's minimap, in seconds; undefined without the map's scale. */
export function runSeconds(mapId: string, way: readonly Spot[]): number | undefined {
  const scale = MINIMAP_SCALE[mapId];
  if (!scale) return undefined;
  let length = 0;
  for (let i = 1; i < way.length; i++) length += Math.hypot(way[i]![0] - way[i - 1]![0], way[i]![1] - way[i - 1]![1]);
  return length / scale / 100 / RUN_SPEED;
}

/** The rotation between each two sites: about how many seconds a run from the middle of one to the other takes, the shortest way. */
export function rotations(map: MapInfo): { from: SiteId; to: SiteId; seconds: number }[] {
  const at = (id: SiteId): Spot | undefined => { const c = map.callouts.find((x) => x.name === `${id} Site`); return c && [c.x, c.y]; };
  const out: { from: SiteId; to: SiteId; seconds: number }[] = [];
  map.sites.forEach((a, i) => map.sites.slice(i + 1).forEach((b) => {
    const pa = at(a.id), pb = at(b.id);
    const seconds = pa && pb ? runSeconds(map.id, walk(map.id, pa, pb)) : undefined;
    if (seconds !== undefined) out.push({ from: a.id, to: b.id, seconds: Math.round(seconds) });
  }));
  return out;
}

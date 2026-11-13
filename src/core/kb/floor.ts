/**
 * Walking on a minimap: where the floor is (floor.gen.ts, read from the minimaps themselves) and
 * the way along it from one spot to another, so a route drawn on a minimap follows the corridors
 * and doorways instead of cutting through walls. Spots are fractions of the minimap's width and
 * height, as callouts are.
 */
import { FLOOR_SIZE as N, FLOORS } from './floor.gen.ts';

export type Spot = readonly [x: number, y: number];

interface Floor {
  /** 1 for each cell you can stand on, row by row from the top left. */
  on: Uint8Array;
  /** How far each floor cell is from the nearest wall, in cells (1 = next to one). */
  clear: Uint8Array;
}

const floors = new Map<string, Floor | null>();

function floorOf(map: string): Floor | null {
  if (floors.has(map)) return floors.get(map)!;
  const b64 = FLOORS[map];
  let f: Floor | null = null;
  if (b64) {
    const bits = atob(b64);
    const on = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) on[k] = (bits.charCodeAt(k >> 3) >> (k & 7)) & 1;
    // spread out from the cells along the walls, one ring at a time
    const clear = new Uint8Array(N * N);
    let ring: number[] = [];
    for (let k = 0; k < N * N; k++) {
      if (!on[k]) continue;
      const x = k % N, y = (k - x) / N;
      if (x === 0 || y === 0 || x === N - 1 || y === N - 1 || !on[k - 1] || !on[k + 1] || !on[k - N] || !on[k + N]) { clear[k] = 1; ring.push(k); }
    }
    for (let d = 2; ring.length && d < 255; d++) {
      const next: number[] = [];
      for (const k of ring) {
        for (const n of around(k)) if (on[n] && !clear[n]) { clear[n] = d; next.push(n); }
      }
      ring = next;
    }
    f = { on, clear };
  }
  floors.set(map, f);
  return f;
}

/** The (up to eight) cells next to cell `k`. */
function around(k: number): number[] {
  const x = k % N, y = (k - x) / N, out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N) out.push(k + dy * N + dx);
    }
  }
  return out;
}

const cellOf = ([x, y]: Spot): number => Math.min(N - 1, Math.max(0, Math.floor(y * N))) * N + Math.min(N - 1, Math.max(0, Math.floor(x * N)));
const spotOf = (k: number): Spot => [((k % N) + 0.5) / N, (Math.floor(k / N) + 0.5) / N];

/** The floor cell nearest to cell `k` (itself if it's floor), or -1 if there's none close by. */
function nearestFloor(f: Floor, k: number): number {
  if (f.on[k]) return k;
  const seen = new Set([k]);
  let ring = [k];
  for (let d = 0; d < 12 && ring.length; d++) {
    const next: number[] = [];
    for (const c of ring) {
      for (const n of around(c)) {
        if (seen.has(n)) continue;
        if (f.on[n]) return n;
        seen.add(n);
        next.push(n);
      }
    }
    ring = next;
  }
  return -1;
}

/** How much more a step next to a wall costs than one down the middle of a corridor. */
const WALL_COST = 1.5;

/** The cells from `a` to `b` along the floor, keeping off the walls where there's room, or null if there's no way. */
function cellPath(f: Floor, a: number, b: number): number[] | null {
  const bx = b % N, by = (b - bx) / N;
  const guess = (k: number) => {
    const dx = Math.abs((k % N) - bx), dy = Math.abs(Math.floor(k / N) - by);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const cost = new Float64Array(N * N).fill(Infinity);
  const from = new Int32Array(N * N).fill(-1);
  const done = new Uint8Array(N * N);
  const heap = new Heap();
  cost[a] = 0;
  heap.push(a, guess(a));
  while (heap.size) {
    const k = heap.pop();
    if (done[k]) continue;
    if (k === b) break;
    done[k] = 1;
    const kx = k % N;
    for (const n of around(k)) {
      if (!f.on[n] || done[n]) continue;
      // no squeezing diagonally between two walls
      const nx = n % N, diagonal = nx !== kx && n - nx !== k - kx;
      if (diagonal && (!f.on[k - kx + nx] || !f.on[n - nx + kx])) continue;
      const c = cost[k]! + (diagonal ? Math.SQRT2 : 1) * (1 + WALL_COST / f.clear[n]!);
      if (c < cost[n]!) { cost[n] = c; from[n] = k; heap.push(n, c + guess(n)); }
    }
  }
  if (!Number.isFinite(cost[b]!)) return null;
  const path = [b];
  while (path[path.length - 1] !== a) path.push(from[path[path.length - 1]!]!);
  return path.reverse();
}

/** Whether a straight line from `a` to `b` stays on the floor, at least `room` cells from the walls. */
function inSight(f: Floor, a: Spot, b: Spot, room: number): boolean {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * N * 2);
  for (let i = 1; i < steps; i++) {
    const k = cellOf([a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]);
    if (!f.on[k] || f.clear[k]! < room) return false;
  }
  return true;
}

const walks = new Map<string, readonly Spot[]>();

/**
 * The way from `a` to `b` on a map's minimap, as the spots to draw a line through, `a` and `b`
 * included: a straight line where it stays clear of the walls, and around them where it doesn't.
 * Without a floor for the map, or a way between the two, it's the straight line.
 */
export function walk(map: string, a: Spot, b: Spot): readonly Spot[] {
  const key = `${map} ${a.join()} ${b.join()}`;
  const known = walks.get(key);
  if (known) return known;
  let out: readonly Spot[] = [a, b];
  const f = floorOf(map);
  const ka = f ? nearestFloor(f, cellOf(a)) : -1, kb = f ? nearestFloor(f, cellOf(b)) : -1;
  const cells = f && ka >= 0 && kb >= 0 ? cellPath(f, ka, kb) : null;
  if (f && cells) {
    // pull the path straight: from each corner, on to the farthest cell still in sight
    const spots = [a, ...cells.slice(1, -1).map(spotOf), b];
    const room = (s: Spot) => Math.min(2, f.clear[cellOf(s)] ?? 0);
    const line: Spot[] = [a];
    for (let i = 0; i < spots.length - 1;) {
      let j = spots.length - 1;
      while (j > i + 1 && !inSight(f, spots[i]!, spots[j]!, Math.min(room(spots[i]!), room(spots[j]!), 2))) j--;
      line.push(spots[j]!);
      i = j;
    }
    out = line;
  }
  walks.set(key, out);
  return out;
}

/** Whether there's floor at a spot (or within a cell of it): where a callout should be. */
export function onFloor(map: string, s: Spot): boolean {
  const f = floorOf(map);
  if (!f) return false;
  const k = cellOf(s);
  return f.on[k] === 1 || around(k).some((n) => f.on[n] === 1 && f.clear[n]! >= 2);
}

/** Whether a map has a floor to walk on (its minimap was read). */
export const hasFloor = (map: string): boolean => !!floorOf(map);

/** A small binary heap of cells by priority, lowest first. */
class Heap {
  private keys: number[] = [];
  private pri: number[] = [];
  get size() { return this.keys.length; }
  push(k: number, p: number) {
    const { keys, pri } = this;
    let i = keys.length;
    keys.push(k); pri.push(p);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (pri[up]! <= p) break;
      keys[i] = keys[up]!; pri[i] = pri[up]!;
      i = up;
    }
    keys[i] = k; pri[i] = p;
  }
  pop(): number {
    const { keys, pri } = this;
    const top = keys[0]!;
    const k = keys.pop()!, p = pri.pop()!;
    if (keys.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mp = p;
        if (l < keys.length && pri[l]! < mp) { m = l; mp = pri[l]!; }
        if (r < keys.length && pri[r]! < mp) { m = r; mp = pri[r]!; }
        if (m === i) break;
        keys[i] = keys[m]!; pri[i] = pri[m]!;
        i = m;
      }
      keys[i] = k; pri[i] = p;
    }
    return top;
  }
}

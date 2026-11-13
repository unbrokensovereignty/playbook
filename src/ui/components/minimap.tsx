/**
 * A map's minimap with callouts, and a play's routes drawn on it: one color per step, an arrow
 * where each player ends up, a ring where a player holds, and a dashed start from spawn. A route
 * keeps to the floor between its callouts (core/kb/floor.ts), so it goes round walls, not through
 * them. The utility each step throws is drawn where it lands (smokes, walls, flashes, stuns and
 * information), and a play can run like a replay, one moment at a time (`replay`): the players walk
 * their routes and their utility lands when they get there. The minimap always sits on a dark frame
 * (like in the game), so the route colors read in both themes.
 *
 * How callouts show is the same on every minimap (useMapView): a dot at each callout's middle, and
 * names at the size chosen. A zoomable minimap also zooms (the wheel, the buttons, or + and − when
 * it has focus), moves (dragging, or the arrow keys) and fills the screen. Everything on it (names,
 * dots and marks) grows and shrinks with the map, so it always covers the same share of it; and it
 * can show the map's layers: ultimate orbs, features and plant spots (core/kb/features.ts). A play
 * can put the Spike where it's planted (`spike`), down from a moment of its replay.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Throw, ThrowKind } from '../../core/engine/plays.ts';
import { featuresOf, FEATURE_KINDS, layerOf, type FeatureKind, type MapFeature, type MapLayer } from '../../core/kb/features.ts';
import { walk, type Spot } from '../../core/kb/floor.ts';
import { mapById, spotName, type MapInfo } from '../../core/kb/maps.ts';
import { agentArtOf, minimapOf } from '../art.tsx';
import { agentById } from '../../core/kb/agents.ts';
import { useView } from '../state.ts';
import { IconButton } from './controls.tsx';

/**
 * A route on the minimap, who takes it (agent ids, drawn where it ends), what they throw, and the
 * moment it happens in (0 first), for a replay.
 */
export interface Route { route: readonly string[]; label?: string; who?: readonly string[]; throws?: readonly Throw[]; when?: number }

/**
 * A replay: the moment on show (`at`, the routes of later moments not walked yet), and a count that
 * starts the moment's walk again each time it changes.
 */
export interface Replay { at: number; run: number }
/**
 * The Spike, planted: where (`at`), what the spot is (`about`), and the moment of a replay it's down
 * from (`when`, 0 first); with `end`, it goes down as that moment's walk ends, when the players get there.
 */
export interface SpikeMark { at: Spot; about: string; when: number; end?: boolean }
/** How long a moment's walk takes in a replay, for the longest route in it (ms); shorter ones arrive sooner. */
export const REPLAY_MS = 1800;

/** What each kind of utility is called, for a legend. */
export const THROW_NAMES: Record<ThrowKind, string> = { smoke: 'Smoke', wall: 'Wall', flash: 'Flash', stun: 'Stun or concussion', recon: 'Information' };

let seq = 0;
const isSpawn = (name: string) => / Side Spawn$/.test(name);

/** The number of route colors; steps past it reuse them. */
export const ROUTE_COLORS = 5;

/** Callout name sizes, as a share of the size a printed sheet uses. */
export const TEXT_SIZES = [['s', 'Small', 0.45], ['m', 'Medium', 0.58], ['l', 'Large', 0.72], ['xl', 'Extra large', 0.9]] as const;
export type TextSize = (typeof TEXT_SIZES)[number][0];
/** How far a minimap zooms in, at most, and each step of the buttons and keys. */
export const ZOOM = { most: 5, step: 1.4 };

/** How callouts show on the minimaps, as the viewer last chose: kept like the other views. */
export function useMapView() {
  const yes = (v: string) => v === 'yes' || v === 'no';
  const [dots, setDots] = useView<'yes' | 'no'>('map.dots', 'yes', yes);
  const [text, setText] = useView<TextSize>('map.text', 'm', (v) => TEXT_SIZES.some(([id]) => id === v));
  const [orbs, setOrbs] = useView<'yes' | 'no'>('map.orbs', 'yes', yes);
  const [features, setFeatures] = useView<'yes' | 'no'>('map.features', 'yes', yes);
  const [plants, setPlants] = useView<'yes' | 'no'>('map.plants', 'yes', yes);
  return {
    dots: dots === 'yes', setDots: (v: boolean) => setDots(v ? 'yes' : 'no'),
    text, setText, scale: TEXT_SIZES.find(([id]) => id === text)![2],
    orbs: orbs === 'yes', setOrbs: (v: boolean) => setOrbs(v ? 'yes' : 'no'),
    features: features === 'yes', setFeatures: (v: boolean) => setFeatures(v ? 'yes' : 'no'),
    plants: plants === 'yes', setPlants: (v: boolean) => setPlants(v ? 'yes' : 'no'),
    /** The layers shown, in the order they're drawn. */
    layers: [...(orbs === 'yes' ? ['orbs' as const] : []), ...(features === 'yes' ? ['features' as const] : []), ...(plants === 'yes' ? ['plants' as const] : [])] as MapLayer[],
  };
}

export function Minimap({ map: id, routes = [], focus = -1, labels = 'routes', label, onFocus, zoomable = false, layers = [], plain = false, replay, spike, onSpot, children }: {
  map: string;
  routes?: readonly Route[];
  /** The step to bring forward (the others fade), or -1 for none. */
  focus?: number;
  /** Which callouts get names: those on the routes, all of them, or none. */
  labels?: 'routes' | 'all' | 'none';
  label?: string;
  onFocus?: (i: number) => void;
  /** Zoom and move it. */
  zoomable?: boolean;
  /** The layers to show over the callouts. */
  layers?: readonly MapLayer[];
  /** Ignore the viewer's choices (a printed sheet): names a size that reads on paper, with dots. */
  plain?: boolean;
  /** Run the routes as a replay, up to a moment (see Replay). */
  replay?: Replay | undefined;
  /** The Spike where it's planted, shown from its moment in a replay and always otherwise. */
  spike?: SpikeMark | undefined;
  /** Clicking the map picks the callout nearest the click (drawing a play): its name. */
  onSpot?: (name: string) => void;
  /** More to draw over the map, in its 0 to 100 units. */
  children?: ComponentChildren;
}) {
  const uid = useMemo(() => `mm${++seq}`, []);
  const view = useMapView();
  const scale = plain ? 1 : view.scale, dots = plain || view.dots;
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState<Spot>([0, 0]);
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; pan: Spot } | null>(null);
  // a drag that moved the map isn't a click on it
  const moved = useRef(false);
  const map = mapById(id);
  const art = minimapOf(id);
  // a new map starts zoomed out
  useEffect(() => { setZ(1); setPan([0, 0]); }, [id]);
  // full screen ends with Escape too, so follow the browser
  useEffect(() => {
    if (!zoomable) return;
    const onChange = () => setFull(!!wrap.current && document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [zoomable]);
  const canFull = zoomable && typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const toggleFull = () => {
    if (!canFull) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void wrap.current?.requestFullscreen().then(() => box.current?.focus({ preventScroll: true })).catch(() => {});
  };

  /** Keeps the minimap covering its frame: the pan, in shares of the frame, for zoom `k`. */
  const clampPan = (p: Spot, k: number): Spot => [Math.min(0, Math.max(1 - k, p[0])), Math.min(0, Math.max(1 - k, p[1]))];
  /** Zooms to `k`, keeping the point at (`fx`, `fy`) of the frame where it is. */
  const zoomTo = (k: number, fx = 0.5, fy = 0.5) => {
    const next = Math.min(ZOOM.most, Math.max(1, k));
    setPan((p) => clampPan([fx - ((fx - p[0]) * next) / z, fy - ((fy - p[1]) * next) / z], next));
    setZ(next);
  };
  const moveBy = (dx: number, dy: number) => setPan((p) => clampPan([p[0] + dx, p[1] + dy], z));

  // the wheel zooms (a listener of its own, so it can keep the page from scrolling)
  useEffect(() => {
    const el = box.current;
    if (!zoomable || !el) return;
    const onWheel = (e: WheelEvent) => {
      const k = z * (e.deltaY < 0 ? ZOOM.step ** 0.5 : 1 / ZOOM.step ** 0.5);
      if ((k < 1 && z === 1) || (k > ZOOM.most && z === ZOOM.most)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(k, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // each route's way along the floor, for drawing it and for walking its players along it in a replay
  const paths = useMemo(() => (map ? routes.map((r) => pathOf(r, map)) : []), [map?.id, routes.map((r) => r.route.join('>')).join('|')]);
  const run = replay && replay.at >= 0 ? replay : undefined;
  // a moment's walk: its routes draw in as their players walk them, and their utility lands as each arrives
  useLayoutEffect(() => {
    const root = svg.current;
    if (!root || !run) return;
    const now = routes.map((r, i) => ({ r, i, p: paths[i]! })).filter((x) => (x.r.when ?? 0) === run.at);
    if (!now.length) return;
    const longest = Math.max(...now.map((x) => x.p.length), 1e-6);
    const motion = document.documentElement.dataset.motion;
    const els = now.map(({ i, p }) => ({
      p,
      lines: [...root.querySelectorAll<SVGPolylineElement>(`[data-route="${i}"] .route-line:not(.spawn)`)],
      faces: [...root.querySelectorAll<SVGGElement>(`[data-face="${i}"]`)],
      throws: [...root.querySelectorAll<SVGGElement>(`[data-throws="${i}"]`)],
    }));
    const set = (t: number) => {
      for (const { p, lines, faces, throws } of els) {
        // every player walks at the same pace, so the longest route takes the whole moment
        const done = p.length < 1e-6 ? 1 : Math.min(1, (t * longest) / p.length);
        const walked = done * p.length;
        const [x, y] = pointAt(p, walked);
        for (const f of faces) f.setAttribute('transform', done >= 1 ? '' : `translate(${x - p.end[0]} ${y - p.end[1]})`);
        for (const l of lines) {
          const shown = Math.max(0, walked - p.spawn);
          l.style.strokeDasharray = done >= 1 ? '' : `${p.main} ${p.main + 1}`;
          l.style.strokeDashoffset = done >= 1 ? '' : `${p.main - shown}`;
          l.style.markerEnd = done >= 1 ? '' : 'none';
        }
        for (const g of throws) g.classList.toggle('waiting', done < 1);
      }
      // the Spike goes down as the moment's walk ends, when it's planted then
      if (spike?.end && spike.when === run.at) root.querySelector('.spike')?.classList.toggle('waiting', t < 1);
    };
    if (motion !== 'full') {
      // without movement, the moment shows at once and its utility fades in
      set(1);
      return;
    }
    set(0);
    let frame = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const t = Math.min(1, (time - start) / REPLAY_MS);
      set(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); set(1); };
  }, [run?.at, run?.run, paths, spike?.when, spike?.end]);

  if (!map) return null;
  const at = (name: string) => map.callouts.find((c) => c.name === name);
  const named = labels === 'all' ? map.callouts.map((c) => c.name) : labels === 'routes' ? [...new Set(routes.flatMap((r) => r.route))] : [];
  const spots = named.map((n) => at(n)).filter((c) => !!c);
  // names, dots and marks are drawn in the map's own units, so they grow with it as it zooms
  const k = scale, dot = dots ? DOT * k : 0;
  const faces = facesOf(routes, map);
  // in a replay, the routes of later moments aren't walked yet: their players wait where they start
  const later = (i: number) => !!run && (routes[i]?.when ?? 0) > run.at;
  const throws = routes.flatMap((r, i) => (later(i) ? [] : (r.throws ?? []).map((t) => ({ t, i }))));
  const shown = layers.length ? featuresOf(map.id).filter((f) => layers.includes(layerOf(f.kind))) : [];
  // in a replay, the Spike is down from its moment on
  const planted = spike && (!run || spike.when <= run.at) ? spike : undefined;

  const onKey = (e: KeyboardEvent) => {
    const step = 0.12 / z;
    const keys: Record<string, () => void> = {
      '+': () => zoomTo(z * ZOOM.step), '=': () => zoomTo(z * ZOOM.step), '-': () => zoomTo(z / ZOOM.step), '0': () => zoomTo(1), f: toggleFull,
      ArrowLeft: () => moveBy(step * z, 0), ArrowRight: () => moveBy(-step * z, 0), ArrowUp: () => moveBy(0, step * z), ArrowDown: () => moveBy(0, -step * z),
    };
    const run = keys[e.key];
    if (!run || e.ctrlKey || e.metaKey || e.altKey || (e.key.startsWith('Arrow') && z === 1)) return;
    e.preventDefault();
    run();
  };
  const onDown = (e: PointerEvent) => {
    moved.current = false;
    if (!zoomable || z === 1 || e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pan };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current, el = box.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const r = el.getBoundingClientRect();
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) moved.current = true;
    setPan(clampPan([d.pan[0] + (e.clientX - d.x) / r.width, d.pan[1] + (e.clientY - d.y) / r.height], z));
  };
  const onUp = (e: PointerEvent) => { if (drag.current?.id === e.pointerId) drag.current = null; };
  /** The callout nearest a click, for drawing a play (the map's own units, whatever the zoom). */
  const pick = (e: MouseEvent) => {
    const r = svg.current?.getBoundingClientRect();
    if (!onSpot || !r || !r.width) return;
    const [x, y] = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    const near = map.callouts.reduce((a, c) => (Math.hypot(c.x - x, c.y - y) < Math.hypot(a.x - x, a.y - y) ? c : a));
    onSpot(near.name);
  };

  const name = label ?? `Minimap of ${map.name}`;
  const stage = (
    <div class="minimap-stage" style={z === 1 ? undefined : { transform: `translate(${pan[0] * 100}%, ${pan[1] * 100}%) scale(${z})` }}>
      {art ? <img src={art} alt="" draggable={false} /> : <span class="minimap-none">{map.name}</span>}
      <svg ref={svg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={`${uid}-face`} clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath>
          {Array.from({ length: ROUTE_COLORS }, (_, i) => (
            <marker key={i} id={`${uid}-a${i}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" class={`route-fill r${i}`} />
            </marker>
          ))}
        </defs>
        {shown.map((f, i) => <Feature key={i} f={f} />)}
        {throws.map(({ t, i }, j) => <ThrowMark key={j} t={t} i={i} dim={focus >= 0 && focus !== i} fresh={!!run && (routes[i]?.when ?? 0) === run.at} />)}
        {routes.map((r, i) => (later(i) ? null : <RoutePath key={i} i={i} uid={uid} p={paths[i]!} dim={focus >= 0 && focus !== i} onFocus={onFocus} fresh={!!run && (r.when ?? 0) === run.at} />))}
        {faces.map((f) => <FaceMark key={`${f.i}-${f.id}`} f={f} uid={uid} dim={focus >= 0 && focus !== f.i} waiting={later(f.i)} />)}
        {/* over the faces, since a player often stands right by it */}
        {planted && <SpikeDown s={planted} />}
        {children}
        {dots && spots.map((c) => <circle key={c.name} cx={c.x * 100} cy={c.y * 100} r={dot} class="minimap-dot" style={{ strokeWidth: `${0.3 * dot}px` }} />)}
        {placeLabels(spots.map((c) => ({ text: shortName(c.name), x: c.x * 100, y: c.y * 100, clear: clearOf(faces, c.name, c.x * 100) })), k, dots ? dot : -1, [...shown.flatMap((f) => [f.at, ...(f.to ? [f.to] : [])]).map(([x, y]) => [x * 100, y * 100, 1.2] as const), ...(planted ? [[planted.at[0] * 100, planted.at[1] * 100, SPIKE + 0.3] as const] : []), ...faces.map((f) => [f.x, f.y, FACE + 0.3] as const), ...throws.filter(({ t }) => t.kind !== 'wall').map(({ t }) => [t.at[0] * 100, t.at[1] * 100, THROW_SIZE[t.kind]] as const)]).map((l) => (
          <text key={l.text} x={l.x} y={l.y} class="minimap-label" text-anchor={l.anchor} style={{ fontSize: `${3 * k}px`, strokeWidth: `${0.7 * k}px` }}>{l.text}</text>
        ))}
      </svg>
    </div>
  );
  if (!zoomable) return <div class={`minimap${onSpot ? ' picking' : ''}`} role="img" aria-label={name} onClick={pick}>{stage}</div>;
  return (
    <div ref={wrap} class={`minimap-wrap${full ? ' full' : ''}`}>
      <div
        ref={box} class={`minimap zoomable${z > 1 ? ' zoomed' : ''}${onSpot ? ' picking' : ''}`} tabIndex={0} role="group"
        aria-label={`${name}. Zoom with plus and minus, move with the arrow keys, and 0 zooms back out.${canFull ? ' F fills the screen.' : ''}`}
        onKeyDown={onKey} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClick={(e) => { if (!moved.current) pick(e); }}
        onDblClick={(e) => { if (onSpot) return; const r = box.current!.getBoundingClientRect(); zoomTo(z * ZOOM.step, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }}>
        {stage}
      </div>
      <div class="minimap-zoom">
        <IconButton icon="plus" label="Zoom in" size="sm" disabled={z >= ZOOM.most} onClick={() => zoomTo(z * ZOOM.step)} />
        <IconButton icon="minus" label="Zoom out" size="sm" disabled={z <= 1} onClick={() => zoomTo(z / ZOOM.step)} />
        <IconButton icon="expand" label="Show the whole map" size="sm" disabled={z <= 1} onClick={() => zoomTo(1)} />
        {canFull && <IconButton icon={full ? 'fullscreen-exit' : 'fullscreen'} label={full ? 'Leave full screen' : 'Fill the screen'} size="sm" onClick={toggleFull} />}
      </div>
    </div>
  );
}

/** The kinds of feature a map has on the layers shown, for a legend. */
export function featureKindsOn(map: string, layers: readonly MapLayer[]): typeof FEATURE_KINDS {
  const have = new Set(featuresOf(map).map((f) => f.kind));
  return FEATURE_KINDS.filter((k) => have.has(k.kind) && layers.includes(k.layer));
}

/** A feature's mark, as the legend draws it too, turned by its `angle`. */
function Feature({ f }: { f: MapFeature }) {
  const [x, y] = [f.at[0] * 100, f.at[1] * 100];
  const to = f.to && ([f.to[0] * 100, f.to[1] * 100] as const);
  return (
    <g class={`feature ${f.kind}`}>
      <title>{f.about}</title>
      {to && (f.kind === 'rope' || f.kind === 'zipline') && <line x1={x} y1={y} x2={to[0]} y2={to[1]} class="feature-link" style={{ strokeWidth: '0.45px' }} />}
      <FeatureMark kind={f.kind} x={x} y={y} angle={f.angle} />
      {to && <FeatureMark kind={f.kind} x={to[0]} y={to[1]} angle={f.angle} />}
    </g>
  );
}

/** A mark's shape in the map's units (`size` 1 is its size on the minimap), turned `angle` degrees clockwise. */
function FeatureMark({ kind, x, y, size = 1, angle }: { kind: FeatureKind; x: number; y: number; size?: number; angle?: number | undefined }) {
  const shape = markShape(kind, x, y, size);
  return angle ? <g transform={`rotate(${angle} ${x} ${y})`}>{shape}</g> : shape;
}

/**
 * Each kind's shape: symbols about two units across (a fiftieth of the map), whatever the size of
 * the thing in the game, so none stands out over the others. Doors, breakable and droppable walls
 * are bars, told apart by color and thickness.
 */
function markShape(kind: FeatureKind, x: number, y: number, size: number) {
  const u = size, line = { strokeWidth: `${0.25 * u}px` };
  const bar = (h: number) => <rect x={x - 1.1 * u} y={y - (h / 2) * u} width={2.2 * u} height={h * u} rx={Math.min(0.25, h / 2) * u} class="feature-mark" style={line} />;
  switch (kind) {
    case 'orb': return <path d={`M${x} ${y - 0.95 * u}L${x + 0.95 * u} ${y}L${x} ${y + 0.95 * u}L${x - 0.95 * u} ${y}Z`} class="feature-mark" style={line} />;
    case 'door': return bar(0.85);
    case 'breakable': case 'wall': return bar(0.5);
    case 'teleporter': return <circle cx={x} cy={y} r={0.85 * u} class="feature-mark hollow" style={{ strokeWidth: `${0.35 * u}px` }} />;
    case 'drop': return <rect x={x - 0.75 * u} y={y - 0.75 * u} width={1.5 * u} height={1.5 * u} rx={0.15 * u} class="feature-mark" style={line} />;
    case 'plant': return <path d={hexagon(x, y, 0.95 * u)} class="feature-mark" style={line} />;
    case 'safeplant': return <path d={hexagon(x, y, 0.8 * u)} class="feature-mark hollow" style={{ strokeWidth: `${0.35 * u}px` }} />;
    default: return <circle cx={x} cy={y} r={0.6 * u} class="feature-mark" style={line} />;
  }
}

/** A six-sided outline with a point at the top, `r` from its middle to each corner (the Spike's shape). */
const hexagon = (x: number, y: number, r: number): string =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3;
    return `${k ? 'L' : 'M'}${(x + r * Math.sin(a)).toFixed(2)} ${(y - r * Math.cos(a)).toFixed(2)}`;
  }).join('') + 'Z';

/** The planted Spike's size on the minimap: from its middle to a corner, in the map's units. */
const SPIKE = 1.8;

/** The Spike where it's planted (a replay hides it, as `waiting`, until the players get there). */
function SpikeDown({ s }: { s: SpikeMark }) {
  const [x, y] = [s.at[0] * 100, s.at[1] * 100];
  return (
    <g class="spike">
      <title>{`The Spike: ${s.about}`}</title>
      <path d={hexagon(x, y, SPIKE)} class="spike-body" />
      <path d={hexagon(x, y, SPIKE * 0.45)} class="spike-core" />
    </g>
  );
}

/** The planted Spike's mark on its own, for a legend. */
export function SpikeSwatch() {
  return <svg class="throw-swatch" viewBox={`${-SPIKE - 0.6} ${-SPIKE - 0.6} ${2 * SPIKE + 1.2} ${2 * SPIKE + 1.2}`} aria-hidden="true"><SpikeDown s={{ at: [0, 0], about: '', when: 0 }} /></svg>;
}

/** A feature kind's mark on its own, for a legend. */
export function FeatureSwatch({ kind }: { kind: FeatureKind }) {
  return (
    <svg class={`feature-swatch feature ${kind}`} viewBox="-3 -3 6 6" aria-hidden="true">
      {(kind === 'rope' || kind === 'zipline') && <line x1="-2.6" y1="0" x2="2.6" y2="0" class="feature-link" style={{ strokeWidth: '0.45px' }} />}
      <FeatureMark kind={kind} x={0} y={0} size={2} />
    </svg>
  );
}

interface Label { text: string; x: number; y: number; anchor: 'middle' | 'start' | 'end' }

/** A callout's dot, as its radius for 3-unit names (it grows and shrinks with them). */
const DOT = 0.8;
/** The space between a name and its spot's dot, for 3-unit names (a capital letter is about 2.2 units tall). */
const LABEL_GAP = 0.9;

/**
 * Puts each name above its spot, or below, right or left when that would cover a name already
 * placed or a mark (`marks`, each as its middle and how far it reaches), a little way from the spot's
 * dot (`dot` is its radius). Without dots (`dot` below 0) a name sits right on its spot. Sizes are
 * in the map's 0 to 100 units, for 3-unit text times `k`.
 */
function placeLabels(spots: readonly { text: string; x: number; y: number; clear?: readonly [number, number] }[], k = 1, dot = 0, marks: readonly (readonly [number, number, number])[] = []): Label[] {
  const boxes = marks.map(([x, y, r]) => ({ l: x - r, r: x + r, t: y - r, b: y + r }));
  const out: Label[] = [];
  const gap = LABEL_GAP * k + Math.max(0, dot);
  for (const s of spots) {
    const w = (s.text.length * 1.6 + 1) * k, h = 3.4 * k;
    // faces at the spot push the name out past them
    const [up, side] = s.clear ? [Math.max(gap, s.clear[0]), Math.max(gap, s.clear[1])] : [gap, gap];
    const tries: Label[] = dot < 0 && !s.clear ? [{ text: s.text, x: s.x, y: s.y + 1.1 * k, anchor: 'middle' }] : [
      { text: s.text, x: s.x, y: s.y - up, anchor: 'middle' },
      { text: s.text, x: s.x, y: s.y + 2.2 * k + up, anchor: 'middle' },
      { text: s.text, x: s.x + side, y: s.y + 1.1 * k, anchor: 'start' },
      { text: s.text, x: s.x - side, y: s.y + 1.1 * k, anchor: 'end' },
    ];
    const boxOf = (t: Label) => {
      const l = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'start' ? t.x : t.x - w;
      return { l, r: l + w, t: t.y - h + 0.6 * k, b: t.y + 0.6 * k };
    };
    // the first way that covers nothing, or else the one that covers least
    const covered = (t: Label) => { const b = boxOf(t); return boxes.reduce((n, o) => n + Math.max(0, Math.min(b.r, o.r) - Math.max(b.l, o.l)) * Math.max(0, Math.min(b.b, o.b) - Math.max(b.t, o.t)), 0); };
    const free = tries.map((t) => ({ t, n: covered(t) })).reduce((a, b) => (b.n < a.n ? b : a)).t;
    boxes.push(boxOf(free));
    out.push(free);
  }
  return out;
}

/** Short names for a small map: "Attack spawn", and "Arches" for "Defender Side Arches". */
const shortName = (name: string): string => spotName(name).replace(/^(Attacker|Defender) Side /, '');

/** The line through a route's spots, along the floor from each one to the next. */
const along = (map: string, spots: readonly Spot[]): Spot[] => spots.flatMap((s, i) => (i === 0 ? [s] : walk(map, spots[i - 1]!, s).slice(1)));

/**
 * A route's way along the floor, in the map's 0 to 100 units: the walk out of spawn (only a
 * direction, so it's dashed), the rest, both together for walking a player along it, and lengths.
 */
interface Path { spawnLine: Spot[]; mainLine: Spot[]; all: Spot[]; spawn: number; main: number; length: number; end: Spot; hold: boolean }
const scaled = (ps: readonly Spot[]): Spot[] => ps.map(([x, y]) => [x * 100, y * 100]);
const lengthOf = (ps: readonly Spot[]) => ps.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - ps[i - 1]![0], p[1] - ps[i - 1]![1]) : 0), 0);
function pathOf(r: Route, map: MapInfo): Path {
  const pts = r.route.map((n) => map.callouts.find((c) => c.name === n)).filter((c) => !!c).map((c): Spot => [c.x, c.y]);
  if (!pts.length) return { spawnLine: [], mainLine: [], all: [], spawn: 0, main: 0, length: 0, end: [0, 0], hold: true };
  const fromSpawn = isSpawn(r.route[0]!) && pts.length > 1;
  const spawnLine = fromSpawn ? scaled(along(map.id, pts.slice(0, 2))) : [];
  const mainLine = scaled(along(map.id, fromSpawn ? pts.slice(1) : pts));
  const all = [...spawnLine, ...mainLine.slice(spawnLine.length ? 1 : 0)];
  const spawn = lengthOf(spawnLine), main = mainLine.length > 1 ? lengthOf(mainLine) : 0;
  return { spawnLine, mainLine, all, spawn, main, length: spawn + main, end: all[all.length - 1]!, hold: pts.length === 1 };
}
/** The point `d` units along a path. */
function pointAt(p: Path, d: number): Spot {
  for (let i = 1; i < p.all.length; i++) {
    const [a, b] = [p.all[i - 1]!, p.all[i]!], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= seg) return seg ? [a[0] + ((b[0] - a[0]) * d) / seg, a[1] + ((b[1] - a[1]) * d) / seg] : a;
    d -= seg;
  }
  return p.end;
}

/** A face's radius on the minimap, in the map's units. */
const FACE = 2.3;
/**
 * A player's face on the minimap: who, on which route (`i`), at the end of it (`spot`), where it's
 * drawn there, and where it waits at the route's start before a replay walks it.
 */
interface Face { id: string; i: number; spot: string; x: number; y: number; sx: number; sy: number }

/** Where each player's face goes: where their route ends (and starts), side by side with anyone else there. */
function facesOf(routes: readonly Route[], map: MapInfo): Face[] {
  const sideBySide = (pick: (r: Route) => string | undefined) => {
    const at = new Map<string, { id: string; i: number }[]>();
    routes.forEach((r, i) => {
      const name = pick(r);
      if (name && r.who?.length) at.set(name, [...(at.get(name) ?? []), ...r.who.map((id) => ({ id, i }))]);
    });
    const out = new Map<string, { spot: string; x: number; y: number }>();
    for (const [name, who] of at) {
      const c = map.callouts.find((x) => x.name === name);
      if (c) who.forEach((w, j) => out.set(`${w.i}-${w.id}`, { spot: name, x: c.x * 100 + (j - (who.length - 1) / 2) * FACE * 2.15, y: c.y * 100 }));
    }
    return out;
  };
  const ends = sideBySide((r) => r.route[r.route.length - 1]), starts = sideBySide((r) => r.route[0]);
  return routes.flatMap((r, i) => (r.who ?? []).flatMap((id) => {
    const e = ends.get(`${i}-${id}`), st = starts.get(`${i}-${id}`);
    return e ? [{ id, i, ...e, sx: st?.x ?? e.x, sy: st?.y ?? e.y }] : [];
  }));
}

/** How far a name keeps from its spot, up or down and to the side, to clear the faces there (none: no faces). */
function clearOf(faces: readonly Face[], spot: string, x: number): [number, number] | undefined {
  const here = faces.filter((f) => f.spot === spot);
  if (!here.length) return undefined;
  return [FACE + 0.6, Math.max(...here.map((f) => Math.abs(f.x - x))) + FACE + 0.6];
}

/** A player's face where their route ends, ringed in the route's color; while `waiting`, where it starts. */
function FaceMark({ f, uid, dim, waiting }: { f: Face; uid: string; dim: boolean; waiting: boolean }) {
  const art = agentArtOf(f.id), name = agentById(f.id)?.name ?? f.id;
  return (
    <g data-face={f.i} transform={waiting ? `translate(${f.sx - f.x} ${f.sy - f.y})` : undefined} class={`route-face r${f.i % ROUTE_COLORS}${dim ? ' dim' : ''}${waiting ? ' waiting' : ''}`}>
      <title>{name}</title>
      <circle cx={f.x} cy={f.y} r={FACE + 0.3} class="route-face-ring" />
      {art
        ? <image href={art} x={f.x - FACE} y={f.y - FACE} width={FACE * 2} height={FACE * 2} clip-path={`url(#${uid}-face)`} preserveAspectRatio="xMidYMid slice" />
        : <text x={f.x} y={f.y + 0.9} class="route-face-initial" text-anchor="middle">{[...name][0]}</text>}
    </g>
  );
}

function RoutePath({ i, uid, p, dim, onFocus, fresh }: { i: number; uid: string; p: Path; dim: boolean; onFocus?: (i: number) => void; fresh: boolean }) {
  const color = i % ROUTE_COLORS;
  const cls = `route r${color}${dim ? ' dim' : ''}${fresh ? ' fresh' : ''}`;
  const hover = onFocus ? { onMouseEnter: () => onFocus(i), onMouseLeave: () => onFocus(-1) } : {};
  if (!p.all.length) return null;
  const pts = (ps: readonly Spot[]) => ps.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  if (p.hold) {
    const [x, y] = p.end;
    return <g data-route={i} class={cls} {...hover}><circle cx={x} cy={y} r="2.4" class="route-hold" /><circle cx={x} cy={y} r="0.9" class="route-fill" /></g>;
  }
  // the walk out of spawn is only a direction, so it's dashed and the line proper starts after it
  const arrow = `url(#${uid}-a${color})`;
  const single = p.mainLine.length < 2;
  const start = p.mainLine[0]!;
  return (
    <g data-route={i} class={cls} {...hover}>
      {p.spawnLine.length > 1 && <polyline points={pts(p.spawnLine)} class="route-line spawn" marker-end={single ? arrow : undefined} />}
      {!single && <polyline points={pts(p.mainLine)} class="route-line" marker-end={arrow} />}
      {!single && <circle cx={start[0]} cy={start[1]} r="1.1" class="route-fill" />}
      {single && <circle cx={start[0]} cy={start[1]} r="2.4" class="route-hold" />}
    </g>
  );
}

/** How far each kind of utility reaches from its middle on the minimap (map units), for its mark and to keep names off it. */
const THROW_SIZE: Record<ThrowKind, number> = { smoke: 3.2, wall: 0.9, flash: 2, stun: 1.8, recon: 4.5 };

/** One piece of utility where it lands, in its step's color: `fresh` when it lands in the moment a replay is on. */
function ThrowMark({ t, i, dim, fresh }: { t: Throw; i: number; dim: boolean; fresh: boolean }) {
  const [x, y] = [t.at[0] * 100, t.at[1] * 100], r = THROW_SIZE[t.kind];
  const who = agentById(t.who)?.name ?? t.who;
  const shape = (() => {
    switch (t.kind) {
      case 'smoke': return <circle cx={x} cy={y} r={r} class="throw-smoke" />;
      case 'wall': return <line x1={x} y1={y} x2={t.to![0] * 100} y2={t.to![1] * 100} class="throw-wall" />;
      case 'flash': {
        // an eight-pointed burst
        const d = Array.from({ length: 16 }, (_, k) => {
          const a = (k * Math.PI) / 8, rr = k % 2 ? r * 0.42 : r;
          return `${k ? 'L' : 'M'}${(x + rr * Math.sin(a)).toFixed(2)} ${(y - rr * Math.cos(a)).toFixed(2)}`;
        }).join('') + 'Z';
        return <path d={d} class="throw-flash" />;
      }
      case 'stun': return <><circle cx={x} cy={y} r={r} class="throw-stun" /><circle cx={x} cy={y} r={r * 0.45} class="throw-stun" /></>;
      case 'recon': return <><circle cx={x} cy={y} r={r} class="throw-recon" /><circle cx={x} cy={y} r={0.7} class="throw-recon-dot" /></>;
    }
  })();
  return (
    <g data-throws={i} class={`throw ${t.kind} r${i % ROUTE_COLORS}${dim ? ' dim' : ''}${fresh ? ' fresh' : ''}`}>
      <title>{`${who}’s ${THROW_NAMES[t.kind].toLowerCase()}`}</title>
      {shape}
    </g>
  );
}

/** A kind of utility's mark on its own, for a legend. */
export function ThrowSwatch({ kind }: { kind: ThrowKind }) {
  const t: Throw = { kind, who: '', at: [0, 0], ...(kind === 'wall' ? { to: [0.05, 0] as Spot } : {}) };
  const view = kind === 'wall' ? '-0.8 -2.5 6.6 5' : `${-THROW_SIZE[kind] - 0.5} ${-THROW_SIZE[kind] - 0.5} ${2 * THROW_SIZE[kind] + 1} ${2 * THROW_SIZE[kind] + 1}`;
  return <svg class="throw-swatch minimap-ink r1" viewBox={view} aria-hidden="true"><ThrowMark t={t} i={1} dim={false} fresh={false} /></svg>;
}

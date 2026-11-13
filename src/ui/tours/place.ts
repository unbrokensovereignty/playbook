/**
 * Where a tour's card goes beside the thing it points at. Pure, so the unit tests can check it.
 */
import type { Side } from './list.ts';

const GAP = 14, EDGE = 12;

export interface Rect { left: number; top: number; width: number; height: number }

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

export interface Placed { x: number; y: number; side: Side | 'center' | 'corner'; /** It's clear of the target (false: there was no room, and it covers some of it). */ clear: boolean }

/**
 * Where the card goes: beside the target on the side asked for (or the first with room), never over
 * it if it can help it. With no room beside it, a corner of the screen clear of it, as far from it
 * as can be (the spotlight shows where to look); a target too big even for that gets the card on
 * the side where it covers the least of it (`clear` is false), the side asked for when that's about
 * as good. With nothing to point at, the middle of the screen.
 */
export function placeCard(t: Rect | null, card: { width: number; height: number }, want: Side | undefined, vw: number, vh: number): Placed {
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - EDGE - card.width));
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - EDGE - card.height));
  const done = (p: { x: number; y: number }, side: Placed['side'], clear = true): Placed => ({ x: Math.round(clampX(p.x)), y: Math.round(clampY(p.y)), side, clear });
  if (!t) return done({ x: (vw - card.width) / 2, y: (vh - card.height) / 2 }, 'center');
  const room: Record<Side, number> = {
    right: vw - EDGE - (t.left + t.width + GAP) - card.width,
    left: t.left - GAP - EDGE - card.width,
    below: vh - EDGE - (t.top + t.height + GAP) - card.height,
    above: t.top - GAP - EDGE - card.height,
  };
  const order = [...new Set<Side>([...(want ? [want] : []), 'right', 'below', 'left', 'above'])];
  const at = (s: Side) => {
    if (s === 'right') return { x: t.left + t.width + GAP, y: t.top + t.height / 2 - card.height / 2 };
    if (s === 'left') return { x: t.left - GAP - card.width, y: t.top + t.height / 2 - card.height / 2 };
    if (s === 'below') return { x: t.left + t.width / 2 - card.width / 2, y: t.top + t.height + GAP };
    return { x: t.left + t.width / 2 - card.width / 2, y: t.top - GAP - card.height };
  };
  const fits = order.find((s) => room[s] >= 0);
  if (fits) return done(at(fits), fits);
  const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
  const corner = ([[vw - EDGE - card.width, EDGE], [EDGE, EDGE], [vw - EDGE - card.width, vh - EDGE - card.height], [EDGE, vh - EDGE - card.height]] as const)
    .map(([x, y]) => ({ left: x, top: y, width: card.width, height: card.height }))
    .filter((c) => overlap(c, t) === 0)
    .sort((a, b) => Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) - Math.hypot(a.left + a.width / 2 - cx, a.top + a.height / 2 - cy))[0];
  if (corner) return done({ x: corner.left, y: corner.top }, 'corner');
  const covers = (s: Side) => { const p = done(at(s), s); return overlap({ left: p.x, top: p.y, width: card.width, height: card.height }, t); };
  // a side later in the order has to cover at least a few lines less to win
  const side = order.reduce((a, b) => (covers(b) + card.width * 8 < covers(a) ? b : a));
  return done(at(side), side, false);
}

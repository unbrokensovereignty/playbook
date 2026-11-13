/**
 * Tooltips for anything with a `data-tip`. One tooltip lives at the top of the page, above every
 * panel, dialog and scroll box, and is placed next to its element: on the side it asks for
 * (`data-tip-side`: above by default, `right` or `below`), flipped when there's no room there, and
 * always kept fully on screen.
 */

const GAP = 8, EDGE = 8, DELAY = 350;

type Side = 'above' | 'below' | 'right' | 'left';

/** Where a tooltip of this size goes next to `a`, inside a `vw` × `vh` screen. Exported for tests. */
export function placeTip(a: { left: number; top: number; width: number; height: number }, tip: { width: number; height: number }, want: Side, vw: number, vh: number): { x: number; y: number; side: Side } {
  const fits: Record<Side, boolean> = {
    above: a.top - GAP - tip.height >= EDGE,
    below: a.top + a.height + GAP + tip.height <= vh - EDGE,
    right: a.left + a.width + GAP + tip.width <= vw - EDGE,
    left: a.left - GAP - tip.width >= EDGE,
  };
  const order: Record<Side, Side[]> = { above: ['above', 'below', 'right', 'left'], below: ['below', 'above', 'right', 'left'], right: ['right', 'left', 'above', 'below'], left: ['left', 'right', 'above', 'below'] };
  const side = order[want].find((s) => fits[s]) ?? want;
  let x: number, y: number;
  if (side === 'above' || side === 'below') {
    x = a.left + a.width / 2 - tip.width / 2;
    y = side === 'above' ? a.top - GAP - tip.height : a.top + a.height + GAP;
  } else {
    x = side === 'right' ? a.left + a.width + GAP : a.left - GAP - tip.width;
    y = a.top + a.height / 2 - tip.height / 2;
  }
  // keep it all on screen
  x = Math.max(EDGE, Math.min(x, vw - EDGE - tip.width));
  y = Math.max(EDGE, Math.min(y, vh - EDGE - tip.height));
  return { x: Math.round(x), y: Math.round(y), side };
}

let box: HTMLDivElement | null = null;
let current: Element | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function show(el: Element) {
  const text = el.getAttribute('data-tip');
  if (!text || !box || !el.isConnected) return;
  current = el;
  box.textContent = text;
  box.classList.remove('on');
  box.style.left = '0px';
  box.style.top = '0px';
  box.hidden = false;
  const side = (el.getAttribute('data-tip-side') as Side | null) ?? 'above';
  const p = placeTip(el.getBoundingClientRect(), box.getBoundingClientRect(), side === 'right' || side === 'below' || side === 'left' ? side : 'above', innerWidth, innerHeight);
  box.style.left = `${p.x}px`;
  box.style.top = `${p.y}px`;
  box.dataset.side = p.side;
  // the next frame, so the fade starts from the new place
  requestAnimationFrame(() => box?.classList.add('on'));
}

function hide() {
  if (timer) { clearTimeout(timer); timer = null; }
  current = null;
  if (box) { box.hidden = true; box.classList.remove('on'); }
}

const tipOf = (t: EventTarget | null): Element | null => (t instanceof Element ? t.closest('[data-tip]') : null);

/** Starts the tooltips (once, when the app starts). */
export function installTooltips() {
  if (box) return;
  box = document.createElement('div');
  box.className = 'tooltip';
  box.setAttribute('role', 'tooltip');
  box.hidden = true;
  document.body.appendChild(box);
  document.addEventListener('pointerover', (e) => {
    const el = tipOf(e.target);
    if (el === current) return;
    hide();
    if (!el || (e as PointerEvent).pointerType === 'touch') return;
    timer = setTimeout(() => show(el), DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    const el = tipOf(e.target);
    if (el && el.contains((e as PointerEvent).relatedTarget as Node | null)) return;
    if (el) hide();
  });
  document.addEventListener('focusin', (e) => {
    const el = tipOf(e.target);
    hide();
    // only for keyboard focus, like :focus-visible
    if (el && el instanceof HTMLElement && el.matches(':focus-visible')) show(el);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' || current && !(current as HTMLElement).matches?.(':focus-visible')) hide(); }, true);
  addEventListener('scroll', hide, true);
  addEventListener('resize', hide);
  // a tooltip's element can vanish (a page change): don't leave the tooltip behind
  setInterval(() => { if (current && !current.isConnected) hide(); }, 500);
}

/**
 * Keeps keyboard focus on the page when what had it goes away: a button that turns off (Undo with
 * nothing left, Back on the first step), or one that leaves with what it acted on (a deleted
 * plan's row, a list that empties, a plan put away, "Use the usual value" once it is). Focus moves
 * to the nearest control after where it was, else before it, so Tab carries on from there instead
 * of from the top of the page. A message's button that goes (Undo used, or the message timing
 * out) hands focus back to where it was before the message. One that's only moved (a row put
 * earlier or later) keeps focus.
 */
import { keysMoveFocus } from './state.ts';

export const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const shown = (x: HTMLElement) => x.offsetParent !== null;
/** The short messages at the bottom. */
const MESSAGES = '.toasts';
const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
/** Focus has fallen to the page itself. */
const fallen = () => !document.activeElement || document.activeElement === document.body;

/**
 * The nearest control to where a node was taken out of `box` (between `before` and `after`): the
 * first one after that spot, else the last one before it, looking further out until one is found.
 * It stays on the page, or in the dialog, it was on.
 */
function nearest(box: Node, before: Node | null, after: Node | null): HTMLElement | null {
  let at: Element | null = box instanceof Element ? box : box.parentElement;
  let next = after, prev = before;
  while (at) {
    const n = next, p = prev;
    const later = (x: HTMLElement) => n ? n === x || n.contains(x) || follows(n, x) : p ? follows(p, x) && !p.contains(x) : true;
    const items = [...at.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(shown);
    const found = items.find(later) ?? items.filter((x) => !later(x)).at(-1);
    if (found) return found;
    if (at.matches(`.page, [role=dialog], ${MESSAGES}, body`)) return null;
    // nothing here: look around this box as a whole
    next = null; prev = at; at = at.parentElement;
  }
  return null;
}

/** What each open dialog gives focus back to when it closes. (What has focus is kept track of too.) */
const watched = new Set<HTMLElement>();
/** Where focus goes instead of a watched element that was taken out. */
const standIns = new WeakMap<HTMLElement, HTMLElement>();

/** Keeps track of where `el` is, so focus can go near there if it's gone by the time it's wanted back. */
export function remember(el: HTMLElement) { watched.add(el); }
/** Stops keeping track of `el`, and says where focus should go for it: itself if it's still here, else what's nearest where it was. */
export function placeOf(el: HTMLElement): HTMLElement | null {
  watched.delete(el);
  if (el.isConnected) return el;
  const s = standIns.get(el);
  return s?.isConnected && shown(s) ? s : null;
}

/** Watches the page and moves focus as described above. Returns a stop function. */
export function keepFocus(): () => void {
  let last: HTMLElement | null = null, moved: HTMLElement | null = null;
  /** What last had focus, even after a click elsewhere: a list put in a new order takes it out and puts it back. */
  let had: HTMLElement | null = null;
  /** What had focus before it went into the messages. */
  let beforeMessages: HTMLElement | null = null;
  const track = (e: FocusEvent) => {
    const to = e.target instanceof HTMLElement ? e.target : null;
    if (to?.closest(MESSAGES) && last && !last.closest(MESSAGES)) beforeMessages = last;
    last = to; had = to;
  };
  // focus left for nothing (a click on the page): what had it no longer counts
  const leave = (e: FocusEvent) => {
    const el = last;
    if (e.relatedTarget || !el || e.target !== el) return;
    queueMicrotask(() => { if (el === last && el.isConnected) last = null; });
  };

  const moveOn = (el: HTMLElement) => {
    if (!fallen()) return;
    const to = standIns.get(el);
    if (to?.isConnected && shown(to)) { to.focus({ preventScroll: true }); to.scrollIntoView({ block: 'nearest' }); }
  };

  const watcher = new MutationObserver((changes) => {
    // a neighbour taken out at the same time (the line under a list that empties) stands for where it was
    const spots = new Map<Node, MutationRecord>();
    for (const m of changes) for (const n of m.removedNodes) spots.set(n, m);
    const still = (n: Node | null, side: 'previousSibling' | 'nextSibling'): Node | null => {
      for (let i = 0; n && !n.isConnected && i < 50; i++) n = spots.get(n)?.[side] ?? null;
      return n?.isConnected ? n : null;
    };
    /** Where a record's change was, in the page as it is now: taken out of something taken out too, where that was. */
    const where = (m: MutationRecord): MutationRecord | undefined => {
      let spot = m;
      for (let i = 0; i < 50 && !spot.target.isConnected; i++) {
        let n: Node | null = spot.target;
        while (n && !spots.has(n)) n = n.parentNode;
        const up = n && spots.get(n);
        if (!up) return undefined;
        spot = up;
      }
      return spot.target.isConnected ? spot : undefined;
    };
    for (const m of changes) {
      // a focused button turning off
      if (m.type === 'attributes') {
        const el = m.target;
        if (el !== last || !(el instanceof HTMLButtonElement) || !el.disabled) continue;
        if (document.activeElement && document.activeElement !== document.body && document.activeElement !== el) continue;
        const near = [...(el.parentElement?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? [])].filter((x) => x !== el && shown(x));
        (near.find((x) => follows(el, x)) ?? near.at(-1))?.focus({ preventScroll: true });
        continue;
      }
      // a watched element taken out: note what's nearest where it was, while that's still known
      for (const gone of m.removedNodes) {
        for (const w of last ? [last, ...watched] : watched) {
          if (w.isConnected || !(gone === w || gone.contains(w))) continue;
          const spot = where(m);
          const box = spot?.target instanceof Element ? spot.target : null;
          // a message's button: back to where focus was before the messages, or to another message
          if (box?.closest(MESSAGES)) {
            const s = beforeMessages?.isConnected && shown(beforeMessages) ? beforeMessages : nearest(box, still(spot!.previousSibling, 'previousSibling'), still(spot!.nextSibling, 'nextSibling'));
            if (s) standIns.set(w, s);
            continue;
          }
          // only on a page or in a dialog: a page or a dialog going as a whole sees to its own focus
          if (!spot || !box?.closest('.page, [role=dialog]')) continue;
          const s = nearest(spot.target, still(spot.previousSibling, 'previousSibling'), still(spot.nextSibling, 'nextSibling'));
          if (s) standIns.set(w, s);
        }
      }
    }
    // what had focus was moved (a list put in a new order): it keeps focus, when the keyboard is in use
    const back = had;
    if (back?.isConnected && fallen() && keysMoveFocus() && changes.some((m) => [...m.removedNodes].some((n) => n === back || n.contains(back)))) {
      requestAnimationFrame(() => { if (fallen() && back.isConnected && shown(back)) back.focus({ preventScroll: true }); });
    }
    // what had focus went with it: after the screen has had its say (a dialog or list that puts
    // focus somewhere itself wins), move on to what's nearest, when the keyboard is in use
    const el = last;
    if (el && el !== moved && !el.isConnected && fallen() && keysMoveFocus()) {
      moved = el;
      requestAnimationFrame(() => { if (last === el) moveOn(el); });
    }
  });
  addEventListener('focusin', track);
  addEventListener('focusout', leave);
  watcher.observe(document.body, { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true });
  return () => { removeEventListener('focusin', track); removeEventListener('focusout', leave); watcher.disconnect(); watched.clear(); };
}

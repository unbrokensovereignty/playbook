/**
 * How a row leaves a list: it fades while the space it took closes, so the rows under it slide up
 * instead of jumping. With motion Reduced it only fades, and with motion Off it goes at once.
 *
 * `also` is something that goes with the row and only fades (the open plan beside its row).
 * `remove` does the real change. If the row is still on the page shortly after (a read-only tab,
 * an error, a change that was turned down), the row comes back as it was.
 *
 * The row can't be used while it leaves, which takes focus off the button that was pressed. So
 * once it's gone, focus goes to the nearest control, as it would if the row went at once.
 */
import { placeOf, remember } from './focuskeep.ts';
import { keysMoveFocus } from './state.ts';

export const LEAVE_MS = 200;

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)'; // --ease in base.css

export function leave(row: Element | null, remove: () => void, also?: Element | null): void {
  if (!(row instanceof HTMLElement)) { remove(); return; }
  if (row.dataset['leaving']) return; // already on its way out: a second click does nothing
  const level = document.documentElement.dataset['motion'];
  if (level === 'off' || typeof row.animate !== 'function') { remove(); return; }
  row.dataset['leaving'] = '1';
  const partner = also instanceof HTMLElement ? also : null;
  const now = document.activeElement;
  const held = now instanceof HTMLElement && (row.contains(now) || !!partner?.contains(now)) ? now : null;
  if (held) remember(held);
  row.inert = true;
  const frames: Keyframe[] = level === 'reduced'
    ? [{ opacity: 1 }, { opacity: 0 }]
    : closing(row);
  const anim = row.animate(frames, { duration: LEAVE_MS, easing: EASE, fill: 'forwards' });
  // something that goes with the row (the open plan beside its row) only fades, keeping its size
  if (partner) partner.inert = true;
  const fade = partner?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LEAVE_MS, easing: EASE, fill: 'forwards' });
  void anim.finished.then(() => {
    remove();
    // a row the change didn't take away stays: put it back
    setTimeout(() => {
      if (partner && partner.isConnected) { fade?.cancel(); partner.inert = false; }
      if (row.isConnected) {
        anim.cancel();
        row.inert = false;
        delete row.dataset['leaving'];
      }
      // focus fell to the page while the row was leaving: on to the nearest control, or back to the button if it stayed
      const to = held && placeOf(held);
      const fallen = !document.activeElement || document.activeElement === document.body;
      if (to && fallen && keysMoveFocus()) to.focus({ preventScroll: true });
    }, 60);
  }, () => {});
}

/** Fade out, and close the row's height and the gap above or below it to nothing. */
function closing(row: HTMLElement): Keyframe[] {
  const cs = getComputedStyle(row);
  const parent = row.parentElement ? getComputedStyle(row.parentElement) : null;
  const gap = parent && /flex|grid/.test(parent.display) ? parseFloat(parent.rowGap) || 0 : 0;
  // the last row closes the gap above it, any other the gap below
  const side = row.nextElementSibling ? 'marginBottom' : 'marginTop';
  return [
    { opacity: 1, height: `${row.offsetHeight}px`, minHeight: '0px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, [side]: cs[side], overflow: 'hidden' },
    { opacity: 0, offset: 0.6 },
    { opacity: 0, height: '0px', minHeight: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', [side]: `${-gap}px`, overflow: 'hidden' },
  ];
}

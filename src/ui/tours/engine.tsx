/**
 * Guided tours on the real screens: a spotlight lights up one thing at a time, with a card beside
 * it. Space, Enter or → go on, ← or Backspace go back, Esc ends the tour. The steps are in `list.ts`.
 *
 * Built to stay out of trouble:
 * - between steps the spotlight and card fade out, and come back only once the next target exists,
 *   has finished moving in and has been scrolled into view, so nothing lingers on the wrong thing;
 * - keys pressed while a step is still arriving are ignored, so a quick run of Space never skips one;
 * - the page can't be clicked while a tour is on, and the tour hides (its keys rest) while a dialog
 *   or the search is open;
 * - leaving the tour's page yourself ends it; starting another tour replaces it;
 * - tours change no data, except to remember which ones you finished (and that Home's offer was seen).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Button, IconButton } from '../components/controls.tsx';
import { Icon } from '../icons.tsx';
import { data, go, keysMoveFocus, overlayOpen, route, safely, tabRole, toast, typingIn, watch, type Page } from '../state.ts';
import { play } from '../sound.ts';
import { capitalize, countWord } from '../../core/util.ts';
import { tourById, type Side, type Tour } from './list.ts';
import { tourState, touring, type Live } from './now.ts';
import { placeCard, type Placed, type Rect } from './place.ts';
import { setupDue } from '../setup.tsx';

const doneKey = (id: string) => `tour:${id}`;
const OFFER_KEY = 'tour-offer';

export const tourDone = (id: string): boolean => data().app().tips.includes(doneKey(id));

/** Remembers something about tours in the app state (never in a read-only tab). */
function remember(key: string) {
  const r = data();
  if (r.db.readOnly || r.app().tips.includes(key)) return;
  safely(() => r.updateApp({ tips: [...r.app().tips, key] }));
}

// ---------------------------------------------------------------- starting and stopping

/** The page a step is on: its own, or the one before it has. */
function pageOf(t: Tour, i: number): string {
  for (let k = i; k >= 0; k--) { const p = t.steps[k]?.page; if (p) return p; }
  return t.page;
}

const routeNow = (): string => { const { page, arg } = route.value; return arg ? `${page}/${arg}` : page; };

/** What had focus when the tour started (the button that started it): focus goes back there at the end. */
let startedFrom: HTMLElement | null = null;
/** The tour was started from the search, which hands focus back as it closes: what gets it is where the tour started. */
let fromSearch = false;

export function startTour(id: string) {
  const tour = tourById(id);
  if (!tour) return;
  const from = document.activeElement;
  fromSearch = from instanceof HTMLElement && !!from.closest('.palette');
  startedFrom = from instanceof HTMLElement && from !== document.body && !from.closest('.tour-card') && !fromSearch ? from : null;
  remember(OFFER_KEY);
  play('open');
  tourState.value = { tour, step: 0 };
}

export function stopTour(finished = false) {
  const live = tourState.value;
  if (!live) return;
  if (finished) remember(doneKey(live.tour.id));
  tourState.value = null;
  // focus was on the card, which goes: back to the button that started the tour when that was from
  // the keyboard (one clicked would take the next Enter or Space), if it's still there and nothing
  // else has taken focus meanwhile. A page the tour left and came back to has drawn its buttons
  // afresh: then it's the one with the same id.
  const was = startedFrom;
  startedFrom = null; fromSearch = false;
  requestAnimationFrame(() => {
    const now = document.activeElement;
    const from = was?.isConnected || !was?.id ? was : document.getElementById(was.id);
    if (from?.isConnected && from.offsetParent !== null && (!now || now === document.body) && (typingIn(from) || keysMoveFocus())) from.focus({ preventScroll: true });
  });
}

function step(dir: 1 | -1) {
  const live = tourState.value;
  if (!live) return;
  const i = live.step + dir;
  if (i >= live.tour.steps.length) { play('ready'); stopTour(true); return; }
  if (i < 0) return;
  play('tap');
  tourState.value = { tour: live.tour, step: i };
}
/** Leaving the tour's page yourself ends it. */
function leftTour() {
  stopTour();
  toast('Tour closed. Replay it any time from Help → Tours.');
}
export const nextStep = () => step(1);
export const prevStep = () => step(-1);

// ---------------------------------------------------------------- placing the card

const PAD = 6;
/**
 * Widths the card tries when its usual one can't sit clear of a big target: wider is shorter, so it
 * may fit above or below it, and narrower may fit beside it.
 */
const WIDE = 560, NARROW = 260;

/** The part of a rect that's on screen. */
function visible(r: DOMRect, vw: number, vh: number): Rect | null {
  const left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(vw, r.right), bottom = Math.min(vh, r.bottom);
  return right - left < 2 || bottom - top < 2 ? null : { left, top, width: right - left, height: bottom - top };
}

/** The spotlight's hole around a target: the part of it on screen, with a little room around it. */
const holeOf = (r: DOMRect, vw: number, vh: number): Rect | null => visible(new DOMRect(r.left - PAD, r.top - PAD, r.width + PAD * 2, r.height + PAD * 2), vw, vh);

/** Places the card by the hole at its usual width, or wider or narrower when that keeps it clear of the target, and leaves it at that width. */
function fit(c: HTMLElement, hole: Rect | null, side: Side | undefined, vw: number, vh: number): Placed {
  const at = (width: number | null) => { c.style.width = width ? `${width}px` : ''; return placeCard(hole, { width: c.offsetWidth, height: c.offsetHeight }, side, vw, vh); };
  const p = at(null);
  if (p.clear) return p;
  for (const w of [Math.min(WIDE, vw - 24), NARROW]) { const q = at(w); if (q.clear) return q; }
  // none fits: the usual width, over as little of the target as it can
  return at(null);
}

const findTarget = (hook: string | undefined): HTMLElement | null =>
  hook ? [...document.querySelectorAll<HTMLElement>(`[data-tour="${hook}"]`)].find((el) => el.getClientRects().length > 0) ?? null : null;

const sameRect = (a: DOMRect | null, b: DOMRect | null) => !!a && !!b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/** The page slides in when it changes; wait for that before measuring. */
const pageSettled = () => !document.querySelector('.page')?.getAnimations().some((a) => a.playState === 'running');

const frame = () => new Promise<void>((ok) => requestAnimationFrame(() => ok()));

/** The page the tour itself just went to (so that change doesn't count as leaving). */
let expected = '';

/** Waits for a step's page and target: the target exists and has stopped moving. Returns it, or null when it never showed up. */
async function arrive(live: Live, alive: () => boolean): Promise<HTMLElement | null> {
  const want = pageOf(live.tour, live.step);
  if (routeNow() !== want) {
    expected = want;
    const [page, ...arg] = want.split('/');
    go(page as Page, arg.join('/'));
  }
  const start = performance.now();
  while (alive() && routeNow() !== want && performance.now() - start < 2000) await frame();
  // you went somewhere else before the tour's page came up
  if (alive() && routeNow() !== want) { expected = ''; leftTour(); return null; }
  const hook = live.tour.steps[live.step]?.target;
  if (!hook) { while (alive() && !pageSettled() && performance.now() - start < 1500) await frame(); return null; }
  let el: HTMLElement | null = null, last: DOMRect | null = null, still = 0, scrolled = false;
  const found = performance.now();
  while (alive() && performance.now() - found < 1800) {
    await frame();
    el = findTarget(hook);
    if (!el || !pageSettled()) { still = 0; last = null; continue; }
    const r = el.getBoundingClientRect();
    if (!scrolled) {
      // a target off screen comes to the middle when that leaves room for the card above or below
      // it, else to the top with the room below it; so does one on screen with no room for the card
      const c = document.querySelector<HTMLElement>('.tour-card');
      const off = r.top < 0 || r.bottom > innerHeight;
      const cramped = !off && !!c && r.top > 48 && !fit(c, holeOf(r, innerWidth, innerHeight), live.tour.steps[live.step]?.side, innerWidth, innerHeight).clear;
      if (off || cramped) {
        scrolled = true;
        if (c) c.style.width = '';
        const middle = off && (innerHeight - r.height) / 2 >= (c?.offsetHeight ?? 0) + 40;
        el.scrollIntoView({ block: middle ? 'center' : 'start', behavior: 'instant' as ScrollBehavior });
        still = 0; last = null; continue;
      }
    }
    still = sameRect(r, last) ? still + 1 : 0;
    last = r;
    if (still >= 2) return el;
  }
  return el && alive() ? el : null;
}

// ---------------------------------------------------------------- keys

/** Set while a step is on its way in: keys wait for it. */
let arriving = false;
/** When the step showing appeared; keys wait a moment after it too, so two quick presses can't skip one unseen. */
let shownAt = 0;
const DWELL = 250;

function onKey(e: KeyboardEvent) {
  const live = tourState.value;
  if (!live || overlayOpen()) return;
  const k = e.key;
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (k === 'Escape') { stop(); stopTour(); play('close'); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || k === 'Tab' || typingIn(e.target)) return;
  // a focused button in the card answers Space and Enter itself
  if ((k === ' ' || k === 'Enter') && e.target instanceof HTMLButtonElement && e.target.closest('.tour-card')) return;
  stop();
  if (e.repeat || arriving || performance.now() - shownAt < DWELL) return;
  if (k === ' ' || k === 'Enter' || k === 'ArrowRight') nextStep();
  else if (k === 'ArrowLeft' || k === 'Backspace') prevStep();
}

// ---------------------------------------------------------------- drawing

export function TourHost() {
  const live = tourState.value;
  const hide = overlayOpen();
  const [shown, setShown] = useState(false);
  const [missing, setMissing] = useState(false);
  const spot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const token = useRef(0);

  useEffect(() => {
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, []);

  // leaving the tour's page yourself ends it
  useEffect(() => route.subscribe(() => {
    const cur = tourState.value;
    if (!cur) return;
    const now = routeNow();
    if (now === expected) { expected = ''; return; }
    if (now === pageOf(cur.tour, cur.step)) return;
    leftTour();
  }), []);

  // each step: fade out, go to its page, wait for its target, then show
  useLayoutEffect(() => {
    const id = ++token.current;
    setShown(false);
    setMissing(false);
    target.current = null;
    // the card measures at its usual width until the new step places it
    if (card.current) card.current.style.width = '';
    if (!live) { arriving = false; return; }
    arriving = true;
    const alive = () => token.current === id && tourState.value === live;
    void arrive(live, alive).then((el) => {
      if (!alive()) return;
      target.current = el;
      setMissing(!!live.tour.steps[live.step]?.target && !el);
      setShown(true);
      arriving = false;
      shownAt = performance.now();
    });
    return () => { if (token.current === id) arriving = false; };
  }, [live]);

  // follow the target as it moves (scrolling, resizing, content changing)
  useEffect(() => {
    if (!live || !shown || hide) return;
    let raf = 0, lastKey = '';
    const s = live.tour.steps[live.step];
    const tick = () => {
      raf = requestAnimationFrame(tick);
      let el = target.current;
      if (s?.target && (!el || !el.isConnected)) { el = findTarget(s.target); target.current = el; }
      const vw = innerWidth, vh = innerHeight;
      const r = el ? el.getBoundingClientRect() : null;
      const hole = r ? holeOf(r, vw, vh) : null;
      const c = card.current;
      const keyNow = () => `${hole ? [hole.left, hole.top, hole.width, hole.height].map(Math.round).join() : '-'}|${c?.offsetWidth}x${c?.offsetHeight}|${vw}x${vh}`;
      if (keyNow() === lastKey) return;
      if (s?.target && !!el !== !missing) setMissing(!el);
      const sp = spot.current;
      if (sp) {
        // it glides from one target to the next, but appears in place the first time
        const jump = !!hole && (sp.classList.contains('none') || !sp.style.width);
        sp.classList.toggle('jump', jump);
        sp.classList.toggle('none', !hole);
        if (hole) Object.assign(sp.style, { left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px`, height: `${hole.height}px` });
        if (jump) { void sp.offsetWidth; sp.classList.remove('jump'); }
      }
      if (c) {
        const p = fit(c, hole, s?.side, vw, vh);
        c.style.left = `${p.x}px`;
        c.style.top = `${p.y}px`;
        c.dataset.side = p.side;
      }
      lastKey = keyNow();
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [live, shown, hide, missing]);

  // the card takes focus so Space reaches the tour
  useEffect(() => {
    if (!shown || hide || !live) return;
    const now = document.activeElement;
    if (fromSearch) {
      fromSearch = false;
      if (now instanceof HTMLElement && now !== document.body && !now.closest('.tour-card, .palette')) startedFrom = now;
    }
    card.current?.focus({ preventScroll: true });
  }, [live, shown, hide]);

  if (!live) return null;
  const s = live.tour.steps[live.step];
  const count = live.tour.steps.length;
  const last = live.step === count - 1;
  return (
    <div class={`tour${shown && !hide ? ' on' : ''}${hide ? ' paused' : ''}`} aria-hidden={hide ? 'true' : undefined} data-target={s?.target}>
      <div class="tour-block" />
      <div class={`tour-spot${s?.target && !missing ? '' : ' none'}`} ref={spot} />
      <div class="tour-card" ref={card} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-text" tabIndex={-1} data-side="center">
        {s && (
          <>
            <div class="tour-top">
              <span class="tour-count">{live.tour.name} · <span class="nowrap">{live.step + 1} of {count}</span></span>
              <IconButton icon="x" size="sm" label="End the tour (Esc)" onClick={() => { stopTour(); play('close'); }} sound={false} />
            </div>
            <h2 id="tour-title">{s.title}</h2>
            <p id="tour-text">{s.text}</p>
            {missing && <p class="tour-look"><Icon name="info" size={16} /><span>It isn’t on screen right now{s.look ? `: look for ${s.look}` : ''}.</span></p>}
            <div class="tour-bar" aria-hidden="true"><i style={{ width: `${((live.step + 1) / count) * 100}%` }} /></div>
            <div class="tour-actions">
              <Button kind="quiet" size="sm" disabled={live.step === 0} onClick={prevStep} sound={false}>Back</Button>
              <Button kind="primary" size="sm" onClick={nextStep} sound={false} kbd=" ">{last ? 'Done' : 'Next'}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the first-visit offer

/** A small card on Home offering the short First steps tour, until it's taken or put off (or any tour is started). */
export function TourOffer() {
  const r = watch('meta');
  const firstSteps = capitalize(countWord(tourById('first')?.steps.length ?? 0));
  // a read-only tab doesn't offer it; one that takes over saving does, straight away
  // it waits for the setup on first launch (setup.tsx), which comes first
  if (tabRole.value === 'reader' || r.app().tips.includes(OFFER_KEY) || touring.value || setupDue()) return null;
  return (
    <aside class="tour-offer panel" aria-label="Take the tour">
      <span class="tour-offer-icon"><Icon name="compass" size={22} /></span>
      <div class="grow">
        <b>Take a quick tour</b>
        <p class="small muted">{firstSteps} quick steps show you where things are, and Help → Tours has one for each page. Press Space to go from step to step.</p>
      </div>
      <div class="row">
        <Button size="sm" kind="quiet" onClick={() => remember(OFFER_KEY)}>Not now</Button>
        <Button size="sm" kind="primary" onClick={() => startTour('first')}>Show me</Button>
      </div>
    </aside>
  );
}

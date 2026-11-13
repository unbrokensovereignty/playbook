/**
 * Things that sit above the page: dialogs (with ready-made confirm and prompt), short messages at
 * the bottom, and pop-up menus.
 */
import type { ComponentChildren } from 'preact';
import { computed, signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from '../icons.tsx';
import { Button, CancelButton, Field, IconButton, Kbd, TextInput } from './controls.tsx';
import { closeDialog, dialogs, dismissToast, openDialog, paletteOpen, route, toasts, watch, type DialogSpec, type Toast } from '../state.ts';
import { STORES } from '../../data/tables.ts';
import { canUndoThis, undoThis } from '../undo.ts';
import { play } from '../sound.ts';
import { FOCUSABLE, placeOf, remember } from '../focuskeep.ts';

// ---------------------------------------------------------------- focus handling

/** Keeps Tab inside `box`. */
function trapTab(e: KeyboardEvent, box: HTMLElement) {
  if (e.key !== 'Tab') return;
  const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0] as HTMLElement, last = items[items.length - 1] as HTMLElement;
  // from the dialog itself (where focus starts when it has no field), Tab and Shift+Tab go in too
  const inside = items.includes(document.activeElement as HTMLElement);
  if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
}

// ---------------------------------------------------------------- dialogs

function DialogFrame({ d, top }: { d: DialogSpec; top: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  // before the dialog is drawn, so a key pressed as soon as it shows (Esc) is already the dialog's
  useLayoutEffect(() => {
    const before = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    if (before) remember(before);
    play('open');
    // focus the field or button marked autofocus, else the first control, else the dialog itself
    const el = box.current;
    const target = el?.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? el?.querySelector<HTMLElement>('.dialog-body input, .dialog-body select, .dialog-body textarea') ?? el;
    target?.focus();
    // back to what had focus, or, if that's gone (the plan just deleted), to what's nearest where it was
    return () => { if (before) placeOf(before)?.focus(); };
  }, []);
  // a button that goes away while focused (Clear, once there's nothing left to clear) would drop focus out of
  // the dialog: it moves to the next control after where it was, or to the dialog itself
  useEffect(() => {
    const el = box.current;
    if (!top || !el) return;
    const watcher = new MutationObserver((changes) => {
      const now = document.activeElement;
      if (now && now !== document.body) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      const at = changes.find((m) => m.removedNodes.length)?.target;
      const next = at ? items.find((x) => at.contains(x) || (at.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING)) : undefined;
      (next ?? el).focus({ preventScroll: true });
    });
    watcher.observe(el, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, [top]);
  const close = (v?: unknown) => closeDialog(d.id, v);
  return (
    <div
      class="scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget && d.dismissable && top) { play('close'); close(); } }}
      onKeyDown={(e) => {
        if (!top || !box.current) return;
        if (e.key === 'Escape' && d.dismissable) { e.stopPropagation(); play('close'); close(); }
        trapTab(e, box.current);
      }}
    >
      <div ref={box} class={`dialog${d.wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={d.label} tabIndex={-1}>
        {d.render(close)}
      </div>
    </div>
  );
}

export function DialogHost() {
  const list = dialogs.value;
  return <>{list.map((d, i) => <DialogFrame key={d.id} d={d} top={i === list.length - 1} />)}</>;
}

/** The usual dialog layout: a title, a close button, the body and buttons. */
export function DialogLayout({ title, icon, close, children, foot }: { title: ComponentChildren; icon?: IconName; close: () => void; children?: ComponentChildren; foot?: ComponentChildren }) {
  return (
    <>
      <div class="dialog-head">
        {icon && <Icon name={icon} size={22} class="dialog-icon" />}
        <h2>{title}</h2>
        <IconButton icon="x" label="Close" size="sm" sound="close" onClick={close} />
      </div>
      {children && <div class="dialog-body">{children}</div>}
      {foot && <div class="dialog-foot">{foot}</div>}
    </>
  );
}

/** The one sentence a confirm uses for something that can be undone. */
export const UNDO_NOTE = 'You can undo this.';

export interface ConfirmOptions {
  title: string;
  body?: ComponentChildren;
  yes: string;
  no?: string;
  danger?: boolean;
  icon?: IconName;
}

/** Asks a yes/no question. Resolves true only for yes. */
export async function confirm(o: ConfirmOptions): Promise<boolean> {
  const v = await openDialog<boolean>(o.title, (close) => (
    <DialogLayout title={o.title} icon={o.icon ?? (o.danger ? 'warning' : undefined)} close={() => close(false)} foot={<>
      <CancelButton onClick={() => close(false)}>{o.no}</CancelButton>
      <Button kind={o.danger ? 'danger' : 'primary'} autoFocus sound={o.danger ? 'remove' : 'tap'} onClick={() => close(true)}>{o.yes}</Button>
    </>}>
      {typeof o.body === 'string' ? <p>{o.body}</p> : o.body}
    </DialogLayout>
  ));
  return v === true;
}

export interface PromptOptions {
  title: string;
  label: string;
  value?: string;
  yes: string;
  placeholder?: string;
  maxLength?: number;
  /** Returns a problem to show, or '' when the text is fine. */
  check?: (v: string) => string;
  help?: ComponentChildren;
}

function PromptBody({ o, close }: { o: PromptOptions; close: (v?: unknown) => void }) {
  const [v, setV] = useState(o.value ?? '');
  const [shown, setShown] = useState('');
  const submit = () => {
    const text = v.trim();
    const problem = !text ? 'Type something first.' : o.check?.(text) ?? '';
    if (problem) { setShown(problem); play('error'); return; }
    close(text);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <DialogLayout title={o.title} close={() => close()} foot={<>
        <CancelButton onClick={() => close()} />
        <Button kind="primary" type="submit" sound={false}>{o.yes}</Button>
      </>}>
        <Field label={o.label} for="prompt-input" error={shown} help={o.help}>
          <TextInput id="prompt-input" value={v} onInput={(x) => { setV(x); if (shown) setShown(''); }} placeholder={o.placeholder} maxLength={o.maxLength ?? 80} invalid={!!shown} autoFocus />
        </Field>
      </DialogLayout>
    </form>
  );
}

/** Asks for a line of text. Resolves undefined when cancelled. */
export function prompt(o: PromptOptions): Promise<string | undefined> {
  return openDialog<string>(o.title, (close) => <PromptBody o={o} close={close} />);
}

// ---------------------------------------------------------------- messages

const TOAST_ICON: Record<Toast['tone'], IconName> = { info: 'info', good: 'check', bad: 'warning' };

function ToastItem({ t }: { t: Toast }) {
  // any change can make its Undo out of date (a newer change is the one an undo would take back)
  if (t.undo || t.action?.live) watch(...STORES);
  const [hover, setHover] = useState(false);
  const left = useRef(t.ms);
  useEffect(() => {
    if (hover) return;
    const started = Date.now();
    const timer = setTimeout(() => dismissToast(t.id), left.current);
    return () => { clearTimeout(timer); left.current = Math.max(1200, left.current - (Date.now() - started)); };
  }, [hover]);
  return (
    <div class={`toast ${t.tone}`} role={t.tone === 'bad' ? 'alert' : 'status'} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Icon name={TOAST_ICON[t.tone]} size={18} />
      <span>{t.text}</span>
      {t.undo && canUndoThis(t.undo) && (
        <Button size="sm" sound={false} onClick={() => { dismissToast(t.id); undoThis(t.undo); }}>
          {/* Ctrl Z waits while a dialog is open, so the key is shown only when it works */}
          Undo {!dialogs.value.length && !paletteOpen.value && <Kbd k="ctrl+z" />}
        </Button>
      )}
      {t.action && (t.action.live?.() ?? true) && <Button size="sm" onClick={() => { dismissToast(t.id); t.action?.run(); }}>{t.action.label}</Button>}
      <IconButton icon="x" label="Dismiss" size="sm" sound={false} onClick={() => dismissToast(t.id)} />
    </div>
  );
}

export function ToastHost() {
  return <div class="toasts">{toasts.value.map((t) => <ToastItem key={t.id} t={t} />)}</div>;
}

// ---------------------------------------------------------------- menus

export type MenuItem =
  | { label: string; icon?: IconName; kbd?: string; danger?: boolean; disabled?: boolean; run: () => void }
  | 'divider';

interface OpenMenu { items: readonly MenuItem[]; x: number; y: number; from: HTMLElement | null }
const menu = signal<OpenMenu | null>(null);

/** Opens a menu under the clicked element (or at the pointer, for right-clicks). */
export function openMenu(e: MouseEvent, items: readonly MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
  if (menu.value && menu.value.from === el && e.type === 'click') { menu.value = null; return; }
  const r = el && e.type === 'click' ? el.getBoundingClientRect() : null;
  menu.value = { items, x: r ? r.left : e.clientX, y: r ? r.bottom + 4 : e.clientY, from: el };
  play('open');
}
export const closeMenu = () => { menu.value = null; };
/** A pop-up menu is open. */
export const menuOpen = computed(() => menu.value !== null);

export function MenuHost() {
  const m = menu.value;
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; maxH?: number } | null>(null);
  useEffect(() => {
    if (!m) { setPos(null); return; }
    const el = box.current;
    if (!el) return;
    // keep it on screen: flip up or left when there isn't room
    const place = () => {
      // measured at the window's left edge with no height cap, so a menu near the right edge isn't
      // squeezed into the space left there before it's moved
      const was = [el.style.left, el.style.top, el.style.maxHeight] as const, scrolled = el.scrollTop;
      el.style.left = '0px'; el.style.top = '0px'; el.style.maxHeight = '';
      const w = el.offsetWidth, h = el.offsetHeight;
      [el.style.left, el.style.top, el.style.maxHeight] = was;
      // (letting it out to measure can scroll a long menu back; it stays where it was)
      el.scrollTop = scrolled;
      const r = m.from?.isConnected ? m.from.getBoundingClientRect() : null;
      let x = r ? r.left : m.x, y = r ? r.bottom + 4 : m.y;
      if (x + w > innerWidth - 8) x = Math.max(8, (r ? r.right : m.x) - w);
      // below if it fits, else above if it fits there; else on the roomier side, scrolling, so it
      // never covers the button that opened it
      const top = r ? r.top - 4 : m.y, below = innerHeight - 8 - y, above = top - 8;
      let maxH: number | undefined;
      if (h > below) {
        if (h <= above) y = top - h;
        else if (above > below) { maxH = above; y = 8; }
        else maxH = below;
      }
      setPos({ x, y, maxH });
    };
    place();
    // a press on the button that opened it is left to that button's click, which closes it
    const away = (ev: Event) => { const t = ev.target as Node; if (!el.contains(t) && !m.from?.contains(t)) closeMenu(); };
    const off = () => closeMenu();
    // a scroll (even a smooth one still settling) carries the menu along with its button, and
    // closes it only when the button leaves the window or there's no button to follow
    const scrolled = (ev: Event) => {
      // the menu's own list scrolling (a long menu) leaves it where it is
      if (ev.target instanceof Node && el.contains(ev.target)) return;
      const r = m.from?.isConnected ? m.from.getBoundingClientRect() : null;
      if (!r || r.bottom < 0 || r.top > innerHeight) closeMenu(); else place();
    };
    // the screen it came from went away (the page changed, a dialog closed): so does the menu
    const gone = setInterval(() => { if (m.from && !m.from.isConnected) closeMenu(); }, 200);
    document.addEventListener('mousedown', away, true);
    addEventListener('resize', off);
    addEventListener('blur', off);
    document.addEventListener('scroll', scrolled, true);
    return () => {
      clearInterval(gone);
      document.removeEventListener('mousedown', away, true);
      removeEventListener('resize', off);
      removeEventListener('blur', off);
      document.removeEventListener('scroll', scrolled, true);
    };
  }, [m]);
  // the first item takes focus once the menu is placed and showing (a hidden one can't take it),
  // before it's drawn (so a key pressed as soon as it shows is already the menu's), and without
  // scrolling: focusing would otherwise scroll the page and close it. Not once it's closed: an item
  // picked quickly, on a busy machine, can close it before this runs
  const shown = !!m && !!pos;
  useLayoutEffect(() => {
    const el = box.current;
    if (shown && el && menu.peek() === m && !el.contains(document.activeElement)) el.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
  }, [m, shown]);
  // a new page, the search or a dialog takes over the screen: the menu open then closes (not one
  // opened since, before this ran: a busy machine can run it late)
  const page = route.value.page, arg = route.value.arg, covered = paletteOpen.value || dialogs.value.length > 0;
  useEffect(() => { if (m && menu.peek() === m) closeMenu(); }, [page, arg, covered]);
  if (!m) return null;
  const buttons = () => [...(box.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
  /**
   * Puts the keyboard on an item, scrolled into the menu's view. Scrolled here rather than by the
   * browser, which can scroll the page behind as well and leave a long menu short of the item.
   */
  const reach = (b: HTMLButtonElement | undefined) => {
    const el = box.current;
    if (!b || !el) return;
    b.focus({ preventScroll: true });
    // the item's place in the menu (the menu is fixed, so it's the items' offset parent), with the menu's padding
    const pad = 5, top = b.offsetTop - pad, bottom = b.offsetTop + b.offsetHeight + pad;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  };
  const move = (d: number) => {
    const b = buttons();
    const i = b.indexOf(document.activeElement as HTMLButtonElement);
    reach(b[(i + d + b.length) % b.length]);
  };
  return (
    <div
      ref={box}
      class="menu"
      role="menu"
      style={{ left: `${pos?.x ?? m.x}px`, top: `${pos?.y ?? m.y}px`, maxHeight: pos?.maxH ? `${pos.maxH}px` : '', visibility: pos ? 'visible' : 'hidden' }}
      onKeyDown={(e) => {
        // keys in a menu are the menu's: Space on an item mustn't also press something behind the menu
        e.stopPropagation();
        if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); m.from?.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Home') { e.preventDefault(); reach(buttons()[0]); }
        else if (e.key === 'End') { e.preventDefault(); reach(buttons().at(-1)); }
      }}
    >
      {m.items.map((it, i) =>
        it === 'divider' ? <hr key={i} /> : (
          <button
            key={i}
            type="button"
            role="menuitem"
            class={it.danger ? 'danger' : undefined}
            disabled={it.disabled}
            onClick={() => {
              // back to the button that opened it first, so a dialog the item opens returns focus there
              closeMenu(); m.from?.focus({ preventScroll: true }); play(it.danger ? 'remove' : 'tap'); it.run();
            }}
          >
            {it.icon && <Icon name={it.icon} size={17} />}
            <span class="grow">{it.label}</span>
            {it.kbd && <Kbd k={it.kbd} />}
          </button>
        ),
      )}
    </div>
  );
}

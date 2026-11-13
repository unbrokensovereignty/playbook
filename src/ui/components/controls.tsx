/**
 * The controls every page uses. Each gives feedback on press (motion and a quiet sound) and works
 * with the keyboard.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from '../icons.tsx';
import { play, type SoundName } from '../sound.ts';
import { keyLabel } from '../../core/settings.ts';
import { fmt, typedNumber, unitFor } from '../../core/util.ts';

type Kind = 'primary' | 'secondary' | 'quiet' | 'danger' | 'soft';

export interface ButtonProps {
  kind?: Kind;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  busy?: boolean;
  block?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  /** A keyboard key shown on the button. */
  kbd?: string;
  sound?: SoundName | false;
  class?: string;
  children?: ComponentChildren;
  autoFocus?: boolean;
  id?: string;
  /** A fuller name for screen readers; it should start with the words on the button. */
  label?: string;
  /** A hook a guided tour can point at. */
  tour?: string;
  /** The button opens a menu (openMenu), which plays its own sound. */
  menu?: boolean;
}

export function Button(p: ButtonProps) {
  const cls = ['btn', p.kind && p.kind !== 'secondary' ? p.kind : '', p.size && p.size !== 'md' ? p.size : '', p.block ? 'block' : '', p.busy ? 'busy' : '', p.class ?? ''].filter(Boolean).join(' ');
  return (
    <button
      id={p.id}
      aria-label={p.label}
      type={p.type ?? 'button'}
      class={cls}
      disabled={p.disabled}
      title={p.title}
      autoFocus={p.autoFocus}
      data-tour={p.tour}
      aria-haspopup={p.menu ? 'menu' : undefined}
      onClick={(e) => {
        if (p.sound !== false && !p.menu) play(p.sound ?? 'tap');
        p.onClick?.(e);
      }}
    >
      {p.icon && <Icon name={p.icon} size={p.size === 'sm' ? 16 : 18} />}
      {p.children}
      {p.iconRight && <Icon name={p.iconRight} size={p.size === 'sm' ? 16 : 18} />}
      {p.kbd && <Kbd k={p.kbd} />}
    </button>
  );
}

/** The button that closes a dialog without doing anything: "Cancel", or other words for it. */
export const CancelButton = ({ onClick, children }: { onClick: () => void; children?: ComponentChildren }) => (
  <Button kind="quiet" sound="close" onClick={onClick}>{children ?? 'Cancel'}</Button>
);

export function IconButton(p: { icon: IconName; label: string; onClick?: (e: MouseEvent) => void; active?: boolean; size?: 'sm' | 'md'; disabled?: boolean; tipSide?: 'right' | 'below'; class?: string; sound?: SoundName | false; pressed?: boolean }) {
  return (
    <button
      type="button"
      class={`icon-btn${p.size === 'sm' ? ' sm' : ''}${p.active ? ' active' : ''}${p.class ? ' ' + p.class : ''}`}
      aria-label={p.label}
      aria-pressed={p.pressed}
      data-tip={p.label}
      data-tip-side={p.tipSide}
      disabled={p.disabled}
      onClick={(e) => {
        if (p.sound !== false) play(p.sound ?? 'tap');
        p.onClick?.(e);
      }}
    >
      <Icon name={p.icon} size={p.size === 'sm' ? 17 : 20} />
    </button>
  );
}

/** A key or a combination ("ctrl+k" shows as Ctrl K). Nothing for a key that isn't set. */
export const Kbd = ({ k }: { k: string }) => (!k ? null :
  <kbd class="kbd">{k.length > 1 && k.includes('+') ? k.split('+').map((x) => (x === '' ? '+' : keyLabel(x))).join(' ') : keyLabel(k)}</kbd>
);

export function Badge({ tone, icon, children }: { tone?: 'accent' | 'good' | 'warn' | 'bad'; icon?: IconName; children: ComponentChildren }) {
  return <span class={`badge${tone ? ' ' + tone : ''}`}>{icon && <Icon name={icon} size={14} />}{children}</span>;
}

// ---------------------------------------------------------------- fields

export function Field({ label, help, error, children, for: htmlFor }: { label?: ComponentChildren; help?: ComponentChildren; error?: string; children: ComponentChildren; for?: string }) {
  return (
    <div class="field">
      {label && <label for={htmlFor}>{label}</label>}
      {children}
      {error ? <div class="error" role="alert">{error}</div> : help ? <div class="help">{help}</div> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label?: ComponentChildren; disabled?: boolean; id?: string }) {
  return (
    <label class="toggle">
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => {
        const el = e.currentTarget as HTMLInputElement, want = el.checked;
        play('toggle');
        // back to what the app says until it agrees: a refused change doesn't leave the switch flipped
        el.checked = checked;
        onChange(want);
      }} />
      <span class="track" />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Check({ checked, indeterminate, onChange, label, disabled }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean, e: Event) => void; label?: ComponentChildren; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <label class="check" onClick={(e) => e.stopPropagation()}>
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => { play('tick'); onChange((e.currentTarget as HTMLInputElement).checked, e); }} />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, class: cls }: { value: T; options: readonly (readonly [T, ComponentChildren])[]; onChange: (v: T) => void; label: string; class?: string }) {
  return (
    <div class={cls ? `segmented ${cls}` : 'segmented'} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button type="button" key={v} aria-pressed={v === value} onClick={() => { if (v !== value) { play('tick'); onChange(v); } }}>{text}</button>
      ))}
    </div>
  );
}

export function Slider({ value, min, max, step = 1, onChange, format, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; label: string }) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div class="slider">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} style={{ '--fill': fill } as JSX.CSSProperties}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))} />
      <span class="value">{format ? format(value) : value}</span>
    </div>
  );
}

/** A number with − and + buttons. Typing is checked when you press Enter or leave the field. */
export function Stepper({ value, min, max, step = 1, onChange, unit, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; label: string }) {
  const [text, setText] = useState(String(value));
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => setText(String(value)), [value]);
  const commit = (v: number) => {
    const x = Math.min(max, Math.max(min, Math.round(v / step) * step));
    setText(String(x));
    if (x !== value) onChange(x);
    return x;
  };
  const settle = () => { const n = typedNumber(text, !Number.isInteger(step)); if (Number.isFinite(n)) commit(n); else setText(String(value)); };
  // the arrow keys step from what's typed, if it's a number
  const typed = () => { const n = typedNumber(text, !Number.isInteger(step)); return Number.isFinite(n) ? n : value; };
  // a button pressed to the end of the range turns off, so focus moves to the number instead of being lost
  const press = (e: MouseEvent, v: number) => {
    play('tick');
    const x = commit(v);
    if ((x <= min || x >= max) && document.activeElement === e.currentTarget) box.current?.focus();
  };
  return (
    <div class="stepper">
      <button type="button" aria-label={`${label}: less`} disabled={value <= min} onClick={(e) => press(e, value - step)}><Icon name="minus" size={16} /></button>
      <input ref={box} aria-label={label} inputMode="numeric" value={text}
        onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        onBlur={settle}
        onKeyDown={(e) => {
          // Enter takes what's typed and keeps you in the box
          if (e.key === 'Enter') settle();
          if (e.key === 'ArrowUp') { e.preventDefault(); commit(typed() + step); }
          if (e.key === 'ArrowDown') { e.preventDefault(); commit(typed() - step); }
        }} />
      {unit && <span class="unit">{unitFor(value, unit)}</span>}
      <button type="button" aria-label={`${label}: more`} disabled={value >= max} onClick={(e) => press(e, value + step)}><Icon name="plus" size={16} /></button>
    </div>
  );
}

export function TextInput(p: { value: string; onInput: (v: string) => void; placeholder?: string; id?: string; label?: string; invalid?: boolean; size?: 'lg'; autoFocus?: boolean; maxLength?: number; onKeyDown?: (e: KeyboardEvent) => void; onBlur?: () => void; dir?: 'auto'; lang?: string; spellcheck?: boolean; inputRef?: preact.Ref<HTMLInputElement> }) {
  return (
    <input ref={p.inputRef} id={p.id} class={`input${p.invalid ? ' invalid' : ''}${p.size === 'lg' ? ' lg' : ''}`} value={p.value} placeholder={p.placeholder} aria-label={p.label} maxLength={p.maxLength}
      autoFocus={p.autoFocus} dir={p.dir} lang={p.lang} spellcheck={p.spellcheck} autoComplete="off"
      onInput={(e) => p.onInput((e.currentTarget as HTMLInputElement).value)} onKeyDown={p.onKeyDown} onBlur={p.onBlur} />
  );
}

export function Select<T extends string>({ value, options, onChange, label, id }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string; id?: string }) {
  return (
    <select id={id} class="select" aria-label={label} value={value} onChange={(e) => { play('tick'); onChange((e.currentTarget as HTMLSelectElement).value as T); }}>
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  );
}

export function SearchInput({ value, onInput, placeholder, inputRef, onKeyDown }: { value: string; onInput: (v: string) => void; placeholder: string; inputRef?: preact.Ref<HTMLInputElement>; onKeyDown?: (e: KeyboardEvent) => void }) {
  return (
    <div class="search-input">
      <Icon name="search" size={17} />
      <input ref={inputRef} class="input" type="search" value={value} placeholder={placeholder} aria-label={placeholder} autoComplete="off" spellcheck={false}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)} onKeyDown={onKeyDown} />
    </div>
  );
}

export function ColorField({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div class="color-field">
      <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value.toUpperCase())} />
      <input class="input" aria-label={`${label} (hex)`} value={text} maxLength={7} spellcheck={false}
        onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value.trim(); setText(v); const hex = v.startsWith('#') ? v : '#' + v; if (/^#[0-9a-f]{6}$/i.test(hex)) onChange(hex.toUpperCase()); }}
        onBlur={() => setText(value)} />
    </div>
  );
}

// ---------------------------------------------------------------- progress and numbers

export function Bar({ value, tone, size, label }: { value: number; tone?: 'good'; size?: 'thin' | 'thick'; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div class={`bar${tone ? ' ' + tone : ''}${size ? ' ' + size : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 44, stroke = 5, tone, children, label }: { value: number; size?: number; stroke?: number; tone?: 'good'; children?: ComponentChildren; label?: string }) {
  const r = (size - stroke) / 2, len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }} role="progressbar" aria-label={label} aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <svg class={`ring${tone ? ' ' + tone : ''}`} width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <circle class="track" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} />
        <circle class="fill" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} stroke-dasharray={len} stroke-dashoffset={len * (1 - v)} />
      </svg>
      <div style={{ position: 'relative', fontWeight: 700, fontSize: size * 0.28 }}>{children}</div>
    </div>
  );
}

/** A number that counts to its new value; `from0` also counts up from zero when it first shows. */
export function CountUp({ value, format = fmt, ms = 600, from0 }: { value: number; format?: (n: number) => string; ms?: number; from0?: boolean }) {
  const start0 = from0 && document.documentElement.dataset.motion === 'full' ? 0 : value;
  const [shown, setShown] = useState(start0);
  const from = useRef(start0);
  useEffect(() => {
    const start = from.current;
    if (start === value || document.documentElement.dataset.motion !== 'full') { from.current = value; setShown(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (value - start) * eased;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span class="num">{format(shown)}</span>;
}

export function Tabs<T extends string>({ value, tabs, onChange, label, tour }: { value: T; tabs: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string; tour?: string }) {
  return (
    <div class="tabs" role="tablist" aria-label={label} data-tour={tour}>
      {tabs.map(([v, text]) => (
        <button type="button" role="tab" key={v} aria-selected={v === value} onClick={() => { if (v !== value) { play('tick'); onChange(v); } }}>{text}</button>
      ))}
    </div>
  );
}

/** An empty state. `level` is its heading's level: 2 straight under a page's title, 3 (the default) inside a section. */
export function Empty({ art, title, children, actions, level = 3 }: { art?: ComponentChildren; title: string; children?: ComponentChildren; actions?: ComponentChildren; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div class="empty">
      {art}
      <H>{title}</H>
      {children && <p>{children}</p>}
      {actions && <div class="row">{actions}</div>}
    </div>
  );
}

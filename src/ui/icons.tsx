/**
 * One icon set: 24 px, rounded 1.75 px strokes, drawn for this app. Dots are small filled circles.
 */
const dot = (x: number, y: number, r = 1.1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const p = (d: string) => `<path d="${d}"/>`;
const c = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const rect = (x: number, y: number, w: number, h: number, r = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;

export const ICONS = {
  home: p('M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z'),
  // a clipboard with a play drawn on it
  planner: rect(5, 4.5, 14, 16.5) + p('M9.5 4.5V3.6a.6.6 0 0 1 .6-.6h3.8a.6.6 0 0 1 .6.6v.9') + p('M8.5 9.5l2 2M10.5 9.5l-2 2') + c(15.5, 15.5, 1.6) + p('M10 15.5c1.5 0 2.2-1 2.6-2.2'),
  // three tiers of bars
  rankings: p('M4 6h16M4 12h11M4 18h6'),
  agents: c(9, 8, 3.2) + p('M3.5 19.5a5.5 5.5 0 0 1 11 0') + p('M15.5 4.8a3.2 3.2 0 0 1 0 6.4M17.5 13.6a5.5 5.5 0 0 1 3 5.9'),
  map: p('M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z') + p('M9 4v13.5M15 6.5V20'),
  bookmark: p('M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z'),
  shield: p('M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z'),
  sword: p('M14.5 4H20v5.5L10 19.5 4.5 14z') + p('M7 16.5l-3 3M8.5 12.5l3 3'),
  crosshair: c(12, 12, 7.5) + p('M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5') + dot(12, 12),
  users: c(12, 8, 3.2) + p('M6 19.5a6 6 0 0 1 12 0') + p('M5.4 6.6a2.6 2.6 0 0 0 0 5M18.6 6.6a2.6 2.6 0 0 1 0 5'),
  settings: p('M4 7h9M17 7h3M4 17h3M11 17h9') + c(15, 7, 2.2) + c(9, 17, 2.2),
  help: c(12, 12, 9) + p('M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.7v.6') + dot(12, 16.8),
  search: c(11, 11, 6.5) + p('M20 20l-4.3-4.3'),
  plus: p('M12 5v14M5 12h14'),
  minus: p('M5 12h14'),
  // four corners: show all of it
  expand: p('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'),
  // arrows out to the corners: fill the screen, and in again: leave it
  fullscreen: p('M14 4h6v6M20 4l-6 6M10 20H4v-6M4 20l6-6'),
  'fullscreen-exit': p('M19 10h-5V5M14 10l6-6M5 14h5v5M10 14l-6 6'),
  x: p('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  check: p('M5 12.5l4.5 4.5L19 7.5'),
  'chevron-left': p('M14.5 6l-6 6 6 6'),
  'chevron-right': p('M9.5 6l6 6-6 6'),
  'chevron-down': p('M6 9.5l6 6 6-6'),
  'arrow-right': p('M5 12h14M13 6l6 6-6 6'),
  'move-up': p('M12 19V5M6 11l6-6 6 6'),
  'move-down': p('M12 5v14M6 13l6 6 6-6'),
  more: dot(5.5, 12, 1.5) + dot(12, 12, 1.5) + dot(18.5, 12, 1.5),
  import: p('M12 3.5v10.5M7.5 9.5 12 14l4.5-4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
  export: p('M12 14V3.5M7.5 8 12 3.5 16.5 8M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
  trash: p('M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.2 7l.9 12.1A2 2 0 0 0 9.1 21h5.8a2 2 0 0 0 2-1.9L17.8 7M10 11v6M14 11v6'),
  edit: p('M14.5 5.5l4 4M4 20l1-4.6L15.9 4.5a1.5 1.5 0 0 1 2.1 0l1.5 1.5a1.5 1.5 0 0 1 0 2.1L8.6 19z'),
  undo: p('M9 13.5 4.5 9 9 4.5M4.5 9H14a5.5 5.5 0 0 1 0 11h-3'),
  redo: p('M15 13.5 19.5 9 15 4.5M19.5 9H10a5.5 5.5 0 0 0 0 11h3'),
  star: p('M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z'),
  speaker: p('M4 9.5h3l5-4v13l-5-4H4zM16 9a4 4 0 0 1 0 6M18.6 6.4a7.6 7.6 0 0 1 0 11.2'),
  'speaker-off': p('M4 9.5h3l5-4v13l-5-4H4zM16 9.5l5 5M21 9.5l-5 5'),
  keyboard: rect(2.5, 6, 19, 12) + p('M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9'),
  target: c(12, 12, 9) + c(12, 12, 5) + dot(12, 12, 1.4),
  trophy: p('M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5a3 3 0 0 0 2.8 4M16 6h2.5a3 3 0 0 1-2.8 4M12 13v4M8.5 20h7M10 17h4'),
  shuffle: p('M4 7h3c4.2 0 5.3 10 9.5 10H20M4 17h3c1.5 0 2.6-1.4 3.5-3.2M13.4 9.6c.9-1.5 2-2.6 3.6-2.6H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5'),
  play: p('M7.5 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1l-11-6.8a.6.6 0 0 0-.9.5z'),
  pause: rect(6.5, 5, 3.5, 14, 1) + rect(14, 5, 3.5, 14, 1),
  // a pencil drawing a route
  draw: p('M4 20c2.5 0 3.5-2 5-2s2 1.5 4 1.5') + p('M14.5 5.5l4 4L11 17l-4.5.5.5-4.5z'),
  columns: rect(3.5, 4.5, 17, 15) + p('M12 4.5v15'),
  print: p('M7 9V4h10v5') + p('M7 17.5H5.5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H17') + rect(7, 14, 10, 6.5, 1) + dot(17, 12, 0.9),
  copy: rect(8.5, 8.5, 12, 12) + p('M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5'),
  sun: c(12, 12, 4) + p('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'),
  moon: p('M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z'),
  palette: p('M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z') + dot(7.5, 11.5, 1.3) + dot(10, 7.5, 1.3) + dot(14.5, 7.5, 1.3),
  sparkle: p('M11 3.5l1.7 5L17.5 10l-4.8 1.6L11 16.5l-1.7-4.9L4.5 10l4.8-1.5zM18 14.5l.8 2 2 .8-2 .7-.8 2-.7-2-2-.7 2-.8z'),
  lock: rect(5, 11, 14, 9.5) + p('M8 11V8a4 4 0 0 1 8 0v3'),
  info: c(12, 12, 9) + p('M12 11v5.5') + dot(12, 7.8),
  warning: p('M10.7 4.8 3 18.2A1.5 1.5 0 0 0 4.3 20.5h15.4a1.5 1.5 0 0 0 1.3-2.3L13.3 4.8a1.5 1.5 0 0 0-2.6 0zM12 10v4.5') + dot(12, 17.3),
  sidebar: rect(3, 4, 18, 16) + p('M9 4v16'),
  grid: rect(4, 4, 7, 7, 1.5) + rect(13, 4, 7, 7, 1.5) + rect(4, 13, 7, 7, 1.5) + rect(13, 13, 7, 7, 1.5),
  refresh: p('M20 11.5a8 8 0 1 1-2.4-5.7L20 8M20 3.5V8h-4.5'),
  // a compass, for the guided tours
  compass: c(12, 12, 9) + p('M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z'),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, class: cls, label }: { name: IconName; size?: number; class?: string; label?: string }) {
  return (
    <svg
      class={cls ? `icon ${cls}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

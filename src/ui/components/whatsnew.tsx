/**
 * The "What's new" note: shown once, the first time a version opens for someone who already has
 * saved plans or parties, and from Help → About. A first visit skips it quietly.
 */
import { Button } from './controls.tsx';
import { DialogLayout } from './overlays.tsx';
import { Icon, ICONS, type IconName } from '../icons.tsx';
import { data, dialogs, openDialog, safely } from '../state.ts';
import { notesFor, WHATS_NEW, type VersionNotes } from '../../core/whatsnew.ts';

export function openWhatsNew(notes: readonly VersionNotes[] = WHATS_NEW.filter((n) => n.version === __APP_VERSION__)) {
  if (!notes.length) return Promise.resolve(undefined);
  const title = notes.length === 1 ? `What’s new in ${notes[0]!.version}` : 'What’s new';
  return openDialog(title, (close) => (
    <DialogLayout title={title} icon="sparkle" close={() => close()} foot={<Button kind="primary" onClick={() => close()}>Got it</Button>}>
      {notes.map((n) => (
        <section key={n.version} class="whats-new">
          {notes.length > 1 && <h3>{n.version}</h3>}
          <ul class="whats-new-list">
            {n.items.map((it) => (
              <li key={it.title}>
                <span class="whats-new-icon"><Icon name={it.icon in ICONS ? (it.icon as IconName) : 'sparkle'} size={20} /></span>
                <span>
                  <b>{it.title}</b>
                  <span class="muted">{it.text}</span>
                  {it.page && <a href={`#/${it.page}`} onClick={() => close()}>Show me</a>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </DialogLayout>
  ), { wide: true });
}

let settled = false;

/**
 * Called as the app opens (`opening`) and as pages open: once per visit, quietly marks the version
 * seen on a first visit, or shows the note for a version not seen yet at a calm moment (no dialog open).
 */
export function checkWhatsNew(opening = false): void {
  if (settled) return;
  const r = data();
  const app = r.app();
  if (r.db.readOnly || app.seenVersion === __APP_VERSION__) { settled = true; return; }
  // judged as the app opens: with nothing saved yet, every feature is new anyway
  const fresh = !r.plans().length && !r.parties().length;
  if (opening && !fresh) return;
  if (!fresh && dialogs.value.length) return;
  settled = true;
  const notes = fresh ? [] : notesFor(app.seenVersion, __APP_VERSION__);
  safely(() => { r.updateApp({ seenVersion: __APP_VERSION__ }); return true; });
  if (notes.length) setTimeout(() => void openWhatsNew(notes), 300);
}

/** Backing up to a file and restoring from one (Settings → Data, Search, and the banners). */
import { backupText, countsOf, readBackup } from '../core/backup.ts';
import { plural } from '../core/util.ts';
import { Button, CancelButton } from './components/controls.tsx';
import { DialogLayout } from './components/overlays.tsx';
import { datedName, download, pickFile } from './files.ts';
import { data, openDialog, safely, toast } from './state.ts';
import { play } from './sound.ts';

/** Saves everything to a dated backup file. */
export function backUpNow() {
  const r = data();
  download(datedName('Playbook backup', 'json'), backupText(r.snapshot(), __APP_VERSION__));
  if (!r.db.readOnly) r.noteBackup();
  toast('Backup saved to your downloads.', { tone: 'good' });
}

/** Asks for a backup file, then whether to merge it in or replace what's here. */
export async function restoreFromFile() {
  let file: { name: string; text: string } | null;
  try { file = await pickFile('.json,application/json'); } catch (e) { toast(e instanceof Error ? e.message : String(e), { tone: 'bad' }); return; }
  if (!file) return;
  const res = readBackup(file.text);
  if (!res.ok) { play('error'); toast(res.error, { tone: 'bad', ms: 8000 }); return; }
  const c = countsOf(res.data);
  const what = `${plural(c.plans, 'saved plan')}, ${plural(c.parties, 'party', 'parties')}, ${plural(c.plays, 'play of your own', 'plays of your own')}, ${plural(c.games, 'logged game')} and ${plural(c.themes, 'theme')}`;
  const how = await openDialog<'merge' | 'replace'>('Restore this backup?', (close) => (
    <DialogLayout title="Restore this backup?" icon="import" close={() => close()} foot={<>
      <CancelButton onClick={() => close()} />
      <Button onClick={() => close('replace')}>Replace</Button>
      <Button kind="primary" autoFocus onClick={() => close('merge')}>Merge</Button>
    </>}>
      <p>“{file!.name}” holds {what}.</p>
      <p class="muted">Merge keeps what’s here and adds what’s new. Replace swaps everything for the backup. Either way, you can undo it.</p>
    </DialogLayout>
  ));
  if (!how) return;
  if (safely(() => { data().restore(res.data, how); return true; })) toast(how === 'merge' ? 'Backup merged in.' : 'Backup restored.', { tone: 'good', undo: true });
}

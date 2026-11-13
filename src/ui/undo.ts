/**
 * Undo and redo from anywhere: Ctrl Z, the sidebar buttons, the command palette and a message's
 * Undo button.
 */
import type { Action } from '../data/db.ts';
import { data, safely, toast } from './state.ts';
import { play } from './sound.ts';

function report(a: Action | null | undefined, kind: 'undo' | 'redo') {
  if (a === undefined) return; // an error, already reported
  if (!a) { toast(kind === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.'); return; }
  if (a.stale) { toast(`Couldn’t ${kind}: ${a.label}. It has changed since.`); return; }
  play('undo');
  // the message's Redo is for this change only, while it's still the one a redo would bring back
  const back = data().db.redoStack.at(-1);
  if (kind === 'undo') toast(`Undone: ${a.label}.`, { action: { label: 'Redo', run: () => { if (canRedoThis(back)) redo(); }, live: () => canRedoThis(back) } });
  else toast(`Redone: ${a.label}.`);
}

const lookOnly = () => {
  if (!data().db.readOnly) return false;
  toast('This tab can only look, so it can’t undo or redo.');
  return true;
};

export function undo() {
  if (lookOnly()) return;
  report(safely(() => data().undo()), 'undo');
}

export function redo() {
  if (lookOnly()) return;
  report(safely(() => data().redo()), 'redo');
}

/** Whether `a` is still the change an undo would take back (a message's Undo button is about that one change). */
export const canUndoThis = (a: Action | null): boolean => {
  return !!a && !data().db.readOnly && data().db.undoStack.at(-1) === a;
};

const canRedoThis = (a: Action | undefined): boolean => !!a && !data().db.readOnly && data().db.redoStack.at(-1) === a;

/** Undoes `a` if it's still the latest change. */
export function undoThis(a: Action | null) {
  if (!canUndoThis(a)) return;
  report(safely(() => data().undo()), 'undo');
}

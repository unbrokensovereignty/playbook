/**
 * Asking the browser to keep Playbook's saved data. Without that, a browser short of disk space
 * may clear the data of sites you rarely visit. Some browsers decide by themselves (Chrome and Edge
 * go by how much you use the page); Firefox asks you.
 */
import { data } from './state.ts';

export type Kept = 'kept' | 'not' | 'unknown';

/** Whether the browser has agreed to keep the data, and roughly how much is stored (bytes), when it says. */
export async function storageState(): Promise<{ kept: Kept; used: number | null }> {
  const st = globalThis.navigator?.storage;
  let kept: Kept = 'unknown', used: number | null = null;
  try { if (st?.persisted) kept = (await st.persisted()) ? 'kept' : 'not'; } catch { /* not available here */ }
  try { if (st?.estimate) used = (await st.estimate()).usage ?? null; } catch { /* not available here */ }
  return { kept, used };
}

/** Asks the browser to keep the data. Resolves what it said. */
export async function askToKeep(): Promise<Kept> {
  const st = globalThis.navigator?.storage;
  if (!st?.persist) return 'unknown';
  try { return (await st.persist()) ? 'kept' : 'not'; } catch { return 'unknown'; }
}

/** "340 KB", "2.4 MB". */
export function sizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Asks the browser once, after you first save something; Settings → Data can ask again. */
export function askOnce() {
  const r = data();
  if (r.db.readOnly || r.db.backend.kind === 'memory' || r.app().keepAsked) return;
  r.updateApp({ keepAsked: true });
  void askToKeep();
}

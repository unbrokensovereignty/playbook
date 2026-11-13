/**
 * What each version brought, in a few lines: shown once, the first time that version opens, and
 * any time from Help → About. Every version listed needs a heading in CHANGELOG.md.
 */

export interface NewThing {
  /** An icon name from ui/icons.tsx. */
  icon: string;
  title: string;
  text: string;
  /** Where "Show me" goes ("planner"), if anywhere. */
  page?: string;
}

export interface VersionNotes { version: string; items: readonly NewThing[] }

/** Newest first. Empty until a version has notes of its own to show. */
export const WHATS_NEW: readonly VersionNotes[] = [];

/** Compares "x.y.z" versions: below 0 when a is older than b, 0 when the same, above 0 when newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0), pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * The notes to show on opening `current` after last seeing the notes of `seen` ('' when none were
 * seen yet): every version newer than `seen` up to `current`, newest first. Having seen none, only
 * the current version's.
 */
export function notesFor(seen: string, current: string): VersionNotes[] {
  if (!seen) return WHATS_NEW.filter((n) => n.version === current);
  return WHATS_NEW.filter((n) => compareVersions(n.version, seen) > 0 && compareVersions(n.version, current) <= 0);
}

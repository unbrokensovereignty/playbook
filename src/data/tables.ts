/**
 * The saved data as plain tables: each store maps keys to records. Every change is a list of
 * key updates with the value before and after, which is all that saving, undo and other tabs need.
 */

export const STORES = ['meta', 'plans', 'parties'] as const;
export type StoreName = (typeof STORES)[number];

export type Tables = Record<StoreName, Map<string, unknown>>;
export const emptyTables = (): Tables => Object.fromEntries(STORES.map((s) => [s, new Map()])) as Tables;

/** One key's change. `null` means the key doesn't exist (before a create, or after a delete). */
export interface Change { store: StoreName; key: string; before: unknown; after: unknown; whole?: boolean }

/** What gets written to storage: the new value, or null to delete. */
export interface Write { store: StoreName; key: string; value: unknown }

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
type Item = Record<string, unknown> & { id: string };
/** A list of records with ids (themes), which undo can take back item by item. */
const isIdList = (v: unknown): v is Item[] => Array.isArray(v) && v.every((x) => isObj(x) && typeof x.id === 'string');

/**
 * Undo for a list of records with ids: items the change added go, items it removed come back where
 * they were, items it edited get their fields back (see `revertValue`), and an order it changed goes
 * back, so another one added since doesn't stop a rename being undone.
 */
function revertList(current: Item[], before: Item[], after: Item[]): Item[] | undefined {
  const was = new Map(before.map((x) => [x.id, x])), now = new Map(after.map((x) => [x.id, x]));
  let changed = false;
  let out = current.filter((x) => {
    const added = now.has(x.id) && !was.has(x.id);
    if (added) changed = true;
    return !added;
  });
  out = out.map((x) => {
    const b = was.get(x.id), a = now.get(x.id);
    if (!b || !a || deepEqual(a, b)) return x;
    const v = revertValue(x, b, a);
    if (v == null) return x;
    changed = true;
    return v as Item;
  });
  before.forEach((b, i) => {
    if (now.has(b.id) || out.some((x) => x.id === b.id)) return;
    const prev = before.slice(0, i).reverse().find((p) => out.some((x) => x.id === p.id));
    out.splice(prev ? out.findIndex((x) => x.id === prev.id) + 1 : 0, 0, b);
    changed = true;
  });
  // a new order: put the items both lists share back in their old order, if nothing moved them since
  const kept = (list: Item[]) => list.filter((x) => was.has(x.id) && now.has(x.id) && out.some((y) => y.id === x.id)).map((x) => x.id);
  const oldOrder = kept(before), newOrder = kept(after), nowOrder = kept(out);
  if (!deepEqual(oldOrder, newOrder) && deepEqual(nowOrder, newOrder)) {
    const byId = new Map(out.map((x) => [x.id, x]));
    const slots = out.map((x, i) => (oldOrder.includes(x.id) ? i : -1)).filter((i) => i >= 0);
    slots.forEach((slot, j) => { out[slot] = byId.get(oldOrder[j]!)!; });
    changed = true;
  }
  return changed ? out : undefined;
}

/**
 * The value to restore when undoing a change, given what's there now. Only the fields the change
 * made are put back, and only where nothing else has changed them since, so undoing an edit to a
 * plan doesn't also undo a later change to it. Returns `undefined` when there's nothing to do.
 */
export function revertValue(current: unknown, before: unknown, after: unknown): unknown {
  if (before == null) return current == null ? undefined : null; // undo a create: delete it
  if (after == null) return current == null ? before : undefined; // undo a delete: put it back (unless something took its place)
  if (current == null) return undefined; // deleted since: leave it deleted
  if (isIdList(current) && isIdList(before) && isIdList(after)) return revertList(current, before, after);
  if (!isObj(current) || !isObj(before) || !isObj(after)) return deepEqual(current, after) ? before : undefined;
  const out: Record<string, unknown> = { ...current };
  let changed = false;
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (deepEqual(before[k], after[k])) continue;
    if (isObj(current[k]) && isObj(before[k]) && isObj(after[k])) {
      // a nested record that something else has touched since: put back just the fields this change made
      const inner = revertValue(current[k], before[k], after[k]);
      if (inner !== undefined) { out[k] = inner; changed = true; }
      continue;
    }
    if (!deepEqual(current[k], after[k])) continue; // changed again since: keep the newer value
    if (k in before) out[k] = before[k]; else delete out[k];
    changed = true;
  }
  return changed ? out : undefined;
}

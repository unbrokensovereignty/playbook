import { describe, spec, eq, ok, throws } from './harness.ts';
import { Db, ReadOnlyError } from '../../src/data/db.ts';
import { memoryBackend, type Backend } from '../../src/data/backends.ts';
import { emptyTables, revertValue, type Tables } from '../../src/data/tables.ts';
import { openRepo, checkTables, RECENT_MOST, type Repo } from '../../src/data/repo.ts';
import { readStash, restoreStash, stashUnsaved, type StashStore } from '../../src/data/rescue.ts';
import { backupText, readBackup } from '../../src/core/backup.ts';
import { newQuery, type Query } from '../../src/core/engine/query.ts';
import { LIMITS } from '../../src/core/saved.ts';
import { BUILT_IN_THEMES } from '../../src/core/theme.ts';

const T0 = new Date(2026, 9, 24, 10).getTime();
const haven = (patch: Partial<Query> = {}): Query => ({ ...newQuery(), map: 'haven', ...patch });

async function fresh(tables?: Tables): Promise<{ repo: Repo; tables: Tables; tick: (ms: number) => void }> {
  const t = tables ?? emptyTables();
  let now = T0;
  const { repo } = await openRepo({ backend: memoryBackend(t), strict: true, clock: () => now });
  return { repo, tables: t, tick: (ms) => { now += ms; } };
}

describe('the database', () => {
  spec('only the fields a change made are put back, and only if nothing changed them since', () => {
    eq(revertValue({ a: 2, b: 5 }, { a: 1, b: 5 }, { a: 2, b: 5 }), { a: 1, b: 5 });
    eq(revertValue({ a: 2, b: 9 }, { a: 1, b: 5 }, { a: 2, b: 5 }), { a: 1, b: 9 }, 'b changed later and stays');
    eq(revertValue({ a: 3 }, { a: 1 }, { a: 2 }), undefined, 'changed again since: nothing to undo');
    eq(revertValue({ a: 1 }, null, { a: 1 }), null, 'undo a create');
    eq(revertValue(null, { a: 1 }, null), { a: 1 }, 'undo a delete');
    eq(revertValue({ a: 5 }, { a: 1 }, null), undefined, 'something new took its place');
    eq(revertValue({ n: { a: 2, t: 9 } }, { n: { a: 1, t: 5 } }, { n: { a: 2, t: 5 } }), { n: { a: 1, t: 9 } }, 'nested fields too');
  });
  spec('a change updates the tables, tells listeners, saves in the background and can be undone and redone', async () => {
    const saved = emptyTables();
    const db = new Db(memoryBackend(saved), emptyTables(), true);
    const heard: string[] = [];
    db.subscribe((stores, origin) => heard.push(`${[...stores].join(',')}:${origin}`));
    db.transact('Add', (tx) => { tx.put('plans', 'p1', { id: 'p1', name: 'A' }); eq(tx.get('plans', 'p1'), { id: 'p1', name: 'A' }, 'reads see the transaction’s writes'); });
    eq(db.get('plans', 'p1'), { id: 'p1', name: 'A' });
    eq([db.unsaved, db.saveState], [1, 'saving'], 'a change waiting to be written isn’t shown as saved');
    await db.flush();
    eq([db.unsaved, db.saveState, saved.plans.get('p1')], [0, 'saved', { id: 'p1', name: 'A' }]);
    db.transact('Rename', (tx) => tx.put('plans', 'p1', { id: 'p1', name: 'B' }));
    eq(db.undo()?.label, 'Rename');
    eq(db.get<{ name: string }>('plans', 'p1')?.name, 'A');
    db.redo();
    eq(db.get<{ name: string }>('plans', 'p1')?.name, 'B');
    db.undo(); db.undo();
    eq(db.get('plans', 'p1'), undefined);
    eq(db.undo(), null);
    await db.flush();
    ok(!saved.plans.has('p1'));
    eq(heard, ['plans:local', 'plans:local', 'plans:undo', 'plans:redo', 'plans:undo', 'plans:undo']);
  });
  spec('a failed transaction changes nothing; saved records can’t be edited in place', () => {
    const db = new Db(memoryBackend(), emptyTables(), true);
    throws(() => db.transact('Oops', (tx) => { tx.put('plans', 'x', { id: 'x' }); throw new Error('no'); }));
    eq(db.get('plans', 'x'), undefined);
    eq(db.unsaved, 0);
    db.transact('Add', (tx) => tx.put('plans', 'y', { id: 'y', team: ['omen'] }));
    throws(() => { (db.get<{ team: string[] }>('plans', 'y')!.team).push('sova'); }, 'frozen');
    eq(db.transact('Nothing', () => {}), null);
  });
  spec('saving retries after a failure without losing newer changes', async () => {
    let fail = true;
    const store = emptyTables();
    const inner = memoryBackend(store);
    const flaky: Backend = { ...inner, write: async (w) => { if (fail) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return inner.write(w); } };
    const db = new Db(flaky, emptyTables());
    db.transact('A', (tx) => tx.put('meta', 'k', 1));
    await db.flush();
    eq([db.saveState, db.saveError, db.unsaved], ['error', 'Your browser’s storage is full.', 1]);
    db.transact('B', (tx) => tx.put('meta', 'k', 2));
    fail = false;
    await db.flush();
    eq([db.saveState, db.unsaved, store.meta.get('k')], ['saved', 0, 2]);
  });
  spec('a change just after an undo or redo is a step of its own, even one that would join the last', () => {
    const db = new Db(memoryBackend(), emptyTables());
    const set = (v: number) => db.transact('Change “Comps to show”', (tx) => tx.put('meta', 'k', v), { join: 60_000 });
    set(17); set(18);
    eq(db.undoStack.length, 1, 'presses close together are one step');
    db.undo();
    db.redo();
    set(19);
    db.undo();
    eq(db.tables.meta.get('k'), 18, 'back to where the redo left it');
    db.undo();
    eq(db.tables.meta.get('k'), undefined);
  });
  spec('a read-only tab refuses changes', () => {
    const db = new Db(memoryBackend(), emptyTables());
    db.readOnly = true;
    throws(() => db.transact('A', (tx) => tx.put('meta', 'k', 1)));
    try { db.transact('A', () => {}); } catch (e) { ok(e instanceof ReadOnlyError); }
    eq(db.undo(), null);
  });
  spec('a write in progress still counts as unwritten until it lands', async () => {
    let release = () => {}, first = true;
    const inner = memoryBackend();
    const slow: Backend = { ...inner, write: (w) => (first ? new Promise((done) => { first = false; release = () => { void inner.write(w).then(done); }; }) : inner.write(w)) };
    const db = new Db(slow, emptyTables());
    db.transact('A', (tx) => tx.put('meta', 'k', 1));
    const done = db.flush();
    eq([db.unsaved, db.unwritten()], [0, [{ store: 'meta', key: 'k', value: 1 }]]);
    db.transact('B', (tx) => tx.put('meta', 'k', 2));
    eq(db.unwritten(), [{ store: 'meta', key: 'k', value: 2 }], 'the newest value wins');
    release();
    await done;
    eq(db.unwritten(), []);
  });
});

describe('saved plans', () => {
  spec('save, rename, star and delete a plan, each one undoable step', async () => {
    const { repo, tick } = await fresh();
    const p = repo.savePlan({ name: '  Haven  attack ', query: haven({ side: 'attack' }), team: ['omen', 'sova', 'jett', 'killjoy', 'breach'] })!;
    eq([p.name, p.team.length, p.query.side], ['Haven attack', 5, 'attack']);
    tick(1000);
    const q = repo.savePlan({ name: 'Bind', query: { ...newQuery(), map: 'bind' } })!;
    eq(repo.plans().map((x) => x.id), [q.id, p.id], 'newest first');
    ok(repo.updatePlan(p.id, { starred: true }));
    eq(repo.plans().map((x) => x.id), [p.id, q.id], 'starred first');
    eq(repo.db.undoStack.at(-1)?.label, 'Star “Haven attack”');
    repo.updatePlan(p.id, { name: 'Haven A' });
    eq(repo.db.undoStack.at(-1)?.label, 'Rename “Haven attack” to “Haven A”');
    eq(repo.deletePlans([p.id, 'p_nothere0']), 1);
    eq(repo.plans().map((x) => x.name), ['Bind']);
    eq(repo.undo()?.label, 'Delete “Haven A”');
    eq(repo.plan(p.id)?.name, 'Haven A');
    repo.undo(); repo.undo();
    eq([repo.plan(p.id)?.name, repo.plan(p.id)?.starred], ['Haven attack', false]);
    ok(!repo.updatePlan('p_nothere0', { name: 'x' }));
  });
  spec('a saved plan’s question is made safe, and there’s a most', async () => {
    const { repo } = await fresh();
    const p = repo.savePlan({ name: '', query: { ...haven(), party: 4 as 5, include: ['nobody'] }, team: ['omen', 'nobody'] })!;
    eq([p.name, p.query.party, p.query.include, p.team], ['Saved plan', 5, [], ['omen']]);
    for (let i = 1; i < LIMITS.plans; i++) repo.db.transact('', (tx) => tx.put('plans', `p_fill${String(i).padStart(4, '0')}`, { ...p, id: `p_fill${String(i).padStart(4, '0')}` }), { undo: false });
    eq(repo.savePlan({ name: 'One too many', query: haven() }), null);
  });
});

describe('parties', () => {
  spec('make, change and delete a party, keeping when it was made', async () => {
    const { repo, tick } = await fresh();
    const d = repo.saveParty({ name: 'Duo', players: [{ name: 'Me', agents: ['omen', 'viper'] }, { name: 'Sam', agents: [] }] })!;
    eq(repo.db.undoStack.at(-1)?.label, 'Make the party “Duo”');
    tick(5000);
    const d2 = repo.saveParty({ ...d, players: [...d.players, { name: 'Lee', agents: ['sova'] }] })!;
    eq([d2.id, d2.created, d2.updated, d2.players.length], [d.id, T0, T0 + 5000, 3]);
    eq(repo.saveParty({ name: 'Four', players: [1, 2, 3, 4].map((n) => ({ name: `P${n}`, agents: [] })) }), null, 'four players is no party');
    repo.deleteParty(d.id);
    eq(repo.parties(), []);
    repo.undo();
    eq(repo.party(d.id)?.players.length, 3);
  });
});

describe('plays you draw', () => {
  spec('draw a play, change it, delete it with undo, and there’s a most', async () => {
    const { repo, tick } = await fresh();
    const draft = { map: 'haven', side: 'attack' as const, site: 'C' as const, kind: 'hit' as const, name: 'C long', about: '', steps: [{ jobs: ['entry' as const], route: ['C Long', 'C Site'], text: 'Take the site.', when: null }] };
    const a = repo.savePlay(draft)!;
    eq(repo.db.undoStack.at(-1)?.label, 'Draw the play “C long”');
    tick(1000);
    const b = repo.savePlay({ ...draft, name: 'C again' })!;
    eq(repo.myPlays().map((p) => p.id), [b.id, a.id]);
    tick(1000);
    repo.savePlay({ ...a, name: 'C long, faster' });
    eq(repo.myPlays().map((p) => p.name), ['C long, faster', 'C again'], 'a change puts it first and keeps its id');
    eq(repo.myPlay(a.id)?.created, a.created);
    eq(repo.snapshot().plays.length, 2, 'in backups');
    repo.deletePlay(a.id);
    eq(repo.myPlays().map((p) => p.id), [b.id]);
    repo.undo();
    eq(repo.myPlays().length, 2);
    throws(() => repo.savePlay({ ...draft, steps: [] }), 'a play with no steps isn’t kept');
    for (let i = repo.myPlays().length; i < LIMITS.plays; i++) repo.savePlay({ ...draft, name: `Play ${i}` });
    eq(repo.savePlay({ ...draft, name: 'One more' }), null);
  });
});

describe('the planner’s question', () => {
  spec('the question is kept as it was left, without an undo step', async () => {
    const { repo } = await fresh();
    repo.setDraft(haven());
    eq(repo.app().draft?.map, 'haven');
    eq(repo.db.undoStack.length, 0);
  });
  spec('recent questions: newest first, no copies, a most kept', async () => {
    const { repo } = await fresh();
    repo.addRecent(haven());
    repo.addRecent({ ...newQuery(), map: 'bind' });
    repo.addRecent(haven());
    eq(repo.app().recent.map((x) => x.map), ['haven', 'bind']);
    for (const m of ['ascent', 'abyss', 'breeze', 'corrode', 'fracture', 'icebox', 'lotus', 'pearl', 'split']) repo.addRecent({ ...newQuery(), map: m });
    eq(repo.app().recent.length, RECENT_MOST);
    eq(repo.app().recent[0]!.map, 'split');
    repo.clearRecent();
    eq(repo.app().recent, []);
  });
});

describe('settings and themes in the repository', () => {
  spec('settings change, refuse bad values, reset, and undo', async () => {
    const { repo } = await fresh();
    ok(repo.setSetting('resultCount', 20));
    eq(repo.settings().resultCount, 20);
    ok(!repo.setSetting('defaultRank', 'mythic'));
    repo.setSettings({ sound: false, defaultRank: 'diamond' }, 'Change two settings');
    eq([repo.settings().sound, repo.settings().defaultRank], [false, 'diamond']);
    repo.resetSetting('resultCount');
    eq(repo.settings().resultCount, 10);
    repo.undo();
    eq(repo.settings().resultCount, 20);
  });
  spec('a theme just made is put to use, and deleting the theme in use goes back to the usual one', async () => {
    const { repo } = await fresh();
    const light = repo.saveTheme({ ...BUILT_IN_THEMES[0]!, id: '', base: 'light', name: 'Mine' })!;
    eq(repo.settings().themeLight, light.id);
    repo.deleteTheme(light.id);
    eq(repo.settings().themeLight, 'paper');
    repo.undo();
    eq(repo.settings().themeLight, light.id);
  });
});

describe('saved data', () => {
  spec('everything survives closing and opening again', async () => {
    const { repo, tables } = await fresh();
    repo.savePlan({ name: 'Haven', query: haven(), team: ['omen'] });
    repo.saveParty({ name: 'Duo', players: [{ name: 'A', agents: [] }, { name: 'B', agents: ['jett'] }] });
    repo.setSetting('resultCount', 25);
    repo.addRecent(haven());
    await repo.db.flush();
    const again = (await fresh(tables)).repo;
    eq(again.plans(), repo.plans());
    eq(again.parties(), repo.parties());
    eq(again.settings().resultCount, 25);
    eq(again.app().recent, repo.app().recent);
  });
  spec('damaged records are set aside, not lost', async () => {
    const t = emptyTables();
    t.plans.set('p_good1234', { id: 'p_good1234', name: 'Good', query: haven() });
    t.plans.set('bad', { id: 'bad id' });
    t.parties.set('y_solo1234', { id: 'y_solo1234', players: [{ name: 'Solo' }] });
    t.meta.set('settings', { resultCount: 'lots', sound: false, bogus: 1 });
    t.meta.set('app', { recent: [haven(), 'junk'], draft: { map: 'nowhere' }, views: { 'agents.role': 'duelist', 'Bad Key': 'x' } });
    const { tables, quarantined } = checkTables(t, T0);
    eq(quarantined.map((x) => x.key), ['bad', 'y_solo1234']);
    eq(tables.meta.get('settings'), { sound: false });
    const { repo } = await fresh(t);
    eq(repo.plans().map((p) => p.id), ['p_good1234']);
    eq(repo.app().recent.length, 1);
    eq(repo.app().draft?.map, 'any', 'a damaged draft falls back to a fresh question');
    eq(repo.app().views, { 'agents.role': 'duelist' });
    await repo.db.flush();
    ok(!t.plans.has('bad'), 'the damaged record left the table');
    eq((t.meta.get('quarantine') as unknown[]).length, 2, 'and is kept aside');
  });
  spec('changes not yet written when the tab closes are kept and put back on the next open', async () => {
    const mem = new Map<string, string>();
    const store: StashStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
    const { repo, tables } = await fresh();
    const p = repo.savePlan({ name: 'Kept', query: haven() })!;
    await repo.db.flush();
    repo.savePlan({ name: 'New', query: haven() });
    repo.deletePlans([p.id]);
    const kept = repo.db.unwritten();
    ok(kept.some((w) => w.store === 'plans' && w.key === p.id && w.value === null), 'the deletion is kept');
    ok(stashUnsaved('pb', kept, store));
    const again = (await fresh(tables)).repo;
    eq(again.plans().map((x) => x.name), ['Kept']);
    eq(restoreStash(again, 'pb', store), kept.length);
    eq(again.plans().map((x) => x.name), ['New']);
    eq(readStash('pb', store), [], 'the copy is used once');
    await again.db.flush();
    eq([...tables.plans.values()].map((x) => (x as { name: string }).name), ['New']);
    // damaged copies change nothing
    store.setItem('pb:unsaved', JSON.stringify([{ store: 'plans', key: 'p_x1234567', value: { id: 'nope' } }, { store: 'nowhere', key: 'k', value: 1 }, 'junk']));
    eq(readStash('pb', store).length, 1, 'unknown stores and junk are left out');
    eq(restoreStash(again, 'pb', store), 0);
    store.setItem('pb:unsaved', '{not json');
    eq(restoreStash(again, 'pb', store), 0);
    eq(mem.size, 0);
  });
  spec('backups restore by replacing or merging, and can be undone, as can erasing everything', async () => {
    const { repo } = await fresh();
    repo.savePlan({ name: 'Kept', query: haven() });
    const backup = readBackup(backupText(repo.snapshot(), 'test', new Date(T0)));
    ok(backup.ok);
    if (!backup.ok) return;
    repo.savePlan({ name: 'Later', query: haven() });
    repo.restore(backup.data, 'replace');
    eq(repo.plans().map((x) => x.name), ['Kept']);
    repo.undo();
    eq(repo.plans().map((x) => x.name).sort(), ['Kept', 'Later']);
    repo.restore(backup.data, 'merge');
    eq(repo.plans().length, 2);
    repo.addRecent(haven());
    repo.eraseAll();
    eq([repo.plans().length, repo.app().recent.length], [0, 0]);
    repo.undo();
    eq(repo.plans().length, 2);
  });
});

import { describe, spec, eq, ok } from './harness.ts';
import { asPlay, LIMITS, parsePlayCode, PLAY_CODE_PREFIX, PLAY_JOBS, playCode, poolsOf, sanitizeGame, sanitizeGames, sanitizeMyPlay, sanitizeMyPlays, sanitizeParty, sanitizePlan } from '../../src/core/saved.ts';
import { playsFor } from '../../src/core/engine/plays.ts';
import { BACKUP_FORMAT, BACKUP_KIND, backupText, countsOf, emptyBackup, mergeBackup, readBackup, type BackupData } from '../../src/core/backup.ts';
import { newQuery, sanitizeQuery, startingQuery } from '../../src/core/engine/query.ts';
import { defaultSettings, resolveSettings, sanitizeSetting, sanitizeSettings, SETTINGS, SETTING_KEYS, youOf } from '../../src/core/settings.ts';
import { clean, escapeRegExp, fold, listJoin } from '../../src/core/text.ts';
import { BUILT_IN_THEMES, parseThemeCode, THEME_CODE_PREFIX, themeCode } from '../../src/core/theme.ts';

const T = 1_790_000_000_000;
const plan = (over: Record<string, unknown> = {}) => ({ id: 'p_abcd1234', name: 'Haven attack', note: '', query: { ...newQuery(), map: 'haven' }, team: ['omen', 'sova', 'jett', 'killjoy', 'breach'], starred: false, created: T, updated: T, ...over });
const party = (over: Record<string, unknown> = {}) => ({ id: 'y_abcd1234', name: 'Duo', players: [{ name: 'Me', agents: ['omen'] }, { name: 'Sam', agents: [] }], created: T, updated: T, ...over });
const myPlay = (over: Record<string, unknown> = {}) => ({
  id: 'm_abcd1234', map: 'ascent', side: 'attack', site: 'B', kind: 'hit', name: 'Our B hit', about: 'Fast through B Main.',
  steps: [
    { jobs: ['smoke'], route: ['Attacker Side Spawn', 'B Lobby'], text: 'Smoke Mid Market and B Boat House.', when: null },
    { jobs: ['entry', 'flash'], route: ['B Lobby', 'B Main', 'B Site'], text: 'Flash and take the site.', when: 'hit' },
  ],
  created: T, updated: T, ...over,
});
const game = (over: Record<string, unknown> = {}) => ({ id: 'g_abcd1234', map: 'ascent', agent: 'omen', team: ['omen', 'jett', 'sova', 'killjoy', 'kayo'], result: 'win', note: 'Smokes on time.', played: T, ...over });

describe('saved plans and parties', () => {
  spec('a good plan reads back as it was', () => {
    eq(sanitizePlan(plan()), plan() as unknown);
  });
  spec('a damaged plan is mended where it can be, and refused where it can’t', () => {
    eq(sanitizePlan({ ...plan(), id: 'bad id' }), null);
    eq(sanitizePlan('junk'), null);
    const p = sanitizePlan(plan({ name: '  ', note: 5, query: 'x', team: ['omen', 'omen', 'nobody'], starred: 'yes', created: -1, updated: 'never' }), T)!;
    eq([p.name, p.note, p.team, p.starred, p.created, p.updated], ['Saved plan', '', ['omen'], false, T, T]);
    eq(p.query, newQuery());
    eq(sanitizePlan(plan({ name: 'x'.repeat(200) }))!.name.length, LIMITS.name);
  });
  spec('a party is two, three or five players, each with agents they play', () => {
    eq(sanitizeParty(party()), party() as unknown);
    eq(sanitizeParty(party({ players: [{ name: 'Solo', agents: [] }] })), null, 'one player is no party');
    eq(sanitizeParty(party({ players: [1, 2, 3, 4].map((n) => ({ name: `P${n}`, agents: [] })) })), null, 'four players');
    const p = sanitizeParty(party({ name: '', players: [{ agents: ['jett', 'jett', 'nope'] }, { name: 'B', agents: 'all' }, {}] }))!;
    eq(p.name, 'My party');
    eq(p.players, [{ name: 'Player 1', agents: ['jett'] }, { name: 'B', agents: [] }, { name: 'Player 3', agents: [] }]);
    eq(poolsOf(p), [['jett'], [], []]);
  });
});

describe('plays you draw', () => {
  spec('a good play reads back as it was', () => {
    eq(sanitizeMyPlay(myPlay()), myPlay() as unknown);
  });
  spec('a damaged play is mended where it can be, and refused where it can’t', () => {
    eq(sanitizeMyPlay(myPlay({ map: 'nowhere' })), null, 'no such map');
    eq(sanitizeMyPlay(myPlay({ id: 'bad id' })), null);
    eq(sanitizeMyPlay(myPlay({ steps: [{ jobs: ['smoke'], route: ['Not A Callout'], text: '' }] })), null, 'no step left');
    const p = sanitizeMyPlay(myPlay({ side: 'sideways', site: 'C', kind: 'retake', name: ' ', steps: [
      { jobs: ['smoke', 'smoke', 'nothing', 'wall', 'flash'], route: ['B Main', 'B Main', 'Nowhere', 'B Site'], text: 7, when: 'soon' },
      { jobs: [], route: ['B Site'], text: 'No job' },
      'junk',
    ] }))!;
    eq([p.side, p.site, p.kind, p.name], ['attack', null, 'hit', 'My play'], 'Ascent has no C, and a retake isn’t an attack play');
    eq(p.steps, [{ jobs: ['smoke', 'wall'], route: ['B Main', 'B Site'], text: '', when: null }]);
  });
  spec('a play has one job for each of five players at most', () => {
    const steps = Array.from({ length: 4 }, () => ({ jobs: ['entry', 'duel'], route: ['B Main'], text: 'Go.' }));
    const p = sanitizeMyPlay(myPlay({ steps }))!;
    eq(p.steps.map((s) => s.jobs.length), [2, 2, 1]);
    eq(p.steps.reduce((n, s) => n + s.jobs.length, 0), PLAY_JOBS);
    eq(sanitizeMyPlay(myPlay({ steps: Array.from({ length: 20 }, () => ({ jobs: ['entry'], route: ['A Main', 'A Main', 'A Site', ...Array(20).fill('A Site')], text: '' })) }))!.steps[0]!.route, ['A Main', 'A Site']);
  });
  spec('plays read back newest first, each once, up to the limit', () => {
    const list = sanitizeMyPlays([myPlay(), myPlay(), myPlay({ id: 'm_newer999', updated: T + 5 }), 'junk']);
    eq(list.map((p) => p.id), ['m_newer999', 'm_abcd1234']);
    eq(sanitizeMyPlays(Array.from({ length: LIMITS.plays + 3 }, (_, i) => myPlay({ id: `m_many${String(i).padStart(4, '0')}` }))).length, LIMITS.plays);
  });
  spec('a drawn play is filled like a built-in one, its moments and utility worked out the same way', () => {
    const play = asPlay(sanitizeMyPlay(myPlay())!);
    eq([play.mine, play.steps[0]!.when, play.steps[1]!.when], [true, 'hit', 'hit']);
    eq(play.steps[0]!.on, ['Mid Market', 'B Boat House']);
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    const f = playsFor(team, 'ascent', 'attack', [], false, [play]).find((x) => x.play.id === play.id)!;
    ok(f, 'the planner lists it with the built-in plays');
    eq(f.steps[0]!.who.map((d) => d.id), ['omen']);
    eq(f.steps[1]!.who.length, 2);
    ok(f.steps[0]!.throws.some((t) => t.kind === 'smoke'), 'its smokes are drawn');
    eq(playsFor(team, 'ascent', 'defense', [], false, [play]).some((x) => x.play.id === play.id), false, 'only on its side');
  });
  spec('a play travels as a code: everything but its id and dates comes back, checked like any play', () => {
    const p = sanitizeMyPlay(myPlay({ name: 'Our “fast” B | hit', about: 'Ça marche.' }))!;
    const code = playCode(p);
    ok(code.startsWith(PLAY_CODE_PREFIX) && /^[A-Za-z0-9:_-]+$/.test(code), code);
    const { id: _id, created: _c, updated: _u, ...rest } = p;
    eq(parsePlayCode(code), rest as unknown);
    eq(parsePlayCode(`  “${code}” `), rest as unknown, 'quotes and spaces are fine');
    for (const bad of ['', 'hello', PLAY_CODE_PREFIX, `${PLAY_CODE_PREFIX}!!!`, themeCode(BUILT_IN_THEMES[0]!)]) eq(parsePlayCode(bad), null, bad);
    // a code made by hand for a map that isn't there, or with nothing left of its steps, is no play
    const forge = (v: unknown) => PLAY_CODE_PREFIX + btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    eq(parsePlayCode(forge(['nowhere', 'attack', 'B', 'hit', 'x', '', [['smoke', 'B Lobby', 'x', '']]])), null);
    eq(parsePlayCode(forge(['ascent', 'attack', 'B', 'hit', 'x', '', [['smoke', 'Not A Callout', 'x', '']]])), null);
    eq(parsePlayCode(forge(['ascent', 'attack', 'B', 'hit', 'x', '', [['smoke dance', 'B Lobby>Nowhere>B Main', 'x', 'soon']]]))!.steps, [{ jobs: ['smoke'], route: ['B Lobby', 'B Main'], text: 'x', when: null }]);
  });
});

describe('your games', () => {
  spec('a game needs a map, your agent and how it ended, and keeps your agent in the team', () => {
    eq(sanitizeGame(game()), game());
    eq(sanitizeGame(game({ team: ['jett', 'sova'] }))!.team, ['omen', 'jett', 'sova'], 'your agent is always in the team');
    eq(sanitizeGame(game({ team: ['omen', 'omen', 'nobody', 'jett', 'sova', 'killjoy', 'raze', 'fade'] }))!.team, ['omen', 'jett', 'sova', 'killjoy', 'raze'], 'five at most, each once');
    eq(sanitizeGame(game({ map: 'nowhere' })), null);
    eq(sanitizeGame(game({ agent: 'nobody' })), null);
    eq(sanitizeGame(game({ result: 'maybe' })), null);
    eq(sanitizeGame(game({ note: 'x'.repeat(400) }))!.note.length, LIMITS.gameNote);
  });
  spec('games read back newest first, each once, up to the limit', () => {
    const list = sanitizeGames([game(), game(), game({ id: 'g_newer999', played: T + 5 }), 'junk']);
    eq(list.map((g) => g.id), ['g_newer999', 'g_abcd1234']);
    eq(sanitizeGames(Array.from({ length: LIMITS.games + 5 }, (_, i) => game({ id: `g_many${String(i).padStart(4, '0')}` }))).length, LIMITS.games);
  });
  spec('a backup without games reads back with none, and merging keeps the games from both', () => {
    const r = readBackup(JSON.stringify({ kind: BACKUP_KIND, format: 1 }));
    ok(r.ok && r.data.games.length === 0);
    const here = { ...emptyBackup(), games: [sanitizeGame(game())!] }, from = { ...emptyBackup(), games: [sanitizeGame(game({ id: 'g_other123', played: T + 9 }))!, sanitizeGame(game())!] };
    eq(mergeBackup(here, from).games.map((g) => g.id), ['g_other123', 'g_abcd1234']);
  });
});

describe('backups', () => {
  const data = (): BackupData => ({ settings: { resultCount: 15 }, themes: [], plans: [sanitizePlan(plan())!], parties: [sanitizeParty(party())!], plays: [sanitizeMyPlay(myPlay())!], games: [sanitizeGame(game())!] });
  spec('a backup reads back whole', () => {
    const text = backupText(data(), 'test', new Date(T));
    const r = readBackup(text);
    ok(r.ok);
    if (!r.ok) return;
    eq(r.data, data());
    eq(r.saved, new Date(T).toISOString());
    const raw = JSON.parse(text);
    eq([raw.kind, raw.format, raw.app], [BACKUP_KIND, BACKUP_FORMAT, 'test']);
    eq(countsOf(r.data), { plans: 1, parties: 1, plays: 1, themes: 0, games: 1 });
  });
  spec('files that aren’t backups are refused, and damaged parts of one are dropped', () => {
    ok(!readBackup('{nope').ok);
    ok(!readBackup('{"kind":"something-else"}').ok);
    ok(!readBackup(JSON.stringify({ kind: BACKUP_KIND, format: BACKUP_FORMAT + 1 })).ok, 'from a newer layout');
    const r = readBackup(JSON.stringify({ kind: BACKUP_KIND, format: 1, settings: { resultCount: 'lots', sound: false }, plans: [plan(), plan(), { id: 'x' }, 7], parties: 'none', themes: [{}] }));
    ok(r.ok);
    if (!r.ok) return;
    eq(r.data.settings, { sound: false });
    eq(r.data.plans.length, 1, 'the copy and the damaged ones are dropped');
    eq([r.data.parties, r.data.themes, r.data.plays], [[], [], []], 'parts it doesn’t have are empty');
  });
  spec('a part of a backup the app no longer keeps is left out quietly', () => {
    const r = readBackup(JSON.stringify({ ...JSON.parse(backupText(data(), 'test', new Date(T))), notes: [{ id: 'x', note: 'Kept elsewhere' }] }));
    ok(r.ok);
    if (r.ok) eq(r.data, data());
  });
  spec('merging keeps the newer copy of each plan and the settings here', () => {
    const here = data();
    const from = data();
    from.plans = [{ ...from.plans[0]!, name: 'Newer', updated: T + 1 }, { ...from.plans[0]!, id: 'p_other999', name: 'Other' }];
    from.settings = { resultCount: 5, sound: false };
    const m = mergeBackup(here, from);
    eq(m.plans.map((p) => p.name), ['Newer', 'Other']);
    eq(m.settings, { resultCount: 15, sound: false });
    eq(mergeBackup(emptyBackup(), emptyBackup()), emptyBackup());
  });
});

describe('settings', () => {
  spec('every setting has a default that passes its own check', () => {
    const d = defaultSettings();
    for (const k of SETTING_KEYS) {
      eq(sanitizeSetting(k, d[k]), d[k], k);
      ok(SETTINGS[k].label, `${k} has a label`);
    }
    eq(resolveSettings({}), d);
  });
  spec('values of the wrong kind are refused, and numbers kept in range', () => {
    eq(sanitizeSetting('resultCount', 1000), SETTINGS.resultCount.max);
    eq(sanitizeSetting('resultCount', '12'), undefined);
    eq(sanitizeSetting('defaultRank', 'gold 3'), undefined);
    eq(sanitizeSetting('defaultRank', 'radiant'), 'radiant');
    eq(sanitizeSettings({ resultCount: 12, sound: 'on', nothing: 1 }), { resultCount: 12 });
  });
  spec('how you play: a party size the Planner has, and up to five agents you play, each once', () => {
    eq(sanitizeSetting('usualParty', '1'), '1');
    eq(sanitizeSetting('usualParty', '4'), undefined);
    eq(sanitizeSetting('myAgents', ['jett', 'jett', 'nobody', 'omen', 7]), ['jett', 'omen']);
    eq(sanitizeSetting('myAgents', ['jett', 'omen', 'sova', 'sage', 'raze', 'neon']), ['jett', 'omen', 'sova', 'sage', 'raze']);
    eq(sanitizeSetting('myAgents', 'jett'), undefined);
    eq(youOf(resolveSettings({ defaultRank: 'diamond', usualParty: '2', myAgents: ['omen'] })), { rank: 'diamond', party: 2, agents: ['omen'], comfort: {} });
  });
  spec('how well you play your agents: learning or a main for known agents, and a question takes only the agents you play', () => {
    eq(sanitizeSetting('myComfort', { jett: 'main', omen: 'learning', sova: 'ok', nobody: 'main', sage: 7 }), { jett: 'main', omen: 'learning' });
    eq(sanitizeSetting('myComfort', 'jett'), undefined);
    const you = youOf(resolveSettings({ myAgents: ['jett', 'sova'], myComfort: { jett: 'main', omen: 'learning' } }));
    eq(startingQuery(you, true).comfort, { jett: 'main' });
    eq(sanitizeQuery({ ...newQuery(), comfort: { raze: 'learning', x: 'main', jett: 'great' } }).comfort, { raze: 'learning' });
    eq(sanitizeQuery({}).comfort, {});
  });
});

describe('theme codes', () => {
  spec('a theme code brings back the same theme, and other text isn’t taken for one', () => {
    for (const t of BUILT_IN_THEMES) {
      const code = themeCode({ ...t, name: `${t.name} | mine` });
      ok(code.startsWith(THEME_CODE_PREFIX), code);
      eq(parseThemeCode(`  “${code}” `), { ...t, id: '', name: `${t.name} | mine` }, t.id);
    }
    eq([parseThemeCode(''), parseThemeCode('hello'), parseThemeCode(`${THEME_CODE_PREFIX}!!!`)], [null, null, null]);
  });
});

describe('text', () => {
  spec('names are tidied, compared loosely and listed in plain English', () => {
    eq(clean('  Haven  attack​ '), 'Haven attack');
    eq(fold('KAY/O’s'), fold("kay/o's"));
    eq([listJoin([]), listJoin(['Omen']), listJoin(['Omen', 'Sova']), listJoin(['Omen', 'Sova', 'Jett'])], ['', 'Omen', 'Omen and Sova', 'Omen, Sova and Jett']);
  });
  spec('a name is found in a line as written, even with a slash, a dot or brackets in it', () => {
    const finds = (name: string, line: string) => new RegExp(`(?<![\\w/])${escapeRegExp(name)}(?![\\w/])`).test(line);
    eq([finds('KAY/O', 'Let KAY/O stun it.'), finds('A (Heaven)', 'Hold A (Heaven).'), finds('A.B', 'Watch AxB.'), finds('C+', 'Go C.')], [true, true, false, false]);
  });
});

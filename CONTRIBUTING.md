# Building Playbook

How Playbook is built and tested, for anyone who wants to read the code or build the app themselves. To use Playbook you don't need any of it. Download the HTML file from the [latest release](https://github.com/unbrokensovereignty/playbook/releases/latest) and open it.

Playbook isn't open to outside changes, so pull requests aren't accepted. Bug reports and ideas are welcome as [issues](https://github.com/unbrokensovereignty/playbook/issues/new/choose). The code is shared to read and to build for your own use, as [LICENSE](LICENSE) explains.

`docs/ARCHITECTURE.md` explains how the code fits together, and `docs/PRODUCT.md` how the app should look, read and answer. The rules below are the ones that are easy to break.

## Rules that are easy to break

- The code has three layers. `src/core` is pure logic, with no DOM, storage or Preact in it. `src/data` may use core, and `src/ui` may use both. `npm run lint` enforces this.
- Each rule lives in one file, listed under [Where things are](#where-things-are). Every number the engine weighs is in `core/engine/weights.ts`, and facts about the game live in `core/kb/`. Screens use these files instead of working anything out again.
- Reasons come from the score. Pros, cons and notes are read off the same numbers the score uses, so they always agree with the ranking. A new reason goes in `explain.ts`, backed by a number there.
- Numbers on screen come from constants. If a sentence quotes a rule ("S from 95", "the middle team is 50"), build it from the constant (`TIERS`, `FIT_MID` and the rest, as `ui/pages/help.tsx` does) so the words can't drift from the code.
- The app only knows its own versions. Code, docs, tests and in-app text mention only versions that have a heading in `CHANGELOG.md` (or the one in `package.json`), and never words that hint at test builds or earlier editions. 0.5.5 is the first public version, and nothing may refer to anything before it. `npm run lint` checks this. (Game patch numbers like 13.08 have two parts, so they're fine.)
- Anything read back is sanitized. Stored records, backups and saved questions pass through the sanitizers in `core/saved.ts`, `core/backup.ts` and `core/engine/query.ts`. A new field needs a default in its sanitizer, and then old data just works, with no migration.
- A new agent's numbers are estimates, kept apart. An agent revealed but too new for real numbers (none right now) lives in `core/kb/new-agents.ts` with `estimate: true`, and the app says so wherever it shows them. The steps to update one are at the top of that file. An agent released after the last pro event (Hush, for now) is a full agent, but pro play counts neither for nor against them (`proKnown` in `core/kb/pro.ts`).
- Specs run in the browser too. `tests/specs/` is bundled into the app's hidden self-test page (`#/selftest`), so specs can't import Node modules.
- Tours point at hooks. The guided tours (`ui/tours/list.ts`) light up `data-tour` hooks in the screens, never styling classes. Keep a hook on its thing when you move or restyle it. `tests/unit/tours.test.ts` and `tests/e2e/tours.spec.ts` fail when a hook goes missing or a card covers what it points at.
- Every change should work in light and dark themes, with the keyboard, at every text size, and with motion set to Reduced or Off.
- The scenario tests are the engine's referee. After any change to `weights.ts`, `model.ts`, agent numbers or map needs, `npm test` must still pass `tests/unit/scenarios.test.ts` (a sound mix of roles everywhere, comps close to what pros play at Immortal and Radiant, each map's signature agents, easy agents who work alone at Iron, best comps that vary by map, new agents that don't take over, best comps that change a little at a time between ranks), `tests/unit/benchmarks.test.ts` (how close the best comps come to pro comps, low-rank tiers against ranked play, and every reason a comp gives being true) and `tests/unit/questions.test.ts` (hundreds of random questions keep their rules).

## Setup

You need Node 22 or newer and git.

```sh
git clone https://github.com/unbrokensovereignty/playbook.git
cd playbook
npm ci
npm run check                        # should pass on a fresh clone
npx playwright install chromium      # once, for the browser tests (skip if Chromium is preinstalled)
```

If Chromium is already installed somewhere else (a cloud container often has one), point the browser tests at it instead: `PW_CHROMIUM=/path/to/chromium npx playwright test`.

## The everyday loop

1. Branch off `main`.
2. Change the code under `src/` (and the tests next to it).
3. `npm run build` and open `dist/Playbook-v<version>.html` in a browser. `npm run dev` makes a readable build with source maps for debugging. Look at the change in a light and a dark theme.
4. `npm run check` (typecheck, project lint, unit tests and specs, build). Add `npm run test:tz` if you touched dates, and `npx playwright test` if you touched screens.
5. Add a line to `CHANGELOG.md` under the version in progress if people will notice the change.
6. Commit. CI (`.github/workflows/check.yml`) runs the same checks plus the browser tests in Chromium, Firefox and WebKit.

Files opened from disk can share saved data with the real app in the same browser. To keep test data apart, build with `node tools/build.mjs --preview --out <file>`, which saves under a separate database name.

## Where things are

| You want to change… | Look in |
| --- | --- |
| How much anything counts in a team's score | `src/core/engine/weights.ts` (every number, each with a comment) |
| What a situation needs, an agent's own fit at a rank, each map's pro role mix | `src/core/engine/model.ts` |
| How teams are scored and searched | `src/core/engine/search.ts` |
| Duos and trios, and how random teammates pick | `src/core/engine/party.ts`, `FILL_*` in `weights.ts` |
| Fits, tiers and the answer to a question | `src/core/engine/plan.ts` |
| What can be asked, and how a bad question is repaired | `src/core/engine/query.ts` |
| Pros, cons and notes, how a comp wins, why one ranks below another | `src/core/engine/explain.ts` (words for each strength in `DIM_INFO`, `src/core/kb/roles.ts`) |
| How a kit plays on a map, side or site | `src/core/kb/kitfit.ts` |
| What the other team's agents make you play around | `src/core/kb/counters.ts`, `threatsOf` in `src/core/engine/model.ts` |
| Who does what in a play, and a play's fit | `src/core/engine/plays.ts` |
| How many smokes or flashes a step asks of a player, and what they have | `src/core/engine/uses.ts`, `src/core/kb/charges.ts` |
| Which of an agent's abilities a sentence names for a strength | `src/core/kb/effects.ts` |
| Which tips a plan gets | `src/core/engine/tips.ts`; the tips themselves in `src/core/kb/tips.ts` |
| The text Copy makes | `src/core/engine/summary.ts` |
| An agent's numbers and strengths | `src/core/kb/agents.ts`; a new agent's in `src/core/kb/new-agents.ts` |
| A map's needs, sites, pool, patch | `src/core/kb/maps.ts` |
| Pro picks and comps per map | `src/core/kb/pro.ts` |
| Pairs that help or clash | `src/core/kb/synergy.ts` |
| Plays | `src/core/kb/plays.ts`; a map's plays page is `src/ui/pages/mapplays.tsx` |
| Abilities, agent colors, callouts, art | `src/core/kb/content.gen.ts` and `assets/`, both made by `npm run art` (below) |
| A callout in the wrong spot on a minimap | `places` for its map in `src/core/kb/maps.ts` |
| Where routes can go on a minimap | `src/core/kb/floor.gen.ts`, read from the minimaps by `node tools/floor.mjs` (`npm run art` runs it too) |
| Saved plans, parties, your plays and your games | `src/core/saved.ts` (records and sanitizers), `src/data/repo.ts` (changes), `src/ui/pages/saved.tsx`, `src/ui/pages/drawplay.tsx` |
| Backups | `src/core/backup.ts`, `src/ui/backup.tsx` |
| Settings | `src/core/settings.ts` (the schema), `src/ui/pages/settings.tsx` (drawn from it) |
| Themes | `src/core/theme.ts` (generation, built-ins, theme codes), `src/ui/theme.ts` (applying, switching), `src/ui/pages/themes.tsx` |
| The Planner's screen | `src/ui/pages/planner.tsx`, `src/ui/planner/` (question, answers, comp, plays, store) |
| Pages that show many situations (Rankings by map, best maps, best comps) | `src/ui/solved.ts` |
| Saving, undo, tabs | `src/data/db.ts`, `src/data/backends.ts`, `src/data/tabs.ts`, `src/data/repo.ts`, `src/ui/undo.ts` |
| The frame, sidebar, search, shortcuts | `src/ui/shell.tsx`, `src/ui/components/palette.tsx` |
| Shared buttons, fields, dialogs, toasts | `src/ui/components/controls.tsx`, `src/ui/components/overlays.tsx` |
| Agent and map pickers, the minimap | `src/ui/components/pickers.tsx`, `src/ui/components/minimap.tsx` |
| Styles | `src/ui/styles/` (base tokens in `base.css`, one file per area) |
| Sounds | `src/ui/sound.ts` |
| Icons | `src/ui/icons.tsx`; the game's art through `src/ui/art.tsx` |
| The in-app guide and About | `src/ui/pages/help.tsx` |
| What's new in a version | `src/core/whatsnew.ts` |
| The guided tours | `src/ui/tours/` (`list.ts` the steps, `engine.tsx` the spotlight and keys, `place.ts` where the card goes) |

## Recipes

### Tune the engine

Change the numbers in `src/core/engine/weights.ts` (or a map's needs, or an agent's strengths), then run `npm test`. The scenario checks in `tests/unit/scenarios.test.ts` say if the answers still make sense across every map, side and rank, and `tests/unit/questions.test.ts` asks hundreds of random questions. If a check fails, look at what changed before loosening it. The checks stand for what players and pros would call a sensible answer. Then look at the Planner and Rankings in the browser at a low and a high rank.

### Check the engine against real play

After a change to the engine or the numbers, `npm test` runs the held-out pro checks and the claims register (`tests/unit/validation.test.ts`), and its marks only go up. To add a claim, put it in `tests/validation/claims.ts` with two independent sources or more (add each source to `SOURCES` with its link and date) and a check, or a note saying why it can't be checked. When the engine changes a lot, run `node --experimental-strip-types tools/validate.mjs --sample`, grade the 180 answers as `docs/VALIDATION.md` says, and update its tables. Every grade of 3 or lower is looked into, and each one a change can lift without breaking a check elsewhere becomes a fix with a test.

### Update a new agent once they're out

Follow the steps at the top of `src/core/kb/new-agents.ts`. Change the numbers (what each means is at the top of `agents.ts`, with the sources), take out `estimate: true` and move the entry into `agents.ts`. Refresh the game's content (below) so the abilities and portrait come from the game. Add pairs to `synergy.ts`, and pro picks to `pro.ts` once pros play them. Until `PRO_CUTOFF` in `pro.ts` is moved past their release, pro play counts neither for nor against them. Then run `npm run check` and add a line to `CHANGELOG.md`.

### Refresh the game's content and art

On a computer that can reach valorant-api.com (a free community copy of the game's content, no key needed):

```sh
npm run fetch-art -- ~/playbook-content   # downloads agents.json, maps.json and the images
npm run art -- ~/playbook-content         # → assets/ and src/core/kb/content.gen.ts
```

`fetch-art` lists anything the API doesn't have yet (a new agent's art, say), and the app shows the agent's initial until it's there. `art` resizes the images to WebP in `assets/` and writes every agent's abilities and every map's callouts into `content.gen.ts`. If the game files a new agent's ability under a different slot from the key players press, add it to `KEY_FIXES` in `tools/prepare-art.mjs` (the specs check that every agent has an ability on each key). Then `node --experimental-strip-types tools/patch.mjs` lists what changed since the last release as a checklist. It compares with `origin/main` unless you give it another commit. It shows every ability whose name or text changed, word by word, with the strengths in `agents.ts` that cite its key, its kit rules in `kitfit.ts` and the lines that name it, so each can be checked against what the ability does now. It also lists every callout that came, went or moved. Plays and tips name callouts, and a renamed one fails the specs until it's updated there. The game's content doesn't say how many charges an ability has, so read the patch notes for charge changes and update `src/core/kb/charges.ts` with the date you checked. `tests/unit/charges.test.ts` then checks every play against the new numbers. When an ability's text changes, `tests/unit/abilities.test.ts` fails if a strength in `agents.ts` now cites an ability that doesn't do it. Fix the strength, or add what the ability does to `MORE` in `src/core/kb/effects.ts` with where it's from. `art` also reads where you can walk on each minimap into `floor.gen.ts`. A new minimap can leave a callout in a wall, which the specs report, and `places` in `maps.ts` moves it. Look at the map's page with Show callouts on to check every name sits where players stand. Keep the build under its size budget (`SIZE_BUDGET` in `tools/build.mjs`).

### Add an agent

Give it an entry in `src/core/kb/agents.ts` (or `new-agents.ts` with `estimate: true` while it's new): id, name, role, release date, strengths as `dim value keys`, `solo`, `skill`, `pop` and `win` (its pro pick rate is worked out from `pro.ts`). Refresh the game's content for its abilities and art. Give it two tips in `src/core/kb/tips.ts`, any pairs in `synergy.ts`, and pro picks in `pro.ts` once pros play it. Plays need nothing new, since their jobs go to whoever in the comp is best at them. `npm run check` tells you if anything's missing.

### Change the map pool

Set `pool: true` or `false` on the maps in `src/core/kb/maps.ts`, and update `PATCH` and `POOL_SINCE` (with the date of the next change in the comment). Pick rates in `agents.ts` and `pro.ts` name the patch and events they came from, so update those comments when you update the numbers.

### Add a map

Add it to `DEFS` in `src/core/kb/maps.ts` with its sites, needs (as bumps over a side's usual needs), and `aka` for callouts players call something else. Refresh the game's content for its minimap, banner, callouts and floor, and move any callout the game places badly with `places`. Add its plays to `src/core/kb/plays.ts` (both sides, every site), its tips to `tips.ts` and its pro picks to `pro.ts` (the engine reads the map's pro role mix from them). The specs check each of these.

### Move callouts and marks by hand

`npm run map-editor` builds `dist/Playbook-map-editor-v<version>.html`, a page apart from the app that opens from disk with every map's callouts and marks (orbs, doors, teleporters and the rest) as the app has them now. Drag them where they belong (the Floor box shows where the specs count as floor), turn a mark that lies at a slant (its `angle`), add or remove them, and choose Save edits file. Then `npm run map-edits -- <edits.json>` puts the file into the data: moved callouts into `places` in `maps.ts` and each edited map's marks into `features.ts`. Renamed, new and removed callouts are listed for a hand to make, since plays, tips and the game's content use the names. Run `npm run check` afterwards, and build the editor again after the callouts or marks change so it starts from them.

### Add or change a play

Plays are in `src/core/kb/plays.ts`, written as `jobs[@moment]: route | what to do [| callouts]`, five jobs a play (one per player), over the map's own callouts. The comment at the top of the file explains the format. The moment and where the utility lands are worked out from the jobs and the sentence, and written only when those would be wrong. A typo in a job or callout throws, so `npm test` catches it. Look at the play on the map's plays page in both themes. Run its replay and check each smoke, wall and flash lands where the sentence says. A new map's defense setups for each site come from `siteSetups`, one line of callouts per site.

### Add a kit rule

When a kit does more or less on a map, side or site than its strengths in `agents.ts` say, add a rule to `KIT_RULES` in `src/core/kb/kitfit.ts`: the agent, where it applies, the change (`disrupt +.15; clear -.1`, a few hundredths to two tenths) and why in one sentence a coach would say, which shows as a pro or a con. Where the place changes how well the agent works alone, `solo` says by how much (Phoenix on open maps), and where it changes how hard the kit is to play well, `skill` does (Viper on Breeze, where one long wall is most of her job). A rule that takes something away needs `around` too, the sentence that tells players how to play around it. Add a claim to `tests/unit/gamesense.test.ts` that the fits follow it.

### Add a pair

Add a `P(a, b, strength, side, reason)` line to `src/core/kb/synergy.ts`. The strength runs from −3 (they clash) to 3 (a classic combo), and the reason is one plain sentence, shown as a pro or a con. Use `F` instead of `P` when the combo is a flash that has to pop just as the other agent swings. Teams at the low ranks rarely time those, so they count as far as a team plays its utility together, the way a second controller does.

### Add a reason (pro, con or note)

Add it to `explainTeam` in `src/core/engine/explain.ts`, backed by the numbers the score uses, and a spec in `tests/specs/engine.spec.ts` that it shows when it should and not otherwise.

### Add a setting

Add an entry to `SETTINGS` in `src/core/settings.ts` with its section, type, default and label. The Settings page and the command palette pick it up automatically. Read it through `useSettings()` in a screen. Saved settings are sanitized against the schema, so an existing profile gets the default.

### Add a field to saved data

Add it to the type in `src/core/saved.ts` (or to `Query` in `src/core/engine/query.ts` for something a question holds) and give it a default in that record's sanitizer. Records saved before the change then read back with the default, so no migration is needed. Add a spec in `tests/specs/` that a record without the field still loads.

### Add a page

Add its name to `Page` and `PAGES` in `src/ui/state.ts`, write the component in `src/ui/pages/`, register it in `PAGE_VIEWS` (`src/ui/pages/index.ts`), add it to the sidebar and the command list in `src/ui/shell.tsx` if it belongs there, and add it to `PAGES` in `tests/e2e/pages.spec.ts` so the layout sweep and the accessibility check cover it.

### Make a change undoable

Change saved data only through a method on `Repo` (`src/data/repo.ts`) that runs one transaction with a label in plain words ("Delete “Haven default”"). That label is what Undo and Redo name. Show its message with `toast(text, { undo: true })` to give the message an Undo button for that change.

### Add or change a tour

Tours are in `src/ui/tours/list.ts`. A step names the page to be on (or stays on the one before), a `data-tour` hook to light up, a title and a line or two of text, and the side the card should go. Put the hook on the thing itself in the screen (`data-tour="…"`, or the `tour` prop on `Button`, `Tabs` and the Planner's question parts), on something small enough to leave room for the card. Build any number a step quotes from the engine's constants, as `fitWords()` does. If a step points at something a screen hides by default (a closed comp, another tab), have the screen show it while the step is on, by reading `tourHook` from `src/ui/tours/now.ts`, without saving anything. `tests/unit/tours.test.ts` checks the hooks and pages, and `tests/e2e/tours.spec.ts` runs every tour from the keyboard and fails if a step's card covers what it points at.

### Add a sound

Add its name and group to `SOUNDS` in `src/ui/sound.ts` and a case built from the helpers there. Keep it short and quiet. It follows the volume sliders and every sound set.

### Add an icon

Add it to `ICONS` in `src/ui/icons.tsx`, drawn on the 24 px grid with the same stroke. Use it through `<Icon name="…" />`.

### Add a theme color (token)

Add it to the tokens in `generateTheme()` in `src/core/theme.ts`, derived from the picks (and checked for contrast if text sits on it). It then exists as `var(--name)` in every theme.

## Tests

| Where | What | Run with |
| --- | --- | --- |
| `tests/specs/` | Behaviour specs for the engine, the knowledge base, plays and tips, saved records, backups, settings and data. They also run in the browser on the hidden `#/selftest` page, so no Node imports. List new files in `tests/specs/index.ts`. | `npm test` |
| `tests/unit/` | The scenario checks (the engine's answers against pro play, ranked play and common sense), the benchmarks (how close the best comps come to pro comps, low-rank tiers against ranked play, and that every reason a comp gives is true), the random-question check, and the tour checks. Node only. | `npm test` |
| `tests/e2e/` | Playwright on the built file for the version in `package.json`, in Chromium light and dark (`E2E_BROWSERS=others` runs Firefox and WebKit instead, `all` runs every browser; CI runs both). Every test fails on a console error. `pages.spec.ts` sweeps every page for cut-off text and runs an automated accessibility check (axe); helpers are in `app.ts` (`open`, `go`, `saved`). | `npm run build && npx playwright test` |
| `tools/test-timezones.mjs` | `npm test` in ten tricky time zones. | `npm run test:tz` |

Write a test for every bug fixed and every rule added. Prefer a spec (fast, runs everywhere) and add an e2e test when the bug is about the screen.

## Project lint

`npm run lint` (`tools/lint.mjs`) checks what TypeScript can't: layer imports, file extensions on relative imports, no `console.log`, `debugger` or `.only`, version mentions, and wording (the hype words, stock phrases and long dashes that `docs/PRODUCT.md` asks writers to leave out, in the app's text, the docs and the comments). A version number anywhere in `src/`, `tests/`, `tools/`, `docs/` or the top-level docs must be the one in `package.json` or have a heading in `CHANGELOG.md`.

## Code style

- TypeScript strict, ES modules, relative imports with their extension (`./x.ts`).
- Small pure functions in `core`, with a comment above anything that encodes a rule, saying why.
- Knowledge-base files say where their facts came from at the top. Keep that up to date when you change the facts.
- Comments and in-app text in plain English, with typographic quotes (’ “ ”) in shown text.
- Match the surrounding code: its comment density, naming and one-line style for small helpers.
- No new runtime dependencies without a good reason. The file must stay offline and under the size budget in `tools/build.mjs`.

## Releasing

1. The version's `CHANGELOG.md` entry is complete and dated (drop "in progress"). The app names no version but its own, so `src/core/whatsnew.ts` stays empty unless this version has notes of its own.
2. `npm run check && npm run test:tz && npx playwright test` all pass.
3. `npm run build`. Replace the app file in the repository root with the new one from `dist/` (`git rm` the old file so the root holds exactly one), and update the file name in `README.md`.
4. Open the root file in a browser, run the self-test from Help → About, and click through Home, the Planner (a five-stack and a duo), Rankings, an agent, a map, Saved and Settings in both themes.
5. Commit to `main`, then publish a GitHub release tagged `v<version>` with the app file attached and the version's `CHANGELOG.md` entry as its notes.
6. Bump `package.json` for the next version (`npm version <x.y.z> --no-git-tag-version`) and add its "in progress" heading to `CHANGELOG.md`.

Versions go major.minor.patch: big changes, new features, fixes.

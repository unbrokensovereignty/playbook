# How Playbook is built

Playbook is a TypeScript and Preact app that `tools/build.mjs` bundles with esbuild into one HTML file. Scripts, styles, fonts, icons and the game's art are all inlined, so the file opens straight from disk with no server and no network.

## Layers

The code is in three layers, and `npm run lint` enforces the direction they depend on:

| Folder | What it holds | May use |
| --- | --- | --- |
| `src/core/` | Pure logic: the knowledge base about the game (`kb/`), the engine that scores teams (`engine/`), settings, saved records and their sanitizers, backups, themes. No DOM, no storage. | nothing else |
| `src/data/` | Saving: tables, transactions with undo, IndexedDB with fallbacks, one writing tab at a time, and the typed repository every screen goes through. | core |
| `src/ui/` | Screens, components, sound, themes and styles. | core and data |

Because `core` is plain data in and plain data out, the unit tests and the scenario checks run the engine directly in Node.

## The knowledge base (`src/core/kb/`)

Everything the app knows about the game, as data with a comment at the top of each file saying where it came from and how it's written:

- `agents.ts`: every agent's role, strengths (`caps`, from 0 to 1 per strength, with the abilities behind each), how well they work alone (`solo`), how hard they are (`skill`), ranked pick rate (`pop`) and pro pick rate (`pro`). `new-agents.ts` holds agents revealed but too new for real numbers (none right now), marked `estimate`, with the steps to update them.
- `roles.ts`: the four roles and the fifteen strengths ("dims") everything is measured by: smokes, walls, flashes, information, entry, clearing, crowd control, delay, site hold, flank watch, retake, post-plant, healing, firepower and speed. Each has its name and its words for pros and cons in `DIM_INFO`.
- `maps.ts`: the maps, the competitive pool, sites, and what each map, side and site needs on top of a side's usual needs (`wall +.5`), how open or tight each map and site is (`space`) and what its doors, teleporters, ropes, ziplines and breakable walls do (`mechanics`, each with a `weight` for how much the map leans on it, which scales the kit rules that count it). How many of each role pro teams run on a map comes from its pro picks (`proRoleMix` in `pro.ts`).
- `kitfit.ts`: kit rules, the part of an agent's strengths that depends on where they are: Hush's Telekinesis on maps with doors, Displacement in tight spaces, Brimstone's smokes on open maps. Each rule names the agent, where it applies (a map, a site, a mechanic or a space, and a side), the change and why in one sentence, which a comp's pros or cons say when the rule matters to its score. A rule can also change how well the agent works alone there (`solo`), which the low ranks reward: Phoenix wins his own fights at close range, and an open map has few of them. It can change how hard the kit is to play well there too (`skill`): on Breeze, Viper's main job is one long wall, and even a rough one does it. A rule that takes something away also says how to play around it, and the con adds that sentence.
- `counters.ts`: what the other team's agents make you play around (an Operator Chamber, a Killjoy and Cypher setup, a fast Raze and Neon hit), the strengths of yours that answer each threat, and how to play around it without them.
- `ranks.ts`: the nine ranks, each placed between Iron (0) and Radiant (1).
- `pro.ts`: what pro teams pick on each map, and typical pro comps. `PRO_CUTOFF` is when the last of those events began. An agent released after it (Hush, for now) isn't pulled either way by pro play, since pros haven't had the chance to pick them (`proKnown`). Icebox wasn't played at this year's events, so its numbers come from Masters Toronto 2025 (`TORONTO_2025`), and agents released since then count neither for nor against there (`until`).
- `ranked.ts`: ranked play rank by rank, from Blitz's numbers for August 2026: the twenty agents picked most at each rank, which say who random teammates lock in, and each agent's share of picks and of games won at Radiant itself. Agents released since then keep their numbers across all ranks.
- `mapwins.ts`: ranked play on each map (agents' win rates and games there, and the rounds each side wins), from metabot.gg. The model counts an agent's rate on a map only as far as it differs from their rate across the maps by more than chance (`MAP_WIN`).
- `features.ts`: where the ultimate orbs, doors, breakable and droppable walls, teleporters, ziplines, ropes and silent drops are on each minimap, for the map page's layers, placed from both VALORANT wikis' interactive maps and checked by eye against the minimap. Each site also has two plant spots inside the area the minimap tints for planting: the default plant in the middle, and the safe plant just inside the way most plays come on (`plantSpots`).
- `synergy.ts`: pairs that work well together or clash, from −3 to 3, with the reason in words, for a clash what to do about it, and whether the combo is a flash timed for the other agent's entry.
- `plays.ts`: plays for every map (hits, splits, fakes, defaults, setups and retakes, and on defense a stack, an early push and a retake setup for every site, from `siteSetups`), and a pistol-round, an eco and an anti-eco play for each side, written as jobs and routes over the game's own callouts, so any comp can run them. `BUY_GUIDE` says what to buy in each kind of round. Each step has a moment (`MOMENTS`: before the hit, on it, after the plant), worked out from its jobs and words (`whenOf`) unless it's written, and the callouts where its utility lands (`landsOf`), read from its sentence unless they're written. A typo in a job or callout throws, so a bad edit fails the tests.
- `tips.ts`: short advice for each agent, map side, rank, party size and doubled-up role.
- `charges.ts`: how many times each agent can use each ability in a round, from the game's numbers, dated. Update it when a patch changes a charge.
- `effects.ts`: what each ability does (smokes, walls, flashes, slows, reveals, heals and the rest), read from the game's text for it, plus a few things the text leaves out, each with its source. Reasons, plans, tips and plays name an ability for a strength only when it does that strength, best first (`namedFor`): Sage slows a push with Slow Orb before Barrier Orb. A way out after an Operator shot (Jett's Tailwind) and a heal of the agent's own (Reyna's Devour) are said as what they are. Some strengths are plain facts of a kit (`PLAIN`: smokes, flashes, information, crowd control, healing and speed), so a con that says who brings one names every ability on the team that does it, and the agent's numbers in `agents.ts` give each of them at least a little of it.
- `content.gen.ts`: the game's own ability text, agent colors and map callouts, made by `npm run art` (see `CONTRIBUTING.md`). Don't edit it by hand. `kits.ts` reads it, falling back to a new agent's revealed kit in `new-agents.ts`. The game places some callouts badly (in a wall, or on the edge of a site), so `places` in `maps.ts` moves them, each checked by hand against the minimap.
- `floor.gen.ts` and `floor.ts`: where you can walk on each minimap, read from the minimap images by `tools/floor.mjs`, and `walk()`, the way along the floor from one spot to another, so a play's route goes round walls instead of through them. The specs check that every callout stands on the floor and every route keeps to it.

## The engine (`src/core/engine/`)

A question becomes one or more situations, each situation becomes a model, and the model scores every team the question allows.

### 1. The question (`query.ts`)

A question holds the map, side and sites, the rank and the party size (solo, duo, trio or five-stack). It can also name must-play and won't-play agents, teammates already locked in, role counts, each player's agent pool (a saved party's, or the agents you play) and the other team's agents as far as they're known, and say whether to include new agents. Each of map, side and rank can be given, left open ("Any map", "Both sides") or asked for ("Find the best map"), so any input can also be an output. `sanitizeQuery` repairs anything that can't work (too many agents for the party, role counts that don't add up) and `situationsOf` lists the situations a question covers.

### 2. The model (`model.ts`)

For one situation, the model works out how much each strength matters (the side's usual needs in `weights.ts`, plus the map's and sites' bumps, plus what the other team makes you play around, scaled by rank), each agent's strengths there (with the kit rules that apply), each agent's own fit (a pull toward pro picks that grows with rank, and at low ranks a reward for agents who work alone and a cost for hard ones), each pair's synergy, and what each role count costs. For a solo player, a duo or a trio, whatever rests on teamwork counts as it would for a five-stack lower down (`PARTY_TEAM`), role counts follow what ranked teams win with (`RANKED_ROLE`), and from Ascendant up what players at Radiant pick and win with pulls the way pro play does (`RANKED_PULL`, `RADIANT_WIN`), each as far as the team is random (`PARTY_RANDOM`). A second controller pays off only for a team that plays its smokes together, so below `SECOND_CONTROLLER.until` it costs a comp, two controllers' synergy and a flash timed for a teammate's entry count as far as teams play together, and the map's pro role mix leans toward one controller (`mixAt`). A duo or trio that plays both controllers itself smokes together as well as a five-stack at its rank, so it pays what that five-stack would for the second (`Model.ownSecond`) and weighs the two as it would (`Model.together`), and random teammates rarely lock in a third (`FILL_TOO_MANY_CONTROLLERS`). "Any map" and "Both sides" average the situations they cover.

### 3. The search (`search.ts`)

A team's score is how well its strengths cover the needs (coverage is the chance at least one agent brings a strength, so a second smoker adds less than the first), plus its agents' own fits, its pairs and its role costs. `searchTeams` scores every team the rules allow, all 142,506 of them when nothing is fixed, building each team one agent at a time so no work repeats.

### 4. Parties (`party.ts`)

For a solo player, a duo or a trio, `party.ts` finds the picks that keep the team strong whatever random teammates lock in. Each party gets its expected score over every way the rest could fill, each fill weighted by how likely players at your rank are to pick it (their pick rates at that rank in `ranked.ts`, and a missing role usually filled). An agent's fit for a smaller party is spread out less than a five-stack's (`stretchFor`), since the party picks only its own agents. A row shows the party with the best agents for the random teammates to play around it, and keeps the team they'd most likely pick and other good picks.

### 5. Fits and tiers (`plan.ts`)

`solve` answers a question for one situation: the best comps or party picks, and how every agent ranks. Scores become fits against every possible team for the same situation (`referenceFor`). The best team is 100 and the middle one is 50, so a fit means the same on every map. An agent's fit comes from the best team it fits into, spread out by `AGENT_STRETCH`. `tierOf` turns a fit into S to D by the whole number shown. For a five-stack, each agent also gets an `edge`: what they add to their best comp over the best other agent of their role in their place, which orders agents with the same fit. `teamFit` gives a saved team the same fit the answers gave it.

### How sure (`sure.ts`)

Some parts of an agent's fit rest on very little: ranked numbers from their first days, kit rules no play has checked yet, and pro play for an agent who came out after the year's top events. `sure.ts` takes each as far as it could be off and adds them up as independent errors, in points of the fit. When that comes to `SURE.less` or more, the answer's `unsure` says so and why.

### 6. Reasons (`explain.ts`)

Pros, cons and notes are written in plain words and read off the same numbers as the score. They take in the strengths the team covers and lacks for the situation, its kit rules, its pairs, its role counts, its rank fit, how close it is to a pro comp, its thinnest spot, how it stands against the other team, and a line on how it wins. Each pro makes its own point. Once one names an ability, a later strength or pair that would name it again is left out, and the next one in line takes its place. `whyBelow` says why one comp ranks below another, part by part (an agent's best comp on the Planner's Agents tab, and Compare).

### Map picks (`mappick.ts`)

When a five-stack asks for its best map with something chosen, `mappick.ts` lists the maps to play and to ban (`MAP_PICK`). A map's reasons are the parts of the score (`belowParts`) where the team's best comp there comes closer to (for a map to play) or falls further short of (to ban) the map's best comp than it does on the average map, leaving out the parts that are the agents' own (win rates, how hard they are to play).

### 7. Plays and tips (`plays.ts`, `tips.ts`)

A play's jobs are shared out among the comp's agents in the way that makes the play fit best. Its fit is held below "fits well" when one job goes to someone weak at it, and below "works" when two do (`PLAY_FIT`, `WEAK_JOB`), so the sharing that gets the most done overall isn't always the one chosen. A job has a first way to be done and stand-ins that count for less (`JOB_SKILLS`): a smoke for a missing wall, a molly or a nade to slow a push, a sentinel's setup to guard the Spike. Each player's utility is drawn where it lands (`throwsOf`). What they throw comes from the strength they do the job with (a smoke, a wall, a flash, a stun in place of one, or information). Nobody is asked for more than their kit holds in a round. `kb/charges.ts` has each ability's charges, and `engine/uses.ts` reads how many smokes, flashes, stuns, clears or slows a step's sentence asks for. A player with fewer does that much less of the job, so the play goes to someone with enough when the comp has one. Otherwise only what they have is drawn, and their step names the places that go without ("Omen's Paranoia has one charge, so A Alley goes without a flash"). Steps are put in the order they happen, so the minimap can run them like a replay. A play on one site puts the Spike on one of its plant spots (`plantOf`): the safe plant on a fast hit that comes in by it, the default plant otherwise and in every retake. Pistol, eco and anti-eco plays are listed apart. The plays you drew (`core/saved.ts`, `asPlay`) are filled and ranked the same way (`more` in `playsFor`). Tips are picked for the map, side, team, rank and party.

### 8. Copy and Print (`summary.ts`)

Copy turns a plan into plain text: `chatText` is a few lines for a party chat (the comp with roles, how it wins, the play and two tips), and `summaryText` is the whole plan. Print draws the same parts as one sheet of paper (`ui/planner/sheet.tsx`), through `printSheet` in `ui/files.ts`, which makes the sheet the only thing on the paper and gives it the light theme's colors.

All of the engine's numbers are in `weights.ts`, each with a comment on what it does.

## Answering without freezing the page

The engine is fast, but some questions cover many situations. A duo asking for the best map, side and rank at once covers over a hundred. `ui/planner/store.ts` answers the Planner's question a situation at a time with a pause for the screen in between, so the page never freezes, and a newer question cancels an older one. `ui/solved.ts` does the same for pages that show many single situations at once (Rankings by map, an agent's best maps, a map's best comps). They're worked out one at a time after the page has drawn, newest asked first, and kept so going back is instant.

## Saving

There are three stores (`data/tables.ts`): `meta` (settings, themes, the app's own state), `plans` (saved plans) and `parties` (saved parties). `data/db.ts` runs every change as a transaction. The transaction updates the tables in memory, tells the screens what changed, records how to undo it, and queues the save in the background, retrying on failure, so a click never waits for storage. `data/repo.ts` is the typed way in. Screens read through its getters and change data only through its methods, each one undoable transaction with a label in plain words. `ui/undo.ts` is the one place screens undo from: Ctrl Z, the sidebar buttons, the command palette and a message's Undo button.

`data/backends.ts` stores the data in IndexedDB. If the browser won't allow that, it falls back to localStorage, and failing that to memory, with a banner in either case. `data/tabs.ts` lets only one tab write at a time, and other tabs follow its saves read-only and can ask to take over. `data/rescue.ts` covers closing mid-save by keeping a quick copy of unwritten changes in localStorage for the next tab to put back.

The plays you drew and the games you logged are kept in `meta`, a list each. Anything read back goes through a sanitizer first (`core/saved.ts` for plans, parties, your plays and your games, `core/engine/query.ts` for the question inside a plan, `core/settings.ts` for settings, `core/backup.ts` for backup files), so a damaged record or a hand-edited backup can't break the app. A stored record that can't be read at all is set aside, with a banner, and listed under Help → About.

## The screens (`src/ui/`)

- `shell.tsx`: the frame, sidebar (with the current question and Saved count), search (`components/palette.tsx`) and global keys.
- `pages/`: Home, Planner, Rankings, Agents, Maps (with each map's plays, `mapplays.tsx`, and drawing a play, `drawplay.tsx`), Saved (plans, parties, your plays and your games), Settings, Themes, Help, and two hidden pages: the gallery (`#/gallery`, every control in the current theme) and the self-test (`#/selftest`, which runs the specs in the browser).
- `planner/`: the question (`question.tsx`), the answers (`answers.tsx`), a comp with its pros, cons, plays and tips (`comp.tsx`, `plays.tsx`), two comps side by side (`compare.tsx`), the printed plan (`sheet.tsx`), and the question in words (`words.ts`).
- `setup.tsx`: the first launch's questions (your rank, how you queue, the agents you play), which the Planner, Rankings and Home start from. A fit that's less sure gets a dashed ring on its tier (`Fit` in `planner/comp.tsx`), the words where there's room, and its reason in the tooltip of what it's on.
- `components/`: shared controls and overlays, agent and map pickers, the minimap with callouts (its routes follow `core/kb/floor.ts`).
- `tours/`: the guided tours. `list.ts` holds every tour's steps, each pointing at a `data-tour` hook in a screen (never at a styling class), with its words built from the engine's constants. `engine.tsx` draws the spotlight and card, waits for each target to arrive and settle, and handles the keys. `place.ts` works out where the card goes, and `now.ts` is the tour on screen, which a screen can read to show what a step points at (the first comp opened, the Pros and cons tab) without saving anything. Tours remember only which ones you finished, in the app's `tips`.
- `art.tsx`: agent portraits, ability and role icons, map banners and minimaps from `assets/`, each falling back to plain text when an image is missing (a new agent's portrait, say).
- `theme.ts`, `sound.ts`, `styles/`: themes, synthesized sounds and styles (tokens in `styles/base.css`).

## Tests

```sh
npm run check    # type check, project rules, unit tests and specs, build
npm run test:tz  # the tests in ten time zones
npx playwright test   # browser tests, light and dark (build first)
```

- `tests/specs/` holds the behaviour specs for the engine, the knowledge base, plays, saved records and data. They also run inside the app, on the hidden self-test page.
- `tests/unit/scenarios.test.ts` checks the engine's answers as a whole against pro play, ranked play and common sense. `gamesense.test.ts` checks the ratings follow how each kit plays on each map and side, the way a coach would reason, and `counters.test.ts` checks the answers to a known team. `wording.test.ts` sweeps hundreds of comps for words that don't match the kit. `benchmarks.test.ts` measures how close the best comps come to what pros play, checks tiers at low ranks against ranked play, and checks that every reason a comp gives is true of it. `questions.test.ts` asks hundreds of random questions and checks every answer keeps the question's rules. These are Node only (too slow for the self-test). `tours.test.ts` checks that every hook and page a tour names exists, and where the card goes.
- `tests/unit/validation.test.ts` checks the engine against what pros played with each event held out in turn (`tests/validation/pro.ts`), against ranked play, and against the expert claims register (`tests/validation/claims.ts`: claims from coaches' and analysts' guides, two sources each). `tests/validation/sample.ts` draws 180 answers for the graded review, twenty at each rank, and `tools/validate.mjs` prints all of it. `docs/VALIDATION.md` has the results and what each mark means. Node only.
- `tests/e2e/` drives the built file in a real browser: the Planner, Rankings, Agents, Maps, Saved plans and parties, search, copy, backups, settings, themes, a layout sweep of every page (at three widths and with extra-large text), an automated accessibility check, and every guided tour run from the keyboard (each step lit, its card clear of it, in a small window too).

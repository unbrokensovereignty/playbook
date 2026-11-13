# What Playbook should be

The product intent behind the code: who it's for, what it should feel like, and the standing decisions Sovereign has made. Read it before changing how anything looks, reads or answers. `docs/ARCHITECTURE.md` covers how the code is built.

## Who it's for

VALORANT players, from Iron to Radiant, deciding what to play: a five-stack picking a comp for tonight's map, a duo or trio who want picks that hold up whatever random teammates lock in, or one player wondering which agents suit a map, a side or their rank. They open one file on a laptop or desktop, ask a question in a few clicks, and want an answer they can trust and act on in agent select: the comp, why it works, what it's missing, a play to run and a few tips.

## Standing decisions

Sovereign made these. Don't reverse one without asking.

- The app's name is just Playbook, in the app, the file name and the docs.
- The whole app is one offline file. Everything is inside the HTML file, from the code and fonts to the game's art and the sounds, which are synthesized. Nothing is ever fetched from the network. A file opened from disk can't fetch live match data, so the app never claims to be live. Its numbers come from the knowledge base, which says where each one came from, and each new version refreshes them.
- People's data stays in their browser. It's saved in IndexedDB, with localStorage or memory as fallbacks and a banner when the app falls back. Backups are JSON files people download, and nothing is sent anywhere.
- It's made for desktop browsers, with no phone layouts.
- Any input can be an output. A question can give or leave open any of its parts, from the map and side to locked-in teammates and role counts, and it can ask for the best map, side or rank instead.
- All 13 maps have plays, in and out of the pool, written over the game's own callouts.
- The game's art is used directly. Agent portraits, ability and role icons, map banners and minimaps come from the game's own content, under Riot Games' fan content policy (the notice is in `LICENSE` and Help → About). The app is free and isn't sold.
- New agents are shown honestly. An agent revealed but not out yet gets numbers estimated from the kit that was shown, kept in one file (`core/kb/new-agents.ts`) so they're easy to replace. The app says they're estimates wherever it shows them, and people can leave them out of a question or of every question (Settings → Planner, shown only while there's one). Once an agent is out, their numbers come from their first days in ranked and from their kit, the app says the pick rate is that early, and pro play counts neither for nor against them until pro teams have had the chance to pick them (Hush, out since 27 October 2026, for now).
- 0.5.5 is the first public version. The app and its docs never refer to anything before it. Saved data has its own format, with nothing imported from earlier.
- It's free to use, with all rights reserved. Anyone may download the app and use it for their own play, and the source is public to read. It isn't open source, though. Copying, changing, re-sharing and selling it need Sovereign's permission (`LICENSE`), and there's no legal machinery beyond that notice and Help → About.
- Every page has a guided tour. Help → Tours has a short tour for each page, and Home offers the three-step First steps once. A tour lights up one thing at a time on the real screens, goes at your pace (Space, ←, Esc) and changes nothing but which tours you've finished. Tours are part of every test-and-fix round, and the e2e tests run each one from the keyboard and check its card never covers what it points at.
- The credit reads "Directed by Sovereign" and appears only where credits belong: Help → About, `LICENSE` and the end of the README. Sovereign leads the project and decides what it does, but doesn't claim to have written the code, and nothing describes how the code was written.

## Answers people can trust

- A fit means the same everywhere. Fits run from 0 to 100 against every possible team for the same situation, where the best is 100 and the middle one is 50. Tiers go by the fit shown (S, A, B, C, D), so two comps that show the same number share a tier.
- Reasons match the ranking. Every pro, con and note is read off the numbers that ranked the comp. No reason is written by hand for a single comp.
- Rank changes the answer. Low ranks reward aim, simple selfish utility and agents who work alone. High ranks reward coordinated utility and lean toward what pro teams play. The tests check both ends.
- Parties plan for real lobbies. A duo or trio is scored over the random teammates they're likely to get at their rank.
- When something can't be done, the page says why. When no comp fits the choices, the page points at the likely cause and offers to clear the agent and role choices. When a role count can't fit the party, it says so instead of quietly changing it.
- The tests keep the answers sensible. The scenario tests (`tests/unit/scenarios.test.ts`) check them across maps and ranks. Every top comp has a controller and a sound mix of roles, high-rank answers stay close to pro play, each map's signature agents show up, new agents don't take over, and the best comp changes a little at a time from one rank to the next. The benchmarks (`tests/unit/benchmarks.test.ts`) hold the answers to what pros and ranked play show. They count how many agents the best comps share with pro comps, check that the comps pros played rate well and that low-rank tiers match ranked results, and check every reason a comp gives against its numbers.

## Look

"A coach's clipboard on a quiet desk": calm surfaces, clear type, and the game's own art doing the color.

- Headings are set in Literata, a serif, and the interface in Atkinson Hyperlegible Next, with Atkinson Hyperlegible Mono for keyboard keys. All three are bundled.
- Paper (light) and Lamp (dark) are the default themes. There are ten built-in themes plus a theme editor with shareable theme codes. Every theme is generated from five picks by `core/theme.ts`, which nudges colors until text is readable on every shade it sits on.
- Light or dark follows the computer by default. Switching cross-fades the whole page as one snapshot (`ui/theme.ts`). Keep it smooth, and never animate element by element.
- Tiers and roles have their own colors in every theme, but a fit is never shown by color alone. It has its tier letter and a bar, and its number unless that's turned off in Settings.
- Every shared control is in `ui/components/controls.tsx`, and the hidden gallery page (`#/gallery`) shows each one in the current theme. Check it after style changes.
- The icons are one hand-drawn set in `ui/icons.tsx` (24 px, rounded strokes), shown beside the game's own ability and role icons.
- Spacing, corners and timing come from tokens in `ui/styles/base.css` (`--sp-*`, `--r-*`, `--dur-*`, `--ease*`). Use them instead of one-off values.

## Motion and sound

- Motion has three levels in Settings → Appearance: Full, Reduced (fades only) and Off. `html[data-motion]` carries the level, and base.css enforces Reduced and Off globally. Anything new must look right at all three.
- Durations come from `--dur-quick` (120 ms), `--dur-base` (220 ms), `--dur-page` (320 ms) and `--dur-flip` (450 ms). Prefer transforms and opacity, which animate cheaply.
- Sounds are named cues in `ui/sound.ts`, grouped as interface and results, each with its own volume. There are three sound sets, called Desk, Chimes and Kalimba. Sound is quiet by design and can be turned off.

## Wording

Playbook should read like the help pages of a good game studio, written by a teammate who knows the game, talks plainly and gets to the point.

- Write whole sentences, short ones and longer ones mixed. Real counts of things, so lists aren't always three items long.
- Say what happens and why. "Sage keeps Reyna alive long enough to snowball" tells a player more than "Synergy +2" ever could.
- Name the real thing: the agent, the ability, the callout, the number. A line with nothing concrete in it can usually go.
- Use the game's own names for agents, abilities and callouts, and players' own words for the rest (comp, entry, retake, post-plant, lurk, eco). Avoid anything only the code uses, and keep one word for one thing everywhere.
- Plain verbs and everyday words. Hype words, stock openers and closers, contrasts that set one thing up only to knock it down, and a tidy summary line at the end of a section all make writing sound canned. `tools/lint.mjs` lists the ones it catches.
- No long dashes, no exclamation marks, no emoji. Bold is for a button or menu name the reader has to find, or a single warning, never the start of every bullet.
- Sentences that the app builds from its numbers follow the same rules. Mix the ways they start, keep each one to one idea, and use real verbs over chains of "-ing" phrases.
- Numbers that describe a rule come from its constant (see `CONTRIBUTING.md`).
- Typographic quotes and apostrophes (’ “ ”) in shown text.

`npm run lint` catches the hype words, the stock phrases and the long dashes anywhere in the app, the docs and the comments.

## Quality bar

- Works in light and dark, at every text size, and with the keyboard alone. Nothing is cut off or pushed off screen (an e2e test sweeps every page for this), and tooltips never clip.
- Passes an automated accessibility check (WCAG AA) on every page.
- No errors in the console. The e2e tests fail on any page error.
- It never freezes. Long questions are answered a situation at a time, with progress on screen.
- Damaged data never breaks the app. It's set aside and shown under Help → About.
- Undo (Ctrl Z) for every change to saved data.

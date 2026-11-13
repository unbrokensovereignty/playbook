/**
 * Help: a guide to how the Planner thinks and where its numbers come from, the guided tours, every
 * keyboard shortcut, and About (version, storage, problems, licenses and the notice for the game's art).
 */
import { PageHead } from '../shell.tsx';
import { Button, Kbd, Tabs } from '../components/controls.tsx';
import { Icon } from '../icons.tsx';
import { startTour, tourDone } from '../tours/engine.tsx';
import { TOURS, type TourGroup } from '../tours/list.ts';
import { backendKind, errors, go, tabRole, watch } from '../state.ts';
import { copyWithToast, download, datedName } from '../files.ts';
import { openWhatsNew } from '../components/whatsnew.tsx';
import { WHATS_NEW } from '../../core/whatsnew.ts';
import { AGENTS, STATS_ON } from '../../core/kb/agents.ts';
import { MAPS, PATCH, POOL, POOL_SINCE, RUN_SPEED, mapById } from '../../core/kb/maps.ts';
import { NEW_AGENTS } from '../../core/kb/new-agents.ts';
import { MAP_WINS } from '../../core/kb/mapwins.ts';
import { OLDER, PRO, PRO_MAPS_COUNTED, proKnown, REGIONAL, REGIONAL_BELOW } from '../../core/kb/pro.ts';
import { EVENTS, LINEUPS_READ } from '../../core/kb/lineups.ts';
import { BUY_GUIDE, DEMANDS, PLAYS, ROUND, isRoundPlay, type Demand } from '../../core/kb/plays.ts';
import { clockTime, HIT_AT } from '../../core/engine/plays.ts';
import { CHAT_TIPS } from '../../core/engine/summary.ts';
import { COMFORT_OFFER } from '../../core/games.ts';
import { RANKS, rankOf } from '../../core/kb/ranks.ts';
import { RANKED_SOURCE } from '../../core/kb/ranked.ts';
import { atRank, kitShare, proLean, winShare } from '../../core/engine/model.ts';
import { UNSETTLED } from '../../core/engine/sure.ts';
import { COMFORT, FIT_MID, MAP_PICK, MAP_WIN, PARTY_TEAM, PLAY_RANK, PRO_GAMES, RADIANT_WIN, SECOND_CONTROLLER, SURE, WIN_CAP, WIN_RANKS } from '../../core/engine/weights.ts';

const DEMAND_LEVELS = Object.keys(DEMANDS).map(Number) as Demand[];
import { countWord, tierWords } from '../planner/words.ts';
import { fmtLongDay } from '../../core/dates.ts';
import { listJoin } from '../../core/text.ts';
import { plural } from '../../core/util.ts';
import type { PageProps } from './index.ts';

/** When the numbers for each map were taken: "taken map by map between October 4, 2026 and October 30, 2026", or the one day. */
function mapWinDates(): string {
  const days = Object.values(MAP_WINS).map((m) => m.on).sort();
  const first = days[0]!, last = days[days.length - 1]!;
  return first === last ? `as of ${fmtLongDay(first)}` : `taken map by map between ${fmtLongDay(first)} and ${fmtLongDay(last)}`;
}

type Tab = 'guide' | 'tours' | 'keys' | 'about';

const GLOBAL_KEYS: readonly [string, string][] = [
  ['ctrl+k', 'Search pages, agents, maps, saved plans, settings and actions'],
  ['/', 'Search'],
  ['ctrl+z', 'Undo'],
  ['ctrl+shift+z', 'Redo (Ctrl Y works too)'],
  ['ctrl+\\', 'Narrow or widen the sidebar'],
  ['?', 'This list'],
  ['escape', 'Close a dialog or menu'],
];

const LIST_KEYS: readonly [string, string][] = [
  ['tab', 'Move to the next control (Shift Tab goes back)'],
  ['enter', 'Press the button or open the row that has focus (Space works too)'],
  ['arrowdown', 'Move through a menu, a set of choices or the search results (the up arrow goes back)'],
  ['home', 'The first item of a menu (End goes to the last)'],
  ['arrowright', 'The next tab or choice in a row of them (the left arrow goes back)'],
];

const SELECT_KEYS: readonly [string, string][] = [
  ['enter', 'Add the agent you’ve typed the first letters of'],
  ['backspace', 'With nothing typed, take the last agent back out'],
  ['escape', 'Clear what you’ve typed'],
];

const TOUR_GROUPS: readonly [TourGroup, string][] = [['basics', 'Start here'], ['pages', 'The pages']];

function Tours() {
  watch('meta');
  return (
    <div class="stack">
      <p class="muted tours-intro">Each tour lights up one thing at a time on the real screens. Press <Kbd k=" " /> for the next step, <Kbd k="arrowleft" /> to go back and <Kbd k="escape" /> to stop.</p>
      {TOUR_GROUPS.map(([g, title]) => (
        <section class="panel" key={g} data-tour={g === 'pages' ? 'tours-list' : undefined}>
          <h2>{title}</h2>
          <ul class="tour-list">
            {TOURS.filter((t) => t.group === g).map((t) => {
              const done = tourDone(t.id);
              return (
                <li key={t.id} class="tour-row">
                  <span class={`tour-done${done ? ' on' : ''}`} aria-hidden="true">{done && <Icon name="check" size={14} />}</span>
                  <div class="grow">
                    <b>{t.name}</b>{done && <span class="visually-hidden"> (taken)</span>}
                    <small class="muted">{t.blurb}</small>
                  </div>
                  <Button id={`start-tour-${t.id}`} size="sm" kind={done ? 'secondary' : 'primary'} icon="play" onClick={() => startTour(t.id)}
                    label={`${done ? 'Replay' : 'Start'} the ${t.name} tour`}>{done ? 'Replay' : 'Start'}</Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function KeyCombo({ k }: { k: string }) {
  return <span class="row" style={{ gap: '4px' }}>{k.split('+').map((p, i) => <Kbd key={i} k={p} />)}</span>;
}

function Keys() {
  return (
    <div class="grid-2">
      <section class="panel">
        <h2>Everywhere</h2>
        <table class="key-table"><tbody>
          {GLOBAL_KEYS.map(([k, what]) => <tr key={k}><td><KeyCombo k={k} /></td><td>{what}</td></tr>)}
        </tbody></table>
        <p class="small muted" style={{ marginTop: '12px' }}>On a Mac, use Command where these say Ctrl. While you type in a box, its letters and Ctrl Z stay with the box.</p>
      </section>
      <section class="panel">
        <h2>Menus, lists and choices</h2>
        <table class="key-table"><tbody>
          {LIST_KEYS.map(([k, what]) => <tr key={k}><td><KeyCombo k={k} /></td><td>{what}</td></tr>)}
        </tbody></table>
        <p class="small muted" style={{ marginTop: '12px' }}>Everything in Playbook can be reached with the keyboard, including the Planner’s choices, the comps and their tabs, and the agent and map pickers.</p>
      </section>
      <section class="panel">
        <h2>Agent select</h2>
        <table class="key-table"><tbody>
          {SELECT_KEYS.map(([k, what]) => <tr key={k}><td><KeyCombo k={k} /></td><td>{what}</td></tr>)}
        </tbody></table>
        <p class="small muted" style={{ marginTop: '12px' }}>The box to type in has focus when the page opens, so you can start typing straight away.</p>
      </section>
    </div>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** To the nearest 5%, as the comps' cons say it. */
const about = (x: number) => `${Math.round(x * 20) * 5}%`;
/** The rank at a place on the climb from Iron (0) to Radiant (1). */
const rankAt = (t: number) => RANKS.reduce((best, r) => (Math.abs(r.t - t) < Math.abs(best.t - t) ? r : best)).name;

/** How a rank changes the answers, in words built from the engine's own numbers. */
function RankHelp() {
  const known = AGENTS.filter((a) => !a.estimate);
  const atIron = (a: (typeof known)[number]) => atRank('iron', (t) => kitShare(a, t));
  const atTop = (a: (typeof known)[number]) => atRank('radiant', (t) => kitShare(a, t));
  const hardest = known.reduce((x, y) => (atIron(y) < atIron(x) ? y : x));
  const easiest = known.reduce((x, y) => (atIron(y) > atIron(x) ? y : x));
  const [iron, radiant] = [RANKS[0]!, RANKS[RANKS.length - 1]!];
  return (
    <section class="panel stack">
      <h2>How your rank changes the answers</h2>
      <h3>Kits</h3>
      <p>A hard kit, or one that needs the team to play around it, is worth less until players have learned it. At {iron.name} a team gets about {about(atIron(hardest))} of {hardest.name}’s kit and {about(atIron(easiest))} of {easiest.name}’s. At {radiant.name} it gets {about(atTop(hardest)) === '100%' ? 'all of every kit' : `at least ${about(atTop(hardest))} of every kit`}. Gun play counts the same at every rank.</p>
      <h3>Ranked results</h3>
      <p>Agents who win more ranked games fit a little better, and those who win fewer a little worse. The rates Playbook quotes average two sources, after moving each one so its average pick wins 50%, so a rate here can sit a point or so from the one either site shows. Most of those games are played between {rankAt(WIN_RANKS.from)} and {rankAt(WIN_RANKS.to)}, so win rates count most there, with {pct(atRank('iron', winShare) / atRank('gold', winShare))} as much at {iron.name} and {pct(atRank('radiant', winShare) / atRank('gold', winShare))} at {radiant.name}. Only {WIN_CAP} points either side of 50% count, since a win rate says who plays an agent as well as how strong the agent is. An agent who wins more or fewer games on one map than on the others gets that counted there too, but only as far as it’s more than chance. Most of the difference between maps is chance even over thousands of games, so it takes {MAP_WIN.games.toLocaleString('en-US')} games on a map to count half of it.</p>
      <h3>How well you play your agents</h3>
      <p>In <a href="#/settings/you">Settings → You</a>, and for each player in a saved party, you can mark an agent as one of your mains or one you’re still learning. Comps lean toward your mains and away from agents you’re still learning, {-COMFORT.learning / COMFORT.main === 2 ? 'twice as far' : `${Math.round((-COMFORT.learning / COMFORT.main) * 10) / 10} times as far`}, since a new agent costs more than a main is worth. It counts in full at {iron.name} and {pct(COMFORT.radiant)} as much at {radiant.name}, where everyone knows their agents well.</p>
      <h3>Teamwork in plays</h3>
      <p>Each play is marked {listJoin(DEMAND_LEVELS.map((d) => DEMANDS[d].name.toLowerCase()), 'or')}, by how much teamwork it asks for. A play that asks for more than teams at your rank usually manage fits less there. Most teams run {listJoin(DEMAND_LEVELS.slice(1).map((d) => `${DEMANDS[d].name.toLowerCase()} plays well from ${rankOf(PLAY_RANK.from[d]).name}`))}. From {rankOf(PLAY_RANK.read.from).name} up it works the other way too. Defenders hear a simple hit coming and stack against it, so a plain plan fits a little less, and less again at each rank above. On defense that starts at {rankOf(PLAY_RANK.read.defense).name}, where attackers take mid and fake before they commit, so a hold that only waits on the sites gives them that for free.</p>
      <h3>Pro play</h3>
      <p>What pro teams pick on a map, and how many of each role they run there, counts {pct(atRank('iron', proLean))} as much at {iron.name} as at {radiant.name}, {pct(atRank('gold', proLean))} at {rankOf('gold').name}, {pct(atRank('diamond', proLean))} at {rankOf('diamond').name} and {pct(atRank('immortal', proLean))} at {rankOf('immortal').name}. A map with fewer than {PRO_GAMES.full} pro games behind it counts less{PRO_GAMES.dated < 1 ? ', and so does one whose numbers are from an earlier year' : ''}.</p>
    </section>
  );
}

function Guide() {
  const fresh = NEW_AGENTS.map((a) => a.name);
  const latest = AGENTS.filter((a) => !a.estimate && !proKnown(a)).map((a) => a.name);
  const dated = Object.entries(PRO).filter(([, p]) => p.dated).map(([id, p]) => {
    const since = AGENTS.filter((a) => !a.estimate && p.until && a.released > p.until).map((a) => a.name);
    return `${mapById(id)?.name ?? id} wasn’t played at this year’s events, so its numbers are from ${p.event ? `${p.event}, the last top event that played it` : 'the year before'}${since.length ? `. Pro play there doesn’t count for or against ${listJoin(since)}, who came out since` : ''}`;
  });
  const regional = Object.entries(PRO).filter(([, p]) => p.regional).map(([id]) => mapById(id)?.name ?? id);
  return (
    <div class="stack guide">
      <section class="panel stack">
        <h2>Getting started</h2>
        <ol>
          <li>Ask a question on the <b>Planner</b> with a map, your side, your rank and who you’re queuing with. Leave any of them open, or ask for the best one.</li>
          <li>The answers are the comps that fit best. Each shows how it wins, its pros and cons, the plays it can run on the map, and tips. Under Agents, open any agent to see why their best comp ranks below the best one.</li>
          <li>Look things up on <b>Rankings</b> (tier lists of agents and comps), <b>Agents</b> (kits, strengths and partners) and <b>Maps</b> (sites, callouts and plays).</li>
          <li>Save a plan you like, or copy or print it. Your usual party can be saved too, with the agents each of you plays, so they’re a click away next time.</li>
        </ol>
        <p>Playbook starts from your rank, how you queue and the agents you play. It asks for them when you first open it, and you can change any of them in <a href="#/settings/you">Settings → You</a>. Every plan then gives you one of your agents, Rankings marks them with a star, and Home shows how each fits at your rank.</p>
        <p class="muted">Rather be shown? <a href="#/help/tours">Tours</a> walk you through each page on the real screens.</p>
      </section>
      <div class="guide-cols">
        <section class="panel stack">
          <h2>The question</h2>
          <p>Map, side, sites and rank describe the game you’re about to play. Choose <b>Best</b> for the side, or <b>Find the best rank</b>, and the Planner compares them all for you. Leave the map open to plan across the pool ({plural(POOL.length, 'map')}), or turn on all {MAPS.length}.</p>
          <p><b>Find the best map</b> ranks every map for your question. For a five-stack with agents, roles or a saved party chosen, it also suggests up to {MAP_PICK.most} maps to play and {MAP_PICK.most} to ban, as in Premier, each with its reason. A map to play is one where your best comp comes closer to the best comp for that map than it does elsewhere, and a map to ban is one where it falls further short. A map is worth banning only when it fits at least {plural(MAP_PICK.gap, 'point')} below your best one, so when every map fits about the same, it says so. A five-player party on the Saved page has a button for this.</p>
          <p>Choosing <b>Sites</b> narrows a plan to the ones you’ll play, like B and C on Haven for a hit or a hold there. Plays and map tips then come from those sites first.</p>
          <p><b>Must play</b> keeps agents in every comp. <b>Won’t play</b> leaves them out. <b>Roles</b> set how many of a role the team has, like two controllers or no sentinel.</p>
          <p><b>Their team</b> takes the other team’s agents, if you know them. Comps that answer them rank higher, and each comp says how it stands against them. Both teams can play the same agent, so these don’t limit your picks.</p>
          <p>Every change answers again straight away. <b>Start over</b> goes back to how you play (your rank, how you queue and your agents) with nothing else chosen, and recent questions are on Home.</p>
        </section>
        <section class="panel stack">
          <h2>Fit and tiers</h2>
          <p>A comp’s <b>fit</b> compares it with every possible team for the same situation. The best team is 100 and the middle one is {FIT_MID}, so a fit means the same on every map, side and rank.</p>
          <p>Tiers follow the fit, with {tierWords()}. An agent’s fit comes from the best comp they fit into, so a high fit says the agent is easy to build a strong comp around here. The other four can make several agents look the same, so each is also measured by what they add to that comp over the next best agent of their role in their place (“ahead of Skye, the next best initiator”). Agents with the same fit are listed by what they add, and an agent’s tooltip on Rankings and their row on the Planner’s Agents tab show it.</p>
          <p>A fit marked <b>less sure</b>, with a dashed ring on its tier, could be off by {SURE.less} points or more, which is about a tier. That happens when part of it rests on very little. The ranked numbers may be from an agent’s first days, when they can still change a lot as players learn the agent. What their kit does on the map may be judged from the abilities alone, with no play to check it yet. Or the agent came out after the year’s top events, so there’s no pro play to go on. Point at it, or Tab to it, to see which. {UNSETTLED.length ? `Right now that’s ${listJoin(UNSETTLED.map((a) => a.name))}.` : 'No agent is that new right now.'}</p>
          <p>Fit weighs what the situation needs (smokes, flashes, information, a strong anchor and so on) against what the team brings, how well the agents work together, and the role counts every team needs. Your rank changes the mix. Low down, aim and simple utility win rounds, and near the top, coordinated utility and what pros play on the map count for more. A second controller pays off only when the team plays its smokes together, so below {rankOf(SECOND_CONTROLLER.until).name} it costs a comp a little, less at each rank up. From {rankOf(SECOND_CONTROLLER.until).name} on, two controllers can lead again on the maps where pros run two.</p>
        </section>
        <RankHelp />
        <section class="panel stack">
          <h2>Solo, duos and trios</h2>
          <p>Solo or in a duo or trio, the others are random teammates. The Planner counts on what players at your rank usually pick, and on teammates filling a role the team is missing, then ranks your picks by every team you could end up with, each weighed by how likely it is. A row shows your agent, or your party, with the best agents for your random teammates to play around it.</p>
          <p>Random teammates play together less than a five-stack does, even near the top. So for a solo player, a duo or a trio, everything that rests on teamwork (what a kit that needs the team is worth, a second controller, what pros play) counts as it would for a five-stack lower down. A solo player’s team at {rankOf('radiant').name} plays together about like a five-stack at {rankAt(PARTY_TEAM[1])}. Aim, and how hard each kit is to play, still count at your own rank. A random team also needs a duelist and a sentinel more, and an initiator less, since that’s how the roles add up in ranked games from {rankOf('diamond').name} up.</p>
          <p>From {rankOf(RADIANT_WIN.from).name} up, the agents players at {rankOf('radiant').name} pick, and how often each one wins there, count for random teams as well, more at each rank up. Players there know the game about as well as anyone, and the agents they pick most also win more often than most.</p>
          <p>A row’s fit is among other picks for the same number of players. Open it to see how the team fits if your teammates play those picks, and what to expect if they pick on their own (both against the best five-stack), the role worth asking them for (and how often they pick it on their own), other good picks for them, and the team they’d most likely pick.</p>
          <p>Already know what they locked in? Add it under <b>Teammates locked in</b>, and the Planner fills in around them. To plan around the agents your party plays, save it on the Saved page and choose it under <b>Saved party</b>.</p>
        </section>
        <section class="panel stack">
          <h2>Agent select and your games</h2>
          <p><b>Agent select</b> is for the seconds before you lock in. Choose the map, and as each teammate locks in, type the first letters of their agent and press Enter, or click the face. It says which agent to lock in now, from your agents when you’ve said which in Settings → You, with what they bring that the team needs most and the role to ask the others for. It asks the Planner the same question as a solo player with those teammates locked in, for both sides, so <b>Open in the Planner</b> shows the same answer in full.</p>
          <p>After the game, say how it went in one click. Saved → <b>Your games</b> keeps each game with the map, the agent you played and your team, and shows your record by agent and by map. Once you’ve played an agent in {COMFORT_OFFER.games} games or more, Playbook offers to mark them as one of your mains if you’ve won {pct(COMFORT_OFFER.main)} or more of them, or as one you’re still learning if you’ve won {pct(COMFORT_OFFER.learning)} or less, since a few games say little. Nothing changes until you say yes.</p>
        </section>
        <section class="panel stack">
          <h2>Plays</h2>
          <p>Each map has plays for attack and defense, {plural(PLAYS.filter((p) => !isRoundPlay(p.kind)).length, 'play')} in all. They cover hits, splits, fakes, defaults, setups and retakes, and on defense every site has a stack, an early push and a retake setup. A stack puts extra players on the site, a push takes an early fight in front of it, and a retake setup gives it up lightly to win it back. A play has a job for each player, like smoking a choke, flashing the entry or watching the flank. Every map also has a play for the pistol round, one for an eco and one for an anti-eco round on each side ({plural(PLAYS.filter((p) => isRoundPlay(p.kind)).length, 'play')}), listed under the others. With little to spend, close fights and playing together make up for what you can’t buy. Against a team that saves, your rifles win at range, so you take the close corners with utility first.</p>
          <p>The Planner shares out the jobs so the play fits your team as well as it can, and names the abilities each player would use. A play <b>fits well</b>, <b>works</b> or is <b>a stretch</b>, from how good the players are at their jobs. A warning sign marks a job left to someone who isn’t good at it. A play with one of those never fits well, and with two it’s a stretch, so the plays your comp can run in full come first. Of two that fit as well, the simpler one comes first, and then the one on the site that suits your comp. On defense, the ways to hold come before the retakes, and a stack comes after a setup that fits as well, since a stack is a guess at where they’ll hit. From {rankOf(PLAY_RANK.read.defense).name} up, a stack on the site you asked about also waits until after that site’s other plays.</p>
          <p>The minimap draws each player’s route in their own color, along the corridors and through the doorways they’d really take, with their face where they end up and their utility where it lands, whether that’s a smoke, a wall, a flash, a stun or concussion, or information. Point at a step, or Tab to it, to bring its route forward. Click it, or use the arrows above the steps, to keep it forward while you step through the play. A dashed start is the walk out of spawn, and a ring is a spot to hold.</p>
          <p>A play’s steps come in the order they happen. On attack that’s before the hit, on the hit and after the plant, and on defense it’s early, when they hit and on the retake. <b>Replay</b> runs it a moment at a time, the players walking their routes and their utility landing as they arrive. With motion set to Off, each moment shows at once. Click a moment to stop there, and <b>Show all</b> to see the whole play again.</p>
          <p>A play on one site shows where the Spike goes down. A fast hit plants on the safe spot just inside the way it comes in, where it goes down quickly with no time to clear the whole site. Any other hit plants in the middle of the site, where the post-plant can see it from more spots. A retake starts with the Spike already down in the middle of the site.</p>
          <p>Each moment says where it falls on the round’s {clockTime(ROUND.length)} clock. A simple hit goes at about {clockTime(HIT_AT.fast)}, before the defenders have their utility set, and a set play at about {clockTime(HIT_AT.set)}. A default, a fake or an anti-eco round waits for its information until about {clockTime(HIT_AT.slow)}. From {rankOf(HIT_AT.laterFrom).name} up, teams hold space longer, so set plays and defaults go about {HIT_AT.later} seconds later. After the plant, the Spike goes off in {ROUND.spike} seconds, and a defuse takes {ROUND.defuse}.</p>
          <p>A play that <b>reads and reacts</b> has a branch for each thing the team can find out early, like “A is thin” or “Two or more on A”. Switch between them on the play to see each one drawn and replayed.</p>
          <p>Each map’s page has <b>See the plays</b>, which opens every play for the map on a page of its own, by kind, for a side and a site, filled with the comp you choose. That can be the pros’ usual comp on the map, the best comp at your rank, or a plan you saved with a comp.</p>
          <p><b>Draw a play</b> adds one of your own. Give each step one or two jobs (five in all, one for each player), click its route on the map from where the player starts (or choose the spots from a list), and say what they do in a line. The callouts the line names are where its smokes, flashes and information land, as in the built-in plays, and the moment comes from its jobs and words unless you set it. As you draw, the pros’ usual comp fills it so you see who does what. Your plays are kept with your plans (Saved → Your plays) and in backups, and the Planner fills them with any comp, marked <b>Yours</b>, beside the built-in plays. To share one, copy its code there and send it. <b>Add from code</b> adds a play someone shared with you.</p>
          <p>Every minimap zooms and moves. Use the plus and minus buttons, the mouse wheel or a double click to zoom, drag it around, or use the keyboard (plus and minus, the arrow keys, and 0 for the whole map). The last button, or F, fills the screen with the map, and Escape brings it back. On a map’s page you can choose how big the callout names are, turn the dot at the middle of each callout on or off, and show or hide the ultimate orbs, the doors, walls, teleporters, ziplines, ropes and silent drops, and each site’s two plant spots. Callout names, their dots and the marks grow and shrink with the map as you zoom, so they always cover the same share of it. With dots off, each name sits right on its spot. <b>What’s marked</b> under the map says what each one is.</p>
          <h3>What to buy</h3>
          <dl class="buy-guide">
            {BUY_GUIDE.map((r) => <div key={r.id}><dt>{r.name}</dt><dd>{r.text}</dd></div>)}
          </dl>
        </section>
        <section class="panel stack">
          <h2>Using an answer</h2>
          <p><b>Copy</b> on a comp puts the plan into words you can paste into a chat with your team. <b>Short, for party chat</b> gives the comp with each agent’s role, how it wins, the play with who does what and {countWord(CHAT_TIPS)} tips, and <b>The whole plan</b> adds the pros and cons, where each player goes and every tip. <b>Print</b> puts it on one sheet of paper, with each agent and their tip, how the comp wins, its pros and cons, the play you chose on its Plays tab drawn on the minimap (one for each side when the plan is for both), and the other tips. A saved plan prints with its name and note.</p>
          <p><b>Compare</b> sets a comp beside any other the Planner found for a five-stack. It shows their fits, how each wins, their best plays, how well each covers what the situation needs, and where the lower one falls short or does better.</p>
        </section>
        <section class="panel stack">
          <h2>Where the numbers come from</h2>
          <p>Playbook covers {plural(AGENTS.length, 'agent')} and {plural(MAPS.length, 'map')}, as of patch {PATCH}, with the map pool since {fmtLongDay(POOL_SINCE)}. Here is where each part comes from, and how recent it is.</p>
          <dl class="sources">
            <div><dt>Agents, abilities and maps</dt><dd>The game’s own content for patch {PATCH}: each ability’s text, the maps, their callouts and where each one sits on the minimap, and the art.</dd></div>
            <div><dt>What each kit brings</dt><dd>How strong each agent is at each thing a team needs (smokes, flashes, information and the rest) is judged from the ability text, then checked against what pro teams got from the agent this year.</dd></div>
            <div><dt>Ranked picks and wins</dt><dd>Pick rates from metabot.gg, and win rates from metabot.gg and winio.ai, across all ranks as of {fmtLongDay(STATS_ON)}. Win rates on each map, and the rounds each side wins there, from metabot.gg too ({mapWinDates()}). The agents picked most at each rank, and the pick and win rates at {rankOf('radiant').name} itself, from {RANKED_SOURCE.name} for {RANKED_SOURCE.month}, read on {fmtLongDay(RANKED_SOURCE.read)}.</dd></div>
            <div><dt>Pro play</dt><dd>The five agents each team played on each map at {listJoin(EVENTS.map((e) => e.name))}, {PRO_MAPS_COUNTED} maps in all, read from each series’ page on vlr.gg on {fmtLongDay(LINEUPS_READ)}, with each map’s newest event counting most{regional.length ? `. ${listJoin(regional)} ${regional.length === 1 ? 'was' : 'were'} played on fewer than ${REGIONAL_BELOW} maps there, so the pick rates at ${REGIONAL.name} (read from vlr.gg on ${fmtLongDay(REGIONAL.read)}) are blended in, each of their maps counting ${pct(OLDER)} as much` : ''}{dated.map((d) => `. ${d}`).join('')}.</dd></div>
            <div><dt>Orbs, doors and ropes</dt><dd>Placed by hand on each minimap and checked against the community wikis’ interactive maps and several map guides.</dd></div>
            <div><dt>Rotation times</dt><dd>Walked along the floor of each minimap, at its scale in the game’s map data, at {RUN_SPEED} metres a second, the run speed with a rifle out.</dd></div>
            <div><dt>Plays, tips and matchups</dt><dd>Written from the ability text and from how pro teams and coaches play each map, agent and comp. Each play’s jobs go to the agents who do them best, by the same numbers as the rest.</dd></div>
          </dl>
          {latest.length > 0 && <p>{listJoin(latest)} came out after those events, so pro play doesn’t count for or against {listJoin(latest)} yet, and the pick rate in ranked is from the first days of play (op.gg).</p>}
          {fresh.length > 0 && <p>{listJoin(fresh)} {fresh.length === 1 ? 'is' : 'are'} too new for real numbers, so the scores are early estimates from the kit that was shown. Leave {listJoin(fresh)} out of a question under Options, or out of every new one in <a href="#/settings/includeNew">Settings → Planner</a>.</p>}
          <p>Win rates are for all ranks together, {rankOf('radiant').name} aside, since the sources don’t split them reliably rank by rank, so how the advice changes with your rank comes mostly from how play changes as players climb. Playbook works offline, so it doesn’t fetch match stats while you use it. Each new version brings new numbers.</p>
        </section>
        <section class="panel stack">
          <h2>Your data</h2>
          <p>Everything stays on this computer, in this browser. Nothing is sent anywhere. Back up from <a href="#/settings/data">Settings → Your data</a> to move to another computer or keep a copy safe.</p>
          <p>Almost anything can be undone with Ctrl Z. With Playbook open in two tabs, only one saves, and the other follows it.</p>
          <p>A new version is a new file. Open it in the same browser and your plans, parties, plays and settings are there, wherever you keep the file. Some browsers keep each file’s data apart, so back up before you switch. If the new version opens as if for the first time, choose <b>Restore a backup</b>.</p>
        </section>
      </div>
    </div>
  );
}

/** Where new versions are published, written out to type into a browser (Playbook itself never goes online). */
const RELEASES = 'github.com/unbrokensovereignty/playbook/releases';

const LICENSES: readonly [string, string][] = [
  ['Preact and Preact Signals', 'MIT License, © Jason Miller and contributors'],
  ['Literata', 'SIL Open Font License 1.1, © The Literata Project Authors'],
  ['Atkinson Hyperlegible Next and Mono', 'SIL Open Font License 1.1, © Braille Institute of America'],
];

function About() {
  const r = watch('meta', 'plans', 'parties');
  const bad = r.quarantine();
  const storage = { indexeddb: 'Browser database (IndexedDB)', local: 'Basic browser storage (localStorage)', memory: 'Not saving (this tab only)' }[backendKind.value];
  return (
    <div class="grid-2">
      <section class="panel stack">
        <h2>Playbook</h2>
        <p class="muted">Directed by Sovereign</p>
        <dl class="facts">
          <dt>Version</dt><dd>{__APP_VERSION__}</dd>
          <dt>Game data</dt><dd>Patch {PATCH}</dd>
          <dt>New versions</dt><dd>{RELEASES}</dd>
          <dt>Saving to</dt><dd>{storage}{tabRole.value === 'reader' ? ' (read-only in this tab)' : ''}</dd>
          <dt>Stored</dt><dd>{plural(r.plans().length, 'saved plan')} · {plural(r.parties().length, 'party', 'parties')} · {plural(r.myPlays().length, 'play')} you drew · {plural(r.themes().length, 'theme')} of your own</dd>
        </dl>
        <div class="row wrap">
          {WHATS_NEW.some((n) => n.version === __APP_VERSION__) && <Button icon="sparkle" onClick={() => void openWhatsNew()}>What’s new</Button>}
          <Button icon="check" onClick={() => go('selftest')}>Run the self-test</Button>
        </div>
      </section>
      <section class="panel stack">
        <h2>Problems</h2>
        {errors.value.length === 0 && bad.length === 0 && <p class="muted">No problems since Playbook opened.</p>}
        {bad.length > 0 && (
          <div class="stack" style={{ gap: '6px' }}>
            <p>{plural(bad.length, 'damaged record')} {bad.length === 1 ? 'was' : 'were'} set aside when opening. They’re kept here in case they’re needed.</p>
            <div><Button size="sm" icon="export" onClick={() => download(datedName('Playbook damaged records', 'json'), JSON.stringify(bad, null, 1))}>Download them</Button></div>
          </div>
        )}
        {errors.value.length > 0 && (
          <>
            <pre class="error-log">{errors.value.join('\n')}</pre>
            <div><Button size="sm" icon="copy" onClick={() => void copyWithToast(`Playbook ${__APP_VERSION__}\n${errors.value.join('\n')}`, 'Copied the problems.')}>Copy</Button></div>
          </>
        )}
      </section>
      <section class="panel stack" style={{ gridColumn: '1 / -1' }}>
        <h2>Made with</h2>
        <ul class="licenses">{LICENSES.map(([what, lic]) => <li key={what}><b>{what}</b> <span class="muted">{lic}</span></li>)}</ul>
        <p class="small muted">
          Playbook was created under Riot Games’ “Legal Jibber Jabber” policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
          The agent portraits, ability icons, minimaps and ability text are Riot Games’ own, from valorant-api.com.
        </p>
        <p class="small muted">Playbook is © 2026 Sovereign. All rights reserved.</p>
      </section>
    </div>
  );
}

export function HelpPage({ arg }: PageProps) {
  const tab: Tab = arg === 'tours' || arg === 'keys' || arg === 'about' ? arg : 'guide';
  return (
    <>
      <PageHead title="Help" />
      <Tabs value={tab} label="Help" onChange={(t) => go('help', t === 'guide' ? '' : t)} tabs={[['guide', 'Guide'], ['tours', 'Tours'], ['keys', 'Keyboard'], ['about', 'About']]} />
      <div class="tab-body" key={tab}>
        {tab === 'guide' && <Guide />}
        {tab === 'tours' && <Tours />}
        {tab === 'keys' && <Keys />}
        {tab === 'about' && <About />}
      </div>
    </>
  );
}

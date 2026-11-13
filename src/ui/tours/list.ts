/**
 * Every guided tour: what each step points at and what it says. Steps point at named hooks
 * (`data-tour="…"` in the screens), never at styling classes, so restyling can't break a tour.
 * `tests/unit/tours.test.ts` checks that every hook and page named here exists.
 */
import { FIT_MID } from '../../core/engine/weights.ts';
import { POOL } from '../../core/kb/maps.ts';
import { countWord, plural } from '../../core/util.ts';
import { tierWords } from '../planner/words.ts';

export type Side = 'right' | 'left' | 'below' | 'above';

export interface TourStep {
  /** The page to be on (as in `#/…`). Steps without one stay on the page of the step before. */
  page?: string;
  /** The `data-tour` hook to light up. Without one, the card sits in the middle. */
  target?: string;
  title: string;
  text: string;
  /** Where the card goes next to its target, if there's room. */
  side?: Side;
  /** Said when the target isn't on screen, so people know what to look for. */
  look?: string;
}

export type TourGroup = 'basics' | 'pages';

export interface Tour {
  id: string;
  name: string;
  /** One line for the list in Help → Tours. */
  blurb: string;
  group: TourGroup;
  /** Where the tour starts. */
  page: string;
  steps: readonly TourStep[];
}

/** The agent and map the Agents and maps tour opens: a staple, and the first map in the pool. */
export const TOUR_AGENT = 'sova';
const TOUR_MAP = POOL[0]!.id;

const fitWords = () => `The best possible team for the situation is 100 and the middle one is ${FIT_MID}, so a fit means the same on every map, side and rank. Tiers follow the fit, with ${tierWords()}.`;

// ---------------------------------------------------------------- start here

/** The few steps Home offers on a first visit. */
const FIRST_STEPS: TourStep[] = [
  { target: 'home-maps', side: 'below', title: 'Start with a map', text: 'Pick the map you’re playing next and the Planner finds the comps that fit, with plays and tips for each. Press Space for the next step.' },
  { target: 'plan-switch', side: 'right', title: 'Your question', text: 'The Planner keeps your question here while you look around. Its menu has your recent questions and a fresh one.', look: 'the question near the top of the sidebar' },
  { target: 'search', side: 'right', title: 'Find anything', text: 'Press Ctrl K to jump to any agent, map, saved plan, setting or action. Help → Tours has a longer tour of each page.', look: 'Search at the top of the sidebar' },
];
const FIRST: Tour = {
  id: 'first', name: 'First steps', group: 'basics', page: 'home',
  blurb: `Where to start, where your question lives, and where to find more, in ${countWord(FIRST_STEPS.length)} steps.`,
  steps: FIRST_STEPS,
};

const START: Tour = {
  id: 'start', name: 'Getting started', group: 'basics', page: 'home',
  blurb: 'Home, the Planner and its answers, and every other page, in about two minutes.',
  steps: [
    { title: 'Welcome to Playbook', text: 'This tour shows you around in about two minutes. Press Space for the next step, ← to go back, and Esc to stop at any time.' },
    { target: 'home-maps', side: 'below', title: 'Plan for a map', text: 'Pick the map you’re playing next, or let Playbook find your best one.' },
    { target: 'home-lists', side: 'above', title: 'Recent and saved', text: 'The questions you ask come back here, so you can ask them again in one click, next to the plans you save.' },
    { target: 'home-yours', side: 'above', title: 'Your agents', text: 'The agents you play, how each fits at your rank, and where they’re best. Every plan gives you one of them.' },
    { page: 'planner', target: 'q-map', side: 'right', title: 'Your situation', text: 'Tell the Planner the map, side, sites and rank of your game, who you’re queuing with, and any agents or roles you want. Every change answers again straight away.' },
    { target: 'comp-first', side: 'left', title: 'The comps that fit', text: `The best comps come first, each with its fit. ${fitWords()}`, look: 'the first comp in the list' },
    { target: 'comp-tools', side: 'left', title: 'Why it fits', text: 'Pros and cons come from the same numbers as the fit, so they always agree with the ranking. Plays gives each player a job on the map, and Tips has a line for each agent.', look: 'the first comp, opened' },
    { page: 'select', target: 'select-pick', side: 'left', title: 'Agent select', text: 'Use it in the seconds before you lock in. Add your teammates’ agents as they lock in, and see which agent to pick now and why. Log the game after it.' },
    { page: 'rankings', target: 'rank-controls', side: 'below', title: 'Rankings', text: 'Tier lists of agents and comps for any map, side and rank, and every agent’s fit on every map.' },
    { page: 'agents', target: 'agent-group', side: 'below', title: 'Agents', text: 'Every agent’s abilities and strengths, the maps and ranks they fit best, and who they work well with.' },
    { page: 'maps', target: 'map-group', side: 'below', title: 'Maps', text: 'Sites and callouts, what wins on each map, the best comps there, and plays for attack and defense, with your own among them.' },
    { page: 'saved', target: 'saved-tabs', side: 'below', title: 'Saved', text: 'Plans you save keep their comp, plays and tips. Save the people you queue with as a party, and plans for it give each player one of their own agents.' },
    { target: 'search', side: 'right', title: 'Find anything', text: 'Press Ctrl K to jump to any agent, map, saved plan, setting or action.', look: 'Search at the top of the sidebar' },
    { page: 'help/tours', target: 'tours-list', side: 'above', title: 'More tours', text: 'Each page has its own short tour. Replay any of them here.' },
  ],
};

// ---------------------------------------------------------------- the pages

const PLAN: Tour = {
  id: 'plan', name: 'Plan a game', group: 'pages', page: 'planner',
  blurb: 'Every part of the question, and how to read the comps that come back.',
  steps: [
    { target: 'q-map', side: 'right', title: 'The map', text: `Pick the map you’re playing. Leave it open to plan across the ${plural(POOL.length, 'map')} in the pool, or ask for your best map and the Planner ranks them all.` },
    { target: 'q-side', side: 'right', title: 'Side and sites', text: 'Attack, defense, both, or Best to compare them. With a map chosen, pick one or more sites to plan a hit or a hold there.' },
    { target: 'q-rank', side: 'right', title: 'Your rank', text: 'Your rank changes the answers. Low down, aim and simple utility win rounds, and near the top, coordinated utility and what pros play on the map count for more. It starts on your rank, set in Settings → You.' },
    { target: 'q-party', side: 'right', title: 'Who you’re queuing with', text: 'Solo or in a duo or trio, the others are random teammates. The Planner counts on what players at your rank usually pick, and ranks your picks by every team you could end up with, each weighed by how likely it is. Turn on your agents and every plan gives you one of them.' },
    { target: 'q-include', side: 'right', title: 'Agents you want or don’t', text: 'Keep agents in every comp, or leave them out under Won’t play. Without a five-stack, add the agents your teammates have locked in.' },
    { target: 'q-roles', side: 'right', title: 'Roles', text: 'Set how many of a role you want, like two controllers or no sentinel.' },
    { target: 'answers-head', side: 'left', title: 'The answers', text: 'Your question in a line, and how many possible teams were checked for it. The best come first.' },
    { target: 'answers-tabs', side: 'left', title: 'Comps or agents', text: 'Comps lists whole teams. Agents ranks each agent by the best comp they fit into, so a high fit says the agent is easy to build around here. Open one to see why their best comp ranks below the best.' },
    { target: 'comp-first', side: 'left', title: 'A comp and its fit', text: fitWords(), look: 'the first comp in the list' },
    { target: 'comp-reasons', side: 'left', title: 'How it wins, pros and cons', text: 'The line on top says how the comp wins, from what it does best here. Pros and cons are read off the same numbers as the fit, so they always agree with the ranking. A con says what the team is missing and what that costs it.', look: 'the first comp, opened' },
    { target: 'comp-strengths', side: 'left', title: 'What the situation needs', text: 'How much this map, side and rank asks for each thing, how much of it the team covers, and who brings it, with the abilities they’d use.', look: 'the first comp, opened' },
    { target: 'comp-tools', side: 'left', title: 'Plays, tips and saving', text: 'Plays gives each player a job in a hit, a hold, a retake or a pistol round, drawn on the minimap. Tips has a line for each agent. Copy puts the plan into words for your team chat, short or whole, Print puts it on one sheet of paper, Compare sets it beside another comp, and Save plan keeps it.', look: 'the first comp, opened' },
  ],
};

const RANKINGS: Tour = {
  id: 'rankings', name: 'Rankings', group: 'pages', page: 'rankings',
  blurb: 'Tier lists for any situation, and every agent on every map.',
  steps: [
    { target: 'rank-controls', side: 'below', title: 'The situation', text: 'Pick a map, side and rank, and the lists change to fit. They’re for a five-stack, so if you’re playing solo or in a duo or trio, ask the Planner.' },
    { target: 'rank-tabs', side: 'below', title: 'Three lists', text: 'Agents in tiers, the best comps, or every agent’s fit on every map. Show one role at a time on the right.' },
    { target: 'tier-top', side: 'below', title: 'Tiers', text: `${fitWords()} Click an agent to open their page.`, look: 'the tier list on the Agents tab' },
  ],
};

const BROWSE: Tour = {
  id: 'browse', name: 'Agents and maps', group: 'pages', page: 'agents',
  blurb: 'What each agent’s page and each map’s page tell you.',
  steps: [
    { target: 'agent-group', side: 'below', title: 'Every agent', text: 'Agents are grouped by role. Open one to see their kit and where they fit best.' },
    { page: `agents/${TOUR_AGENT}`, target: 'agent-kit', side: 'right', title: 'Abilities', text: 'Each ability in the game’s own words, with what it does to enemies and for your side colored as in the game.' },
    { target: 'agent-strengths', side: 'right', title: 'Strengths', text: 'How good the agent is at each job, like smokes, flashes, information or entry, judged from the kit and how it’s played.' },
    { target: 'agent-best-maps', side: 'left', title: 'Best maps', text: 'The maps where the agent fits best, at your usual rank.' },
    { target: 'agent-by-rank', side: 'left', title: 'By rank', text: 'The agent’s tier at every rank. Click a rank to plan with the agent there.' },
    { target: 'agent-partners', side: 'left', title: 'Partners', text: 'Who the agent works well with, and who gets in their way.' },
    { page: 'maps', target: 'map-group', side: 'below', title: 'Every map', text: 'The maps in the pool come first, then the rest.' },
    { page: `maps/${TOUR_MAP}`, target: 'map-minimap', side: 'right', title: 'Callouts', text: 'The minimap with its callouts. Zoom in, drag it around, show the ultimate orbs and doors, or turn the callouts off to test yourself.' },
    { target: 'map-wins', side: 'left', title: 'What wins here', text: 'What the map asks for on each side, and how many controllers pro teams run on it.' },
    { target: 'map-best', side: 'above', title: 'Best comps', text: 'Below are tips for the side you pick and the best comps at your usual rank.' },
    { target: 'map-plays', side: 'above', title: 'Plays', text: 'Every map has hits, splits and fakes for attack, and for defense a stack, an early push and a retake setup at each site. See the plays opens them on a page of their own.' },
    { page: `maps/${TOUR_MAP}/plays`, target: 'map-plays-tools', side: 'below', title: 'Plays for any comp', text: 'Pick a side, a site and the comp to fill the plays with, whether that’s the pros’ usual comp, the best at your rank, or one you saved. Each job goes to the agent in it best at the job.' },
    { target: 'play-replay', side: 'left', title: 'Run it like a replay', text: 'Replay walks the players along their routes one moment at a time, and their smokes, walls and flashes land where the play puts them. Click a moment to stop there.' },
    { page: `maps/${TOUR_MAP}/draw`, target: 'draw-steps', side: 'left', title: 'Draw your own', text: 'Give each step its jobs, click its route on the map and say what they do. Saved, it’s kept with your plans and filled with any comp, beside the built-in plays.' },
  ],
};

const SELECT: Tour = {
  id: 'select', name: 'Agent select and your games', group: 'pages', page: 'select',
  blurb: 'Which agent to lock in as your team picks, and logging how each game went.',
  steps: [
    { target: 'select-where', side: 'below', title: 'Map and rank', text: 'Choose the map you’re about to play. The rank starts on yours, from Settings → You.' },
    { target: 'select-team', side: 'right', title: 'Your teammates’ picks', text: 'As each teammate locks in, type the first letters of their agent and press Enter, or click the face. Backspace takes the last one back out.' },
    { target: 'select-pick', side: 'left', title: 'What to lock in', text: 'The agent to pick now, from your agents when you’ve said which, with what they bring that the team needs and the role to ask the others for. It’s the Planner’s own answer for a solo player, so Open in the Planner shows the rest.' },
    { target: 'select-log', side: 'left', title: 'After the game', text: 'Say how it went in one click. The game is kept with the agent you played and your team, and the page clears for the next one.' },
    { page: 'saved/games', target: 'saved-tabs', side: 'below', title: 'Your games', text: 'Your record by agent and by map. Once you’ve played an agent enough, Playbook offers to mark them as one of your mains, or one you’re still learning, which the Planner then counts.' },
  ],
};

const SAVED: Tour = {
  id: 'saved', name: 'Saved and settings', group: 'pages', page: 'saved',
  blurb: 'Saved plans, parties, your plays, and making Playbook yours.',
  steps: [
    { target: 'saved-tabs', side: 'below', title: 'Plans, parties, plays and games', text: 'A saved plan keeps its comp, plays and tips, and a note of your own, like who plays what. Your plays has the plays you drew, and Your games the games you logged.' },
    { page: 'saved/parties', target: 'party-make', side: 'below', title: 'Your party', text: 'Save the people you queue with and the agents each of you plays. Plans for the party then give each player one of their own agents.' },
    { page: 'settings', target: 'settings-section-you', side: 'left', title: 'You', text: 'Your rank, how you queue and the agents you play. The Planner and Rankings start from here.' },
    { target: 'settings-section-planner', side: 'left', title: 'The Planner', text: 'How many comps to show, and whether fits show as numbers.' },
    { target: 'settings-section-appearance', side: 'left', title: 'Look and feel', text: 'Light or dark, the accent color, text size and motion. Themes has more to choose from.' },
    { target: 'settings-section-data', side: 'left', title: 'Your data', text: 'Everything stays in this browser. Back up to keep a copy safe or to move to another computer.' },
  ],
};

export const TOURS: readonly Tour[] = [FIRST, START, PLAN, SELECT, RANKINGS, BROWSE, SAVED];

export const tourById = (id: string): Tour | undefined => TOURS.find((t) => t.id === id);

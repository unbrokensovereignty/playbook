/**
 * A plan as plain text, for copying: the situation, the comp and its fit, how it wins, how it
 * answers the other team (when their agents are known), pros and cons, a play for each side with
 * who does what, and tips. The printed plan sheet (ui/planner/sheet.tsx) is made of the same parts.
 * `chatText` is the short version, for a party chat.
 */
import { agentById } from '../kb/agents.ts';
import { ROLES } from '../kb/roles.ts';
import { spotName } from '../kb/maps.ts';
import { playTitle } from '../kb/plays.ts';
import { listJoin } from '../text.ts';
import { aWord } from '../util.ts';
import { againstWords, type Explanation } from './explain.ts';
import { jobWords, momentLabel, playFitLabel, type FilledPlay } from './plays.ts';
import { partyOf, type PartySize } from './query.ts';
import type { Tip } from './tips.ts';

const name = (id: string) => agentById(id)?.name ?? id;

export interface SummaryParts {
  /** "Haven, attack, C site · Gold · five-stack". */
  title: string;
  team: readonly string[];
  /** Your party, for a duo or trio, and the teammates already locked in. */
  party?: readonly string[];
  locked?: readonly string[];
  /** The role to ask your random teammates for ("sentinel"), if any. */
  ask?: string;
  /** For a party, its fit ranks it among parties of its size. */
  fit: number;
  /** For a party, the fit of the team to expect with random teammates. */
  expected?: number;
  tier: string;
  why: Explanation;
  /** A play for each side the plan covers: the one chosen on the Plays tab, or the best. */
  plays?: readonly FilledPlay[];
  tips: readonly Tip[];
}

/** "Fit 100 among duos": a party's fit ranks it among parties of its size. */
export const fitWords = (p: Pick<SummaryParts, 'fit' | 'party'>): string =>
  `Fit ${Math.round(p.fit)}${p.party?.length ? ` among ${partyOf(p.party.length as PartySize).plural}` : ''}`;

/** For a duo or trio: the picks for your random teammates, the team to expect if they pick on their own, and the role to ask them for. */
export function partyLines(p: SummaryParts): string[] {
  const lines: string[] = [];
  const picks = p.party?.length ? p.team.filter((id) => !p.party!.includes(id) && !p.locked?.includes(id)) : [];
  if (picks.length) lines.push(`The best picks for your random teammates are ${listJoin(picks.map(name))}.`);
  if (p.expected !== undefined && picks.length) lines.push(`If they pick on their own, expect a team that fits about ${Math.round(p.expected)} out of 100.`);
  if (p.ask) lines.push(`Ask your random teammates for ${aWord(p.ask)} first.`);
  return lines;
}

export function summaryText(p: SummaryParts): string {
  const lines: string[] = [`Playbook: ${p.title}`];
  const yours = !p.party?.length ? '' : p.party.length === 1 ? ` (you play ${name(p.party[0]!)})` : ` (your party plays ${listJoin(p.party.map(name))})`;
  lines.push(`Comp: ${p.team.map(name).join(', ')}${yours}. ${fitWords(p)}, tier ${p.tier}.`, ...partyLines(p));
  if (p.why.plan) lines.push(p.why.plan);
  const list = (head: string, items: readonly string[]) => {
    if (!items.length) return;
    lines.push('', head, ...items.map((x) => `- ${x}`));
  };
  list('Against their team', p.why.against.map((r) => `${r.threat}. ${againstWords(r)}`));
  list('Pros', p.why.pros);
  list('Cons', p.why.cons);
  list('Notes', p.why.notes);
  for (const f of p.plays ?? []) {
    const side = p.plays!.length > 1 ? ` on ${f.play.side}` : '';
    lines.push('', `Play${side}: ${playTitle(f.play)} (${playFitLabel(f.fit).toLowerCase()})`, f.play.about);
    const moments = new Set(f.steps.map((s) => s.when)).size;
    f.steps.forEach((s, i) => {
      // each moment named before its steps, when the play has more than one
      if (moments > 1 && s.when !== f.steps[i - 1]?.when) lines.push(`${momentLabel(f, s.when)}:`);
      // "Omen (smokes with Dark Cover)"; a stand-in starts with its ability's own name
      const who = s.who.map((d) => `${name(d.id)} (${d.standIn ? jobWords(d) : jobWords(d).replace(/^\w/, (c) => c.toLowerCase())})`);
      lines.push(`${i + 1}. ${listJoin(who)}: ${s.route.map(spotName).join(' → ')}. ${s.text}`);
    });
  }
  list('Tips', p.tips.map((t) => `${t.about}: ${t.text}`));
  return lines.join('\n');
}

/** How many tips the short version for a party chat takes. */
export const CHAT_TIPS = 2;

/**
 * The plan in a few lines for a party chat: the situation, the comp with each agent's role, how it
 * wins, the play for each side with who does what, and the first CHAT_TIPS tips.
 */
export function chatText(p: SummaryParts): string {
  const role = (id: string) => ROLES.find((r) => r.id === agentById(id)?.role)?.name.toLowerCase();
  const lines: string[] = [`Playbook: ${p.title}`, `Comp: ${p.team.map((id) => (role(id) ? `${name(id)} (${role(id)})` : name(id))).join(', ')}.`, ...partyLines(p)];
  if (p.why.plan) lines.push(p.why.plan);
  for (const f of p.plays ?? []) {
    const side = p.plays!.length > 1 ? ` on ${f.play.side}` : '';
    lines.push('', `Play${side}: ${playTitle(f.play)}`);
    for (const s of f.steps) lines.push(`- ${s.who.length ? `${listJoin(s.who.map((d) => name(d.id)))}: ` : ''}${s.text}`);
  }
  const tips = p.tips.slice(0, CHAT_TIPS);
  if (tips.length) lines.push('', 'Tips', ...tips.map((t) => `- ${t.about}: ${t.text}`));
  return lines.join('\n');
}

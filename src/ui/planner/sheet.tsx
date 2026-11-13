/**
 * A plan on one sheet of paper, to keep beside you while you play: the situation, the comp and its
 * fit, how it wins, each agent with their own tip, pros and cons, a play for each side on the minimap
 * with who does what, and the other tips. It's made of the same parts as a copied plan
 * (core/engine/summary.ts), and printed with printSheet (ui/files.ts).
 */
import { agentById } from '../../core/kb/agents.ts';
import { spotName } from '../../core/kb/maps.ts';
import { playTitle } from '../../core/kb/plays.ts';
import { roleOf } from '../../core/kb/roles.ts';
import { againstWords } from '../../core/engine/explain.ts';
import { jobWords, momentLabel, plantLine, playFitLabel, WEAK_JOB } from '../../core/engine/plays.ts';
import { fitWords, partyLines, type SummaryParts } from '../../core/engine/summary.ts';
import { fmtLongDay, keyOf } from '../../core/dates.ts';
import { AgentIcon } from '../art.tsx';
import { Minimap, ROUTE_COLORS } from '../components/minimap.tsx';
import { Icon } from '../icons.tsx';

export interface SheetParts extends SummaryParts {
  /** "Breeze, attack" and "Immortal · five-stack", the two halves of the title. */
  heading: string;
  line: string;
  /** A saved plan's name and note. */
  name?: string;
  note?: string;
  /** Whether fits show as numbers (Settings), or only as tiers. */
  numbers: boolean;
}

const nameOf = (id: string) => agentById(id)?.name ?? id;

export function PlanSheet({ p }: { p: SheetParts }) {
  const party = p.party ?? [];
  const order = [...party, ...p.team.filter((id) => !party.includes(id))];
  // your party's agents are marked; the picks for random teammates are named in the party lines below
  const whose = (id: string) => (party.includes(id) ? (party.length === 1 ? 'You' : 'Your party') : p.locked?.includes(id) ? 'Locked in' : '');
  const others = p.tips.filter((t) => !t.agent);
  const said = partyLines(p);
  return (
    <article class="sheet">
      <header class="sheet-head">
        <div class="grow">
          <p class="sheet-brand">Playbook <span class="sheet-faint">v{__APP_VERSION__} · {fmtLongDay(keyOf(new Date()))}</span></p>
          <h1>{p.name ?? p.heading}</h1>
          <p class="sheet-line">{p.name ? `${p.heading} · ${p.line}` : p.line}</p>
        </div>
        <p class="sheet-fit">
          <span class={`tier tier-${p.tier.toLowerCase()}`}>{p.tier}</span>
          <span>{p.numbers ? fitWords(p) : `Tier ${p.tier}`}</span>
        </p>
      </header>

      <ul class="sheet-team">
        {order.map((id) => {
          const tip = p.tips.find((t) => t.agent === id);
          const a = agentById(id);
          return (
            <li key={id}>
              <AgentIcon id={id} size={28} />
              <p class="sheet-agent"><b>{nameOf(id)}</b><span class="sheet-faint">{a ? roleOf(a.role).name : ''}{whose(id) && ` · ${whose(id)}`}</span></p>
              {tip && <p>{tip.text}</p>}
            </li>
          );
        })}
      </ul>

      {(p.why.plan || said.length > 0) && (
        <div class="sheet-plan">
          {p.why.plan && <p><Icon name="target" size={16} /><span><b>How it wins.</b> {p.why.plan}</span></p>}
          {said.length > 0 && <p><Icon name="users" size={16} /><span>{said.join(' ')}</span></p>}
        </div>
      )}

      {p.why.against.length > 0 && (
        <section class="sheet-part">
          <h2>Against their team</h2>
          <ul class="sheet-list">{p.why.against.map((r) => <li key={r.id}><b>{r.threat}.</b> {againstWords(r)}</li>)}</ul>
        </section>
      )}

      {/* pros, then cons, flowing down two columns so neither leaves a gap */}
      <section class="sheet-part sheet-cols">
        <h2>Pros</h2>
        {p.why.pros.length ? <ul class="sheet-list">{p.why.pros.map((x) => <li key={x}>{x}</li>)}</ul> : <p class="sheet-faint">Nothing stands out. It’s a steady, all-round comp.</p>}
        <h2>Cons</h2>
        {p.why.cons.length ? <ul class="sheet-list">{p.why.cons.map((x) => <li key={x}>{x}</li>)}</ul> : <p class="sheet-faint">No real weak spots for this situation.</p>}
        {p.why.notes.map((n) => <p key={n} class="sheet-note">{n}</p>)}
      </section>

      {(p.plays ?? []).map((f) => (
        <section key={f.play.id} class="sheet-part sheet-play">
          <h2>{p.plays!.length > 1 ? `On ${f.play.side}: ` : 'Play: '}{playTitle(f.play)} <span class="sheet-faint">· {playFitLabel(f.fit)}</span></h2>
          <p class="sheet-about">{f.play.about}{f.plant && ` ${plantLine(f.play, f.plant)}`}</p>
          <div class="sheet-play-grid">
            <Minimap map={f.play.map} plain spike={f.plant && { at: f.plant.at, about: f.plant.about, when: 0 }} routes={f.steps.map((s) => ({ route: s.route, who: s.who.map((d) => d.id), throws: s.throws }))} label={`${f.play.name} on the minimap`} />
            <ol class="sheet-steps">
              {f.steps.map((s, i) => (
                <li key={i}>
                  <span class={`step-dot r${i % ROUTE_COLORS}`}>{i + 1}</span>
                  <div>
                    <p class="sheet-who">
                      {s.who.map((d, k) => (
                        <span key={d.id}>{k > 0 && ', '}<b>{nameOf(d.id)}</b> <span class="sheet-faint">{jobWords(d)}{d.value < WEAK_JOB && ' (a stretch)'}</span></span>
                      ))}
                    </p>
                    <p class="sheet-route">{momentLabel(f, s.when)}: {s.route.map(spotName).join(' → ')}</p>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}

      {others.length > 0 && (
        <section class="sheet-part">
          <h2>Tips</h2>
          <ul class="sheet-list sheet-cols">{others.map((t) => <li key={t.about + t.text}><b>{t.about}.</b> {t.text}</li>)}</ul>
        </section>
      )}

      {p.note?.trim() && (
        <section class="sheet-part">
          <h2>Note</h2>
          <p class="sheet-own">{p.note.trim()}</p>
        </section>
      )}
    </article>
  );
}

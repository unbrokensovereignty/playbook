/**
 * Every control on one page, in the current theme: for checking a theme or a change to the styles.
 */
import { useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Badge, Bar, Button, Check, ColorField, CountUp, Empty, IconButton, Kbd, Ring, SearchInput, Segmented, Select, Slider, Stepper, Tabs, TextInput, Toggle } from '../components/controls.tsx';
import { confirm, openMenu, prompt } from '../components/overlays.tsx';
import { Minimap } from '../components/minimap.tsx';
import { Icon, ICONS, type IconName } from '../icons.tsx';
import { AbilityIcon, AgentIcon, MapThumb, RoleIcon } from '../art.tsx';
import { Fit, TeamIcons } from '../planner/comp.tsx';
import { toast } from '../state.ts';
import { measure, play, SOUND_SETS, SOUNDS, type SoundName, type SoundSet } from '../sound.ts';
import { ROLE_IDS } from '../../core/kb/roles.ts';
import { TIERS } from '../../core/engine/weights.ts';
import type { PageProps } from './index.ts';

type Levels = Record<string, Record<SoundSet, { peak: number; loud: number }>>;
const dB = (x: number) => (x > 0 ? Math.round(20 * Math.log10(x)) : -99);

/** Every sound in every set, measured without playing it, so a cue much louder or quieter than the rest stands out. */
function SoundLevels() {
  const [levels, setLevels] = useState<Levels | null>(null);
  const check = async () => {
    const out: Levels = {};
    for (const name of Object.keys(SOUNDS) as SoundName[]) {
      out[name] = {} as Levels[string];
      for (const set of SOUND_SETS) out[name]![set] = await measure(name, set);
    }
    setLevels(out);
  };
  return (
    <>
      <div class="row"><Button size="sm" onClick={() => void check()}>Check sound levels</Button></div>
      {levels && (
        <table class="key-table sound-levels" data-levels={JSON.stringify(levels)}>
          <thead><tr><th>Sound</th><th>Kind</th>{SOUND_SETS.map((x) => <th key={x}>{x} (loudest, peak dB)</th>)}</tr></thead>
          <tbody>{Object.entries(levels).map(([name, by]) => (
            <tr key={name}><td>{name}</td><td>{SOUNDS[name as SoundName]}</td>{SOUND_SETS.map((x) => <td key={x}>{dB(by[x].loud)} / {dB(by[x].peak)}</td>)}</tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

const SAMPLE_TEAM = ['omen', 'sova', 'jett', 'killjoy', 'kayo'];

export function GalleryPage(_p: PageProps) {
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [n, setN] = useState(10);
  const [vol, setVol] = useState(60);
  const [text, setText] = useState('');
  const [color, setColor] = useState('#2F63D0');
  const [tab, setTab] = useState<'one' | 'two'>('one');
  const [count, setCount] = useState(120);
  const [focus, setFocus] = useState(-1);
  return (
    <>
      <PageHead eyebrow={<a href="#/help/about">Help</a>} title="Component gallery">Every control in the current theme.</PageHead>
      <div class="grid-2">
        <section class="panel stack">
          <h2>Buttons</h2>
          <div class="row wrap">
            <Button kind="primary" icon="planner">Primary</Button>
            <Button>Secondary</Button>
            <Button kind="soft">Soft</Button>
            <Button kind="quiet">Quiet</Button>
            <Button kind="danger" icon="trash">Danger</Button>
          </div>
          <div class="row wrap">
            <Button size="sm">Small</Button>
            <Button size="lg" kind="primary" kbd="enter">Large</Button>
            <Button busy>Busy</Button>
            <Button disabled>Disabled</Button>
            <IconButton icon="edit" label="Edit" />
            <IconButton icon="star" label="Pressed" pressed />
          </div>
        </section>
        <section class="panel stack">
          <h2>Fields</h2>
          <div class="row wrap"><Toggle checked={on} onChange={setOn} label="A toggle" /><Check checked={on} onChange={setOn} label="A check" /></div>
          <Segmented value={seg} onChange={setSeg} label="Choice" options={[['a', 'One'], ['b', 'Two'], ['c', 'Three']]} />
          <div class="row wrap">
            <Stepper value={n} min={3} max={30} onChange={setN} unit="comps" label="Comps" />
            <Select value={seg} onChange={setSeg} label="Select" options={[['a', 'One'], ['b', 'Two'], ['c', 'Three']]} />
          </div>
          <Slider value={vol} min={0} max={100} onChange={setVol} label="Volume" format={(v) => `${v}%`} />
          <TextInput value={text} onInput={setText} placeholder="Type here" label="Text" />
          <SearchInput value={text} onInput={setText} placeholder="Search" />
          <ColorField value={color} onChange={setColor} label="Color" />
        </section>
        <section class="panel stack">
          <h2>Fits and tiers</h2>
          <div class="row wrap">{TIERS.map((t) => <span key={t.id} class={`tier tier-${t.id.toLowerCase()}`}>{t.id}</span>)}</div>
          <div class="stack" style={{ gap: '8px' }}>
            {[100, 91, 82, 70, 40].map((f, i) => <Fit key={f} fit={f} tier={TIERS[i]!.id} label="Fit" />)}
          </div>
          <Bar value={0.35} label="Progress" />
          <Bar value={0.8} tone="good" size="thick" label="Progress" />
          <div class="row wrap" style={{ gap: '16px' }}>
            <Ring value={0.66} label="Ring">66%</Ring>
            <Ring value={1} tone="good" size={56} label="Ring"><Icon name="check" size={20} /></Ring>
            <div class="stat"><span class="value"><CountUp value={count} /></span><span class="label">Count up</span></div>
            <Button size="sm" onClick={() => setCount((c) => c + 37)}>+37</Button>
          </div>
          <div class="row wrap"><Badge>Plain</Badge><Badge tone="accent">Accent</Badge><Badge tone="good" icon="check">Good</Badge><Badge tone="warn">Warn</Badge><Badge tone="bad">Bad</Badge><Kbd k="ctrl+k" /></div>
        </section>
        <section class="panel stack">
          <h2>The game’s art</h2>
          <TeamIcons team={SAMPLE_TEAM} />
          <TeamIcons team={SAMPLE_TEAM} party={['jett', 'sova']} size={32} />
          <div class="row wrap">
            <AgentIcon id="hush" size={48} />
            {(['C', 'Q', 'E', 'X'] as const).map((k) => <AbilityIcon key={k} agent="omen" k={k} size={28} />)}
            {ROLE_IDS.map((r) => <RoleIcon key={r} role={r} size={24} />)}
          </div>
          <div class="row wrap"><MapThumb id="haven" /><MapThumb id="lotus" class="small" /></div>
        </section>
        <section class="panel stack">
          <h2>Minimap</h2>
          <div class="gallery-minimap">
            <Minimap map="haven" focus={focus} onFocus={setFocus} routes={[
              { route: ['Attacker Side Spawn', 'A Lobby', 'A Long', 'A Site'] },
              { route: ['Attacker Side Spawn', 'Mid Courtyard', 'C Link'] },
              { route: ['C Garage'] },
            ]} />
          </div>
        </section>
        <section class="panel stack">
          <h2>Overlays</h2>
          <div class="row wrap">
            <Button onClick={() => toast('Saved.', { tone: 'good' })}>Good message</Button>
            <Button onClick={() => toast('Plan deleted.', { action: { label: 'Undo', run: () => toast('This is only a sample, so nothing was deleted.') } })}>With an action</Button>
            <Button onClick={() => toast('Something went wrong.', { tone: 'bad' })}>Bad message</Button>
          </div>
          <div class="row wrap">
            <Button onClick={() => void confirm({ title: 'Delete this plan?', body: 'Its note goes too. You can undo this.', yes: 'Delete plan', danger: true })}>Confirm</Button>
            <Button onClick={() => void prompt({ title: 'Rename', label: 'Name', yes: 'Rename', value: 'Haven retakes' })}>Prompt</Button>
            <Button icon="more" onClick={(e) => openMenu(e, [{ label: 'Edit', icon: 'edit', run: () => {} }, { label: 'Copy', icon: 'copy', kbd: 'c', run: () => {} }, 'divider', { label: 'Delete', icon: 'trash', danger: true, run: () => {} }])}>Menu</Button>
          </div>
          <Tabs value={tab} onChange={setTab} label="Tabs" tabs={[['one', 'First tab'], ['two', 'Second tab']]} />
        </section>
        <section class="panel stack" style={{ gridColumn: '1 / -1' }}>
          <h2>Sounds</h2>
          <div class="row wrap">{(Object.keys(SOUNDS) as SoundName[]).map((s) => <Button key={s} size="sm" sound={false} onClick={() => play(s)}>{s}</Button>)}</div>
          <SoundLevels />
        </section>
        <section class="panel stack" style={{ gridColumn: '1 / -1' }}>
          <h2>Icons</h2>
          <div class="icon-grid">{(Object.keys(ICONS) as IconName[]).map((i) => <span key={i} title={i}><Icon name={i} size={22} /><small>{i}</small></span>)}</div>
        </section>
        <section class="panel" style={{ gridColumn: '1 / -1' }}>
          <Empty title="Nothing here yet" actions={<Button kind="primary" icon="plus">Add something</Button>}>Empty states look like this.</Empty>
        </section>
      </div>
    </>
  );
}

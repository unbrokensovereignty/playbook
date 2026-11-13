/**
 * Setting up: your rank, how you queue and the agents you play, which the Planner and Rankings
 * start from (Settings → You). The app asks as it opens for the first time; someone who used it
 * before this was asked gets a card on Home instead. Either way it's asked once, and each answer
 * can be changed later in Settings.
 */
import { useState } from 'preact/hooks';
import { Button, Field, Segmented, Select } from './components/controls.tsx';
import { DialogLayout } from './components/overlays.tsx';
import { AgentChips } from './components/pickers.tsx';
import { Icon } from './icons.tsx';
import { restoreFromFile } from './backup.tsx';
import { data, dialogs, openDialog, safely, tabRole, watch } from './state.ts';
import { play } from './sound.ts';
import { question } from './planner/store.ts';
import { SETTINGS } from '../core/settings.ts';

/** The setup hasn't been done or put off yet, and this tab is the one that saves. */
export const setupDue = (): boolean => tabRole.value !== 'reader' && !data().app().welcomed;

/** Remembers that the setup was done or put off, so it isn't asked again. */
function welcomed() {
  const r = data();
  if (!r.db.readOnly && !r.app().welcomed) safely(() => r.updateApp({ welcomed: true }));
}

function Setup({ title, close }: { title: string; close: (v?: unknown) => void }) {
  const s = data().settings();
  const [rank, setRank] = useState(s.defaultRank);
  const [party, setParty] = useState(s.usualParty);
  const [agents, setAgents] = useState<readonly string[]>(s.myAgents);
  const { defaultRank, usualParty, myAgents } = SETTINGS;
  const done = () => {
    safely(() => {
      const r = data();
      r.setSettings({ defaultRank: rank, usualParty: party, myAgents: agents }, 'Set up Playbook');
      // the Planner's next question starts from these
      if (!r.app().draft) question.value = null;
    });
    play('saved');
    close(true);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); done(); }}>
      <DialogLayout title={title} icon="crosshair" close={() => close()} foot={<>
        {title === WELCOME && <Button kind="quiet" icon="import" class="setup-restore" onClick={() => { close(); void restoreFromFile(); }}>Restore a backup</Button>}
        <Button kind="quiet" onClick={() => close()}>Skip</Button>
        <Button kind="primary" type="submit" sound={false}>Done</Button>
      </>}>
        <div class="stack setup">
          <p>Tell Playbook how you play, and every plan starts from there. You can change any of it later in Settings.</p>
          {title === WELCOME && <p class="small muted">Used Playbook before, in another browser or on another computer? Restore a backup to bring your plans along.</p>}
          <Field label={defaultRank.label} help={defaultRank.help} for="setup-rank">
            <Select id="setup-rank" label={defaultRank.label} value={rank} onChange={setRank} options={defaultRank.options} />
          </Field>
          <Field label={usualParty.label} help={usualParty.help}>
            <Segmented label={usualParty.label} value={party} onChange={setParty} options={usualParty.options} />
          </Field>
          <Field label={myAgents.label} help={`${myAgents.help} Leave it empty to plan with anyone.`}>
            <AgentChips ids={agents} empty="Choose agents" onChange={setAgents} o={{ title: myAgents.label, max: myAgents.max, line: myAgents.help }} />
          </Field>
        </div>
      </DialogLayout>
    </form>
  );
}

const WELCOME = 'Welcome to Playbook';

/** Asks how you play. Whatever the answer, or none, it isn't asked again (Settings → You has it all). */
export async function openSetup(title = WELCOME): Promise<void> {
  await openDialog<boolean>(title, (close) => <Setup title={title} close={close} />);
  welcomed();
}

/** On Home, for someone who used the app before it asked: the offer to set it up. */
export function SetupOffer() {
  watch('meta');
  if (!setupDue() || dialogs.value.some((d) => d.label === WELCOME)) return null;
  return (
    <aside class="tour-offer panel" aria-label="Set up Playbook">
      <span class="tour-offer-icon"><Icon name="crosshair" size={22} /></span>
      <div class="grow">
        <b>Tell Playbook how you play</b>
        <p class="small muted">The Planner and Rankings start from your rank, how you queue and the agents you play.</p>
      </div>
      <div class="row">
        <Button size="sm" kind="quiet" onClick={welcomed}>Not now</Button>
        <Button size="sm" kind="primary" onClick={() => void openSetup('Tell Playbook how you play')}>Set up</Button>
      </div>
    </aside>
  );
}

// Runs the unit tests in time zones chosen to catch date bugs: daylight-saving switches (including a
// half-hour one), the date line on both sides, and zones with :30 and :45 offsets.
import { spawnSync } from 'node:child_process';

const ZONES = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin',
  'Asia/Kolkata', 'Asia/Kathmandu', 'Australia/Lord_Howe', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
let failed = 0;
for (const tz of ZONES) {
  const r = spawnSync('npm', ['test', '--silent'], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
  const ok = r.status === 0;
  const summary = (r.stdout.match(/^# (pass|fail) \d+$/gm) || []).join(', ');
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${tz.padEnd(22)} ${summary}`);
  if (!ok) { failed++; process.stdout.write(r.stdout.split('\n').filter((l) => /not ok|Error|expected|actual/.test(l)).slice(0, 30).join('\n') + '\n'); }
}
if (failed) { console.error(`${failed} time zone${failed === 1 ? '' : 's'} failed.`); process.exit(1); }

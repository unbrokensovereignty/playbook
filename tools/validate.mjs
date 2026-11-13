// Prints how the engine's answers compare with pro play, held out an event at a time, and the
// expert claims register: node --experimental-strip-types tools/validate.mjs
// With --sample, prints the 180 answers for the graded review instead (docs/VALIDATION.md).
import { checkHeldOut, checkPro, checkProWithoutPull, means } from '../tests/validation/pro.ts';
import { CLAIMS } from '../tests/validation/claims.ts';
import { sample } from '../tests/validation/sample.ts';

if (process.argv.includes('--sample')) {
  console.log(sample().join('\n'));
  process.exit(0);
}

const fmt = (x) => x.toFixed(2);
for (const [label, rows] of [['With the pro pull', checkPro()], ['Without the pro pull', checkProWithoutPull()], ['Held out, with the pro pull', checkHeldOut()], ['Held out, without the pro pull', checkHeldOut('radiant', 3, 10, false)]]) {
  console.log(`\n${label} (Radiant)`);
  for (const r of rows) console.log(`  ${r.event.padEnd(9)} ${r.map.padEnd(9)} ${String(r.maps).padStart(2)} maps  top comp at ${r.topAt || '-'}  shares ${r.shared}  order ${fmt(r.order)}  controllers ${r.ctrlBest}/${r.ctrlPro}  best: ${r.best.join(' ')}`);
  const m = means(rows);
  console.log(`  ${m.maps} maps: top comp in the top 10 on ${m.inTop}, shares ${fmt(m.shared)}, order ${fmt(m.order)}, controllers right on ${m.ctrl}`);
}

console.log('\nExpert claims register');
let held = 0, checked = 0;
for (const c of CLAIMS) {
  if (!c.check) { console.log(`  review ${c.id}: ${c.note ?? ''}`); continue; }
  checked++;
  const r = c.check();
  if (r === true) held++; else console.log(`  MISS   ${c.id}: ${r || 'no'}`);
}
console.log(`  ${held} of ${checked} checked claims hold (${CLAIMS.length} claims in all)`);

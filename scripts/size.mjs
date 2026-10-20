import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGETS = [
  { match: /^loader\.js$/, name: 'loader', kb: 2.5 },
  { match: /^core-.*\.js$/, name: 'core', kb: 25 },
];

let failed = false;
for (const file of readdirSync('dist')) {
  const budget = BUDGETS.find((b) => b.match.test(file));
  if (!budget) continue;
  const kb = gzipSync(readFileSync(`dist/${file}`)).length / 1024;
  const ok = kb <= budget.kb;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${budget.name.padEnd(7)} ${kb.toFixed(1)} KB / ${budget.kb} KB  ${file}`);
}
process.exit(failed ? 1 : 0);

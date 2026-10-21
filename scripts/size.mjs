import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGETS = [
  { match: /^loader\.js$/, name: 'loader', kb: 2.5 },
  { match: /^core-.*\.js$/, name: 'core', kb: 25 },
  { match: /^analytics-.*\.js$/, name: 'analytics', kb: 8 },
  { match: /^exit-intent-.*\.js$/, name: 'exit-intent', kb: 3 },
  { match: /^checkout-.*\.js$/, name: 'checkout', kb: 30 },
  { match: /^order-.*\.js$/, name: 'order', kb: 10 },
  { match: /^slots-.*\.js$/, name: 'slots', kb: 6 },
  { match: /^widgets-.*\.js$/, name: 'widgets', kb: 3 },
  { match: /^debug-.*\.js$/, name: 'debug', kb: 30 },
  { match: /^campaign-cart\.css$/, name: 'css (0.4.x)', kb: 6 },
];

const files = readdirSync('dist');
let failed = false;
for (const budget of BUDGETS) {
  const matches = files.filter((f) => budget.match.test(f));
  if (matches.length !== 1) {
    console.log(`MISSING ${budget.name}: expected one file, found ${matches.length}`);
    failed = true;
    continue;
  }
  const kb = gzipSync(readFileSync(`dist/${matches[0]}`)).length / 1024;
  const ok = kb <= budget.kb;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${budget.name.padEnd(11)} ${kb.toFixed(1)} KB / ${budget.kb} KB  ${matches[0]}`);
}
process.exit(failed ? 1 : 0);

/**
 * Generates a reference for the `data-next-display` / `data-next-show` expression
 * vocabulary, derived from PROPERTY_MAPPINGS in DisplayEnhancerTypes.ts.
 *
 * For each `object.property` expression it reports the VALUE TYPE the SDK renders
 * (explicit `format` from the map, else name-based detection that mirrors
 * DisplayEnhancerCore.getDefaultFormatType) and the underlying data path.
 *
 * Run: npm run docs:expressions  (also runs automatically before `npm run docs`).
 */
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = 'src/enhancers/display/DisplayEnhancerTypes.ts';
const OUT = 'src/enhancers/display/expressions.generated.md';

// DisplayEnhancerTypes.ts has no imports, so transpiling it in isolation and
// importing the result gives us the real PROPERTY_MAPPINGS object (no parsing).
const { code } = await esbuild.transform(readFileSync(SRC, 'utf8'), {
  loader: 'ts',
  format: 'esm',
});
const tmp = join(mkdtempSync(join(tmpdir(), 'exprgen-')), 'mod.mjs');
writeFileSync(tmp, code);
const { PROPERTY_MAPPINGS } = await import(pathToFileURL(tmp).href);

/**
 * Mirror of DisplayEnhancerCore.getDefaultFormatType name-based detection.
 * Keep in sync with src/enhancers/display/DisplayEnhancerCore.ts.
 */
function detectFormat(name) {
  const p = name.toLowerCase();
  if (p.endsWith('.raw')) return 'auto';
  if (
    p.includes('percentage') ||
    p.includes('percent') ||
    p.endsWith('pct') ||
    p.endsWith('rate')
  )
    return 'percentage';
  const currency = [
    'price', 'cost', 'amount', 'total', 'subtotal', 'retail', 'compare',
    'savings', 'shipping', 'tax', 'discount', 'fee', 'charge', 'payment',
    'balance', 'credit', 'debit', 'refund', 'revenue', 'msrp', 'value',
  ];
  if (currency.some((t) => p.includes(t))) return 'currency';
  if (
    p.startsWith('is') || p.startsWith('has') || p.startsWith('can') ||
    p.startsWith('should') || p.startsWith('enabled') || p.startsWith('disabled') ||
    p.includes('visible') || p.includes('active')
  )
    return 'boolean';
  if (p.includes('date') || p.includes('time') || p.endsWith('at') || p.endsWith('on'))
    return 'date';
  if (
    p.includes('quantity') || p.includes('count') || p.includes('qty') ||
    p.includes('units') || p.includes('items')
  )
    return 'number';
  return 'auto';
}

const out = [];
out.push('---');
out.push('title: Display Expressions');
out.push('---');
out.push('');
out.push('# Display & Conditional Expressions');
out.push('');
out.push(
  'Auto-generated from `PROPERTY_MAPPINGS` in `src/enhancers/display/DisplayEnhancerTypes.ts` — do not edit by hand; run `npm run docs:expressions`.'
);
out.push('');
out.push(
  'Each row is an expression you write as `object.property`. Use it as a value in `data-next-display="…"`, or (for `boolean` rows) as a condition in `data-next-show` / `data-next-hide`. **Value type** is how the SDK formats the resolved value: the explicit `format` from the map, otherwise inferred from the property name.'
);
out.push('');

let total = 0;
for (const [obj, props] of Object.entries(PROPERTY_MAPPINGS)) {
  out.push(`## \`${obj}.*\``);
  out.push('');
  out.push('| Expression | Value type |');
  out.push('|---|---|');
  for (const [name, def] of Object.entries(props)) {
    if (name === '_expression') continue;
    let fmt;
    if (typeof def === 'string') {
      fmt = detectFormat(name);
    } else if (def && typeof def === 'object') {
      fmt = def.format ?? detectFormat(name);
    } else {
      continue;
    }
    out.push(`| \`${obj}.${name}\` | \`${fmt}\` |`);
    total++;
  }
  out.push('');
}

// Parameterized conditional functions — these are NOT in PROPERTY_MAPPINGS; they
// are handled in ConditionalDisplayEnhancer.evaluateFunction and take arguments
// (call syntax). Curated from that switch; keep in sync with
// src/enhancers/display/ConditionalDisplayEnhancer.ts.
out.push('## Conditional functions (`data-next-show` / `data-next-hide`)');
out.push('');
out.push(
  'These take an argument (call syntax) and return a boolean. They are evaluated by `ConditionalDisplayEnhancer` — they are **not** `data-next-display` value paths and are **not** TypeScript methods.'
);
out.push('');
out.push('| Expression | Returns | Description |');
out.push('|---|---|---|');
out.push(
  '| `cart.hasCoupon("CODE")` | `boolean` | True when coupon `CODE` is currently applied (matched case-insensitively). |'
);
out.push(
  '| `cart.hasCoupon` | `boolean` | True when **any** coupon is applied (bare form, no argument). |'
);
out.push(
  '| `cart.hasItem(packageId)` | `boolean` | True when the given package id is in the cart, e.g. `cart.hasItem(2)`. |'
);
out.push(
  '| `cart.hasItems` | `boolean` | True when the cart is not empty. |'
);
out.push('');
out.push(
  'Display values can also be combined with comparison operators in conditions, e.g. `data-next-show="cart.total > 100"` or `data-next-hide="package.qty == 1"`.'
);
out.push('');

writeFileSync(OUT, out.join('\n'));
console.log(`Wrote ${OUT} — ${total} expressions across ${Object.keys(PROPERTY_MAPPINGS).length} objects, plus conditional functions`);

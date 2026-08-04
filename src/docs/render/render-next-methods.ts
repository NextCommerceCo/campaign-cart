/**
 * Renders the two scriptable-API pages under `src/core/guide/reference/`:
 * `javascript-api.md` (every `window.next` call) and `window-surface.md` (every
 * global the SDK installs or reads).
 *
 * Signatures, source lines and the `nextDebug` key list come from the extractor
 * rather than from the manifest, so the published page cannot disagree with the code
 * about a type or a location. Prose comes from `next-methods.ts`. Neither half can
 * produce a page on its own, which is the point: a new method has no prose and fails
 * the drift test, and prose for a deleted method has no signature and fails it too.
 *
 * Pages are grouped by the job a reader is doing, never by TypeScript kind —
 * `.claude/rules/documentation.md` §2 rules out a class-shaped member dump.
 *
 * Build-time only — see the note on {@link NEXT_METHODS}.
 */

import { coreNav } from '../content/nav';
// Aliased: `anchor` below is a GitHub heading slug, a different thing entirely.
import { anchor as sourceAnchor } from '../extract/source-anchor';
import type {
  CartOperationDoc,
  NextMethodDoc,
  NextMethodGroup,
  WindowAudience,
  WindowGlobalDoc,
} from '../content/next-methods';

/** The shape the extractor hands over. Kept structural so this file has no test import. */
export interface RenderedMember {
  name: string;
  kind: 'method' | 'getter' | 'property';
  isStatic: boolean;
  signature: string;
  /** `NextCommerce.addItem` — the symbol to cite, rather than a line that moves. */
  symbol: string;
}

/** A `CartOperations` member's real call signature. */
export interface RenderedCallable {
  name: string;
  signature: string;
}

/** What the extractor found on `window`, keyed by property name. */
export interface RenderedGlobal {
  name: string;
  keys: string[];
  sites: string[];
}

const GENERATED = (readFrom: string): string =>
  '<!-- Generated. Do not edit by hand: edit src/docs/content/next-methods.ts\n' +
  `     for the prose, or ${readFrom} for what is inventoried, then run\n` +
  '     `UPDATE_DOCS=1 npx vitest run src/tests/docs/nextMethods.test.ts`. -->';

const SOURCE_FILE = 'src/core/next-commerce/next-commerce.ts';

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/** A GitHub-style anchor for a `### \`next.addItem()\`` heading. */
function anchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[`().,:|]/g, '')
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** `| a | b |` is broken by a `|` inside a type — escape it. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

/** How a reader writes the call, for the heading. */
function callName(member: RenderedMember): string {
  const owner = member.isStatic ? 'NextCommerce' : 'next';
  const parens = member.kind === 'method' ? '()' : '';
  return `${owner}.${member.name}${parens}`;
}

function fence(code: string, language = 'ts'): string {
  return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
}

// ── javascript-api.md ───────────────────────────────────────────────────────

export interface JavaScriptApiInput {
  groups: NextMethodGroup[];
  methods: NextMethodDoc[];
  /** Every public member of `NextCommerce`, from the source. */
  members: RenderedMember[];
  cartOperations: CartOperationDoc[];
  /** Every `CartOperations` member's signature, from the source. */
  cartSignatures: RenderedCallable[];
}

export function renderJavaScriptApi(input: JavaScriptApiInput): string {
  const { groups, methods, members, cartOperations, cartSignatures } = input;
  const byName = new Map(members.map(m => [m.name, m]));

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'JavaScript API')}# JavaScript API — \`window.next\`\n\n${GENERATED(SOURCE_FILE)}`,
    'Everything a page can ask the SDK to do from JavaScript. The SDK builds one ' +
      'instance of itself during boot and assigns it to `window.next`, so there is nothing ' +
      'to construct and nothing to import — on a page that loads the SDK from the loader ' +
      'script, `next` is the whole entry point.',
    'This page is the scriptable counterpart to the `data-next-*` attributes: anything ' +
      'you can turn on with markup, you can also drive from code here. For the attributes ' +
      'themselves see the [attribute index](../../../../docs/attribute-index.md); for the ' +
      'shape of the objects these calls return, see the SDK reference generated from the ' +
      'source types.',
    blocks(
      '> **Wait for boot before your first call.** `window.next` does not exist until the ' +
        'SDK has initialised, so a script that runs earlier will throw on `next.anything`. ' +
        'Push your code onto `window.nextReady` instead — it runs immediately once the SDK ' +
        'is up, and queues if it is not:',
      fence(`window.nextReady = window.nextReady || [];
window.nextReady.push(sdk => {
  console.log('SDK', sdk.getVersion(), 'ready with', sdk.getCartCount(), 'items');
});`),
      'Details in [the window surface](./window-surface.md).'
    ),
  ];

  // ── What you can do ───────────────────────────────────────────────────────
  const groupMembers = new Map<string, NextMethodDoc[]>();
  for (const group of groups) {
    groupMembers.set(
      group.id,
      methods.filter(m => m.group === group.id)
    );
  }

  parts.push(
    '## What you can do',
    `${groups.length} jobs, and the calls that do them. Follow a row to its section for ` +
      'the signature, a runnable example, and what to watch out for.',
    [
      '| Job | Calls |',
      '|---|---|',
      ...groups.map(group => {
        const own = groupMembers.get(group.id) ?? [];
        const names = own
          .map(d => {
            const member = byName.get(d.name);
            const label = member ? callName(member) : `next.${d.name}`;
            return `[\`${label}\`](#${anchor(label)})`;
          })
          .join(', ');
        return `| **[${group.title}](#${anchor(group.title)})** | ${names} |`;
      }),
    ].join('\n')
  );

  // ── Per-group detail ──────────────────────────────────────────────────────
  for (const group of groups) {
    const own = groupMembers.get(group.id) ?? [];
    if (!own.length) continue;
    parts.push(`## ${group.title}`, group.intro);

    for (const doc of own) {
      const member = byName.get(doc.name);
      const label = member ? callName(member) : `next.${doc.name}`;
      parts.push(
        `### \`${label}\``,
        member ? fence(member.signature) : undefined,
        doc.summary,
        doc.returns ? `**Returns:** ${doc.returns}` : undefined,
        fence(doc.example),
        doc.caution ? `> ⚠️ ${doc.caution}` : undefined,
        member
          ? `<sub>Source: \`${sourceAnchor(SOURCE_FILE, member.symbol)}\`</sub>`
          : undefined
      );
    }
  }

  // ── next.cart ─────────────────────────────────────────────────────────────
  const cartSigByName = new Map(cartSignatures.map(c => [c.name, c.signature]));
  parts.push(
    '## What `next.cart` can do',
    'The object [`next.cart`](#nextcart) returns. `swapPackage`, `calculateTotals` and ' +
      '`refreshItemPrices` have no shortcut on `next` itself, so this is their only route.',
    [
      '| Call | Effect |',
      '|---|---|',
      ...cartOperations.map(op => {
        const signature = cartSigByName.get(op.name) ?? op.name;
        return `| \`${cell(signature)}\` | ${op.effect} |`;
      }),
    ].join('\n'),
    'These carry the pricing, validation and event logic. Writing to the cart store ' +
      'directly skips all of it — see the [cart store reference](../../../state/cart/guide/reference/state-reference.md).'
  );

  // ── Cautions ──────────────────────────────────────────────────────────────
  parts.push(
    '## Cautions',
    [
      '- **`window.next` is late.** It is assigned near the end of boot. Any call from a ' +
        'script that runs earlier throws `Cannot read properties of undefined` — use ' +
        '`window.nextReady.push()`.',
      '- **A `null` from a campaign lookup is ambiguous.** `getCampaignData()`, ' +
        '`getPackage()` and the variant lookups all return `null` both for "not found" and ' +
        'for "the campaign has not loaded yet". Do your reads inside a `campaign:loaded` ' +
        'handler, or check `getCampaignData()` first.',
      '- **Some calls report failure, others throw.** `applyCoupon()` resolves with ' +
        '`{ success: false }`; `setShippingMethod()` and `addUpsell()` throw. A bare `await` ' +
        'on the first looks like success.',
      '- **`addItem()` with no `packageId` does nothing** — no throw, no warning. If an add ' +
        'never lands, log the id you passed.',
      '- **The `track*` calls double-count.** The SDK already tracks the standard funnel. ' +
        'Adding your own call for the same step reports it twice.',
      '- **Handlers are never cleaned up for you.** `on()` and `registerCallback()` need a ' +
        'matching `off()` / `unregisterCallback()` with the *same function reference*, or ' +
        'handlers accumulate across view changes.',
      '- **Cart money is `Decimal`, not `number`.** `subtotal`, `total`, `totalDiscount` ' +
        'and `totalDiscountPercentage` are decimal.js instances, so `-`, `+` and `>` on ' +
        'them give `NaN` or a string comparison. Use `.minus()`, `.plus()`, `.gt()`, and ' +
        '`.toNumber()` at the boundary.',
      '- **`trackSignUp()` and `trackLogin()` send the email address in the clear.** ' +
        'Nothing hashes it before it reaches your providers.',
    ].join('\n')
  );

  return `${blocks(...parts)}\n`;
}

// ── window-surface.md ──────────────────────────────────────────────────────

export interface WindowSurfaceInput {
  groups: Array<{ audience: WindowAudience; title: string; intro: string }>;
  globals: WindowGlobalDoc[];
  /** Globals the SDK assigns, from the source. */
  installs: RenderedGlobal[];
  /** SDK-namespaced globals the SDK only reads, from the source. */
  reads: Array<{ name: string; sites: string[] }>;
}

/** `stores.cart` → grouped under `stores`, so 49 keys read as 12 tools. */
function renderKeyTree(keys: string[]): string {
  const top = keys.filter(k => !k.includes('.'));
  const lines: string[] = [];
  for (const key of top) {
    const children = keys
      .filter(k => k.startsWith(`${key}.`))
      .map(k => k.slice(key.length + 1));
    lines.push(
      children.length
        ? `- \`${key}\` — ${children.map(c => `\`${c}\``).join(', ')}`
        : `- \`${key}\``
    );
  }
  // A nested-only key would otherwise vanish from the list entirely.
  for (const key of keys) {
    if (!key.includes('.')) continue;
    const parent = key.slice(0, key.indexOf('.'));
    if (!top.includes(parent)) lines.push(`- \`${key}\``);
  }
  return lines.join('\n');
}

export function renderWindowSurface(input: WindowSurfaceInput): string {
  const { groups, globals, installs, reads } = input;
  const installByName = new Map(installs.map(g => [g.name, g]));
  const readByName = new Map(reads.map(g => [g.name, g]));

  const total = installs.length + reads.length;

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'Window Surface')}# The \`window\` surface\n\n${GENERATED('the source under src/core and src/features')}`,
    `Loading the SDK puts ${installs.length} names on \`window\` and reads ` +
      `${reads.length} more that your page sets — ${total} in total. Most of them are not ` +
      'part of the API you should build on, and knowing which is which is the point of ' +
      'this page: a name that only exists in debug mode, or that the SDK deletes halfway ' +
      'through boot, will work when you try it in a console and fail in production.',
    'Every entry below is read out of the source, so the list cannot fall behind the ' +
      'code. The calls on `window.next` itself are documented separately, in the ' +
      '[JavaScript API](./javascript-api.md).',
    [
      '| | Meaning |',
      '|---|---|',
      '| **install** | The SDK assigns this. It exists because the SDK is on the page. |',
      '| **read** | Your page assigns it and the SDK reads it. Setting it is how you configure the SDK. |',
    ].join('\n'),
  ];

  // ── Index ─────────────────────────────────────────────────────────────────
  parts.push(
    '## Everything at a glance',
    [
      '| Global | Direction | In the code |',
      '|---|---|---|',
      ...groups.flatMap(group =>
        globals
          .filter(g => g.audience === group.audience)
          .map(g => {
            const entry = installByName.get(g.name) ?? readByName.get(g.name);
            const sites = entry?.sites.length
              ? entry.sites.length > 2
                ? `\`${entry.sites[0]}\` and ${entry.sites.length - 1} more`
                : entry.sites.map(s => `\`${s}\``).join(', ')
              : g.covers?.length
                ? `${g.covers.length} names, see below`
                : '—';
            return `| [\`window.${g.name}\`](#window${anchor(g.name)}) | ${g.direction} | ${sites} |`;
          })
      ),
    ].join('\n')
  );

  // ── Per-audience detail ───────────────────────────────────────────────────
  for (const group of groups) {
    const own = globals.filter(g => g.audience === group.audience);
    if (!own.length) continue;
    parts.push(`## ${group.title}`, group.intro);

    for (const doc of own) {
      const install = installByName.get(doc.name);
      const entry = install ?? readByName.get(doc.name);
      const covered = doc.covers?.length
        ? `Covers ${doc.covers.length} names: ${doc.covers.map(c => `\`${c}\``).join(', ')}.`
        : undefined;
      const sites = doc.covers?.length
        ? // A family's sites are one line each; the count is the useful fact.
          undefined
        : entry?.sites.length
          ? `<sub>${doc.direction === 'install' ? 'Assigned' : 'Read'} in ${entry.sites
              .map(s => `\`${s}\``)
              .join(', ')}</sub>`
          : undefined;

      parts.push(
        `### \`window.${doc.name}\``,
        doc.summary,
        covered,
        doc.example ? fence(doc.example, doc.language) : undefined,
        install?.keys.length
          ? blocks('**What is on it:**', renderKeyTree(install.keys))
          : undefined,
        doc.caution ? `> ⚠️ ${doc.caution}` : undefined,
        sites
      );
    }
  }

  // ── Cautions ──────────────────────────────────────────────────────────────
  parts.push(
    '## Cautions',
    [
      '- **Only four names are supported page API:** `next` and `nextReady`, which the SDK ' +
        'installs, plus the two it reads — `nextConfig`, which you set, and ' +
        '`__NEXT_SDK_VERSION__`, which the loader sets. Everything else is an integration ' +
        'seam or a debug tool and may change in a patch release.',
      '- **`nextReady` changes type during boot** — an array before, an object with `push` ' +
        'after. Only ever call `push` on it.',
      '- **`nextDebug` hands out the raw stores.** A `setState` on one bypasses the cart ' +
        'operations, so totals and analytics stop matching the visible cart. Read through ' +
        'it, write through `next.*`.',
      '- **`nextDebug` is absent when debug mode is off,** so a snippet developed against ' +
        'it fails silently in production. Gate on `window.nextDebug` or, better, do not ' +
        'ship it.',
      '- **The `_nextForce*` globals are consumed and deleted** (all but ' +
        '`_nextForceBundleId`). Reading one back after boot tells you nothing about whether ' +
        'it took effect.',
      '- **`window.fetch` is wrapped in debug mode** and never restored. Anything else on ' +
        "the page that wraps `fetch` will be wrapping the SDK's wrapper.",
      '- **Never reassign `dataLayer`.** The SDK and the tag manager share the array by ' +
        'reference; replacing it orphans every event already queued.',
    ].join('\n')
  );

  return `${blocks(...parts)}\n`;
}

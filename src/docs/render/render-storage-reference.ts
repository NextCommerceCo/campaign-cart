/**
 * Renders the storage-key registry into `core/guide/reference/storage-keys.md`.
 *
 * The keys, their store and their source location come from the extractor; what each
 * one holds and what clearing it costs comes from {@link STORAGE_KEYS_DOC}. Neither
 * half is copied into the other, which is what lets the drift test check them against
 * each other.
 *
 * Build-time only — see the note on {@link StorageKeyDoc}.
 */

import { coreNav } from '../content/nav';
import type {
  ExpiryMechanism,
  StorageKeyDoc,
  StoreId,
  UnscannableStorageKeyDoc,
} from '../content/storage-keys';
import { STORAGE_GROUPS } from '../content/storage-keys';

/** What the extractor found for one key — the half this file must not invent. */
export interface ExtractedKeyFacts {
  /** `sessionStorage` / `localStorage`, or both. Empty when nothing touches it. */
  areas: string[];
  /** First site, `state/cart/cart.state.ts:84` style. */
  firstSite: string;
  /** How many places touch it, so a reader knows whether it is one owner or many. */
  siteCount: number;
}

const GENERATED =
  '<!-- Generated from the storage-key registry. Do not edit by hand:\n' +
  '     edit src/docs/content/storage-keys.ts, then run `npm run docs:reference`. -->';

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/** A union type or a pipe in prose would end a table cell early. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** `sessionStorage` → `session`, so the column stays narrow and scannable. */
function areaLabel(areas: string[]): string {
  if (areas.length === 0) return '— never written';
  return areas
    .map(a => (a === 'sessionStorage' ? '`session`' : '`local`'))
    .join(' + ');
}

/**
 * The lifetime, said once. When the code applies no expiry the answer follows from
 * which store it is in, so it is derived here rather than repeated in 40 rows.
 */
function lifetime(doc: StorageKeyDoc, areas: string[]): string {
  if (doc.ttl) {
    return doc.ttlMechanism ? `${doc.ttl}<br>via ${doc.ttlMechanism}` : doc.ttl;
  }
  if (areas.length === 0) return 'n/a';
  if (areas.includes('localStorage') && areas.includes('sessionStorage')) {
    return 'none — the `session` copy dies with the tab, the `local` copy does not';
  }
  if (areas.includes('localStorage')) {
    return 'none — stays until something clears it';
  }
  return 'none — gone when the tab closes';
}

/** Said in the reader's terms: what they will find inside the value. */
const RELATION: Record<NonNullable<StorageKeyDoc['storeRelation']>, string> = {
  'persist-key':
    "Zustand `persist` writes the whole store here, so the value is the store's own shape (minus anything its `partialize` drops).",
  'manual-cache':
    "The store caches to it by hand — no `persist` involved — so the value is a fixed cache envelope, not the store's shape.",
  'side-write':
    'The store writes this alongside its own persist key, so the value is a single bare value rather than a store snapshot.',
};

/** Store guides live at `state/<id>/guide/reference/state-reference.md`. */
function storeLink(store: StoreId): string {
  return `[\`${store}\`](../../../state/${store}/guide/reference/state-reference.md)`;
}

function keyCell(
  doc: StorageKeyDoc,
  facts: ExtractedKeyFacts | undefined
): string {
  const parts = [`\`${doc.key}\``];
  if (doc.examples?.length) {
    parts.push(`e.g. ${doc.examples.map(e => `\`${e}\``).join(', ')}`);
  }
  if (facts) {
    const more = facts.siteCount > 1 ? ` +${facts.siteCount - 1} more` : '';
    parts.push(`<sub>${facts.firstSite}${more}</sub>`);
  }
  return parts.join('<br>');
}

function meaningCell(doc: StorageKeyDoc): string {
  const parts = [doc.holds, `**Clearing it:** ${doc.clearing}`];
  if (doc.store) parts.push(`Store: ${storeLink(doc.store)}.`);
  if (doc.notes) parts.push(`⚠️ ${doc.notes}`);
  return parts.map(cell).join('<br><br>');
}

function groupTable(
  docs: StorageKeyDoc[],
  facts: Map<string, ExtractedKeyFacts>
): string {
  return [
    '| Key | Lives in | Expires | What it holds |',
    '|---|---|---|---|',
    ...docs.map(doc => {
      const found = facts.get(doc.key);
      const areas = found?.areas ?? [];
      return `| ${keyCell(doc, found)} | ${areaLabel(areas)} | ${cell(
        lifetime(doc, areas)
      )} | ${meaningCell(doc)} |`;
    }),
  ].join('\n');
}

function expiryTable(mechanisms: ExpiryMechanism[]): string {
  return [
    '| Window | Where it is written | Governs |',
    '|---|---|---|',
    ...mechanisms.map(
      // `m.name` is code-ish but not always a bare identifier, so it is not wrapped
      // in backticks here — one of them contains its own, and nested backticks
      // published as ``prospect cart `expires_at``` rendered as mush.
      m =>
        `| ${cell(m.window)} | ${cell(m.name)}<br><sub>${m.file}</sub> | ${cell(
          m.governs
        )} |`
    ),
  ].join('\n');
}

function unscannableTable(
  docs: UnscannableStorageKeyDoc[],
  facts: Map<string, ExtractedKeyFacts>
): string {
  return [
    '| Key | Lives in | Expires | What it holds | Why it is hand-written |',
    '|---|---|---|---|---|',
    ...docs.map(
      doc =>
        `| ${keyCell(doc, facts.get(doc.key))} | ${areaLabel(doc.areas)} | ${cell(
          lifetime(doc, doc.areas)
        )} | ${meaningCell(doc)} | ${cell(doc.invisibleBecause)}<br><sub>${
          doc.file
        }</sub> |`
    ),
  ].join('\n');
}

export interface RenderStorageInput {
  docs: StorageKeyDoc[];
  unscannable: UnscannableStorageKeyDoc[];
  mechanisms: ExpiryMechanism[];
  /** Extractor output, keyed by the documented key. */
  facts: Map<string, ExtractedKeyFacts>;
}

export function renderStorageReference(input: RenderStorageInput): string {
  const { docs, unscannable, mechanisms, facts } = input;

  // A key that is *nothing but* a token — `{attributionParameter}` — has no fixed
  // part to match on, so listing it here would tell a reader nothing. Those are
  // covered by the hand-written section, which shows their real names.
  const dynamic = [...docs, ...unscannable].filter(
    d => /\{[^}]*\}/.test(d.key) && d.key.replace(/\{[^}]*\}/g, '') !== ''
  );
  const owned = docs.filter(d => d.store);

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'Storage Keys')}# Storage keys\n\n${GENERATED}`,

    'Every sessionStorage and localStorage entry the SDK reads or writes: what is ' +
      'inside it, how long it lives, and what the visitor loses if it goes. Use it ' +
      'when a cart came back empty, a page is priced in the wrong currency, or an ' +
      'order arrived with no attribution — those are all one storage entry away.',

    `**${docs.length} keys are read out of the source**, plus ` +
      `${unscannable.length} hand-written ` +
      `${unscannable.length === 1 ? 'family that the scan cannot name' : 'families that the scan cannot name'}` +
      '. The **Lives in** column says which browser store: `session` is gone when ' +
      'the tab closes, `local` survives until something removes it, and a few keys ' +
      'are written to both.',

    // ── The headline fact ───────────────────────────────────────────────────
    '## There is no shared expiry mechanism',

    `Do not go looking for one TTL constant — there is no such thing, and no shared ` +
      `expiry helper either. **${mechanisms.length} independent windows** exist, each ` +
      'written next to the code that needed it. They range from 5 minutes to 365 ' +
      'days, and two of them are inline literals rather than named constants.',

    expiryTable(mechanisms),

    'The practical consequence: changing "how long the SDK caches things" is never a ' +
      'one-line edit. Change the window a key needs, in the file that owns it, and ' +
      'update its row here in the same change.',

    // ── Dynamic keys ────────────────────────────────────────────────────────
    '## Matching what you see in devtools',

    'These keys are built at runtime, so the name in storage is never the name in ' +
      'the source. Match the fixed part and read the rest as the variable:',

    [
      '| Pattern in the source | A real entry looks like |',
      '|---|---|',
      ...dynamic.map(d => {
        const examples = d.examples?.length
          ? d.examples.map(e => `\`${e}\``).join(', ')
          : '—';
        return `| \`${d.key}\` | ${examples} |`;
      }),
    ].join('\n'),

    'Everything else in this page is a literal key you can search for as written.',

    // ── Store-owned vs core-written ─────────────────────────────────────────
    '## Which keys have a store behind them',

    `${owned.length} of these entries have one of the seven documented stores behind ` +
      'them, and that store is the place to read about the shape inside — this page ' +
      'does not repeat their schemas. How the store relates to the key differs, and ' +
      'the difference decides what you find in the value:',

    [
      '| Key | Store | How the store uses it |',
      '|---|---|---|',
      ...owned.map(d => {
        const store = d.store;
        return `| \`${d.key}\` | ${store ? storeLink(store) : '—'} | ${
          RELATION[d.storeRelation ?? 'persist-key']
        } |`;
      }),
    ].join('\n'),

    'The rest are written by core services — attribution, analytics, the country ' +
      'service, the boot sequence — with no store behind them. Nothing reactive ' +
      'watches those: a value written there does not notify anything, so code that ' +
      'needs to react has to read it at the moment it needs it.',

    // ── The registry ────────────────────────────────────────────────────────
    '## The keys',
  ];

  for (const group of STORAGE_GROUPS) {
    const inGroup = docs.filter(d => d.group === group.id);
    if (!inGroup.length) continue;
    parts.push(`### ${group.title}`, group.intro, groupTable(inGroup, facts));
  }

  if (unscannable.length) {
    parts.push(
      '## Keys the scan cannot name',
      'Every key above is read out of the source, so a key that leaves the code ' +
        'loses its row automatically. These ones cannot be: the key is a function ' +
        'parameter, and only the callers know the real names. They are written by ' +
        'hand and anchored to a line of source the drift test checks, so they cannot ' +
        'outlive the code either.',
      unscannableTable(unscannable, facts)
    );
  }

  parts.push(
    '## Cautions',
    [
      '- **Renaming a key silently resets live sessions.** A cart mid-funnel is ' +
        'keyed by the old name, so the rename reads as an empty cart with no error ' +
        'anywhere. Add a new key and migrate on read; never rename one in place.',
      '- **A key written to both stores is not cleared by clearing one.** ' +
        '`evclid` and `next_funnel_name` are each written to sessionStorage *and* ' +
        'localStorage, and the attribution collector reads whichever it finds ' +
        'first. Symptom: you cleared the value, reloaded, and it came back. Fix: ' +
        'clear both, or call the store action that does ' +
        '(`clearPersistedFunnel()`). Note that `next-attribution` is **not** in ' +
        "this group — it is sessionStorage only, and the collector's localStorage " +
        'reads of that name are dead branches nothing writes.',
      '- **`SDKInitializer.clearAllStorage()` clears less than its name promises.** ' +
        'It sweeps keys starting `next-` or `_next` from both stores — which means ' +
        'every key using an **underscore** after `next` survives: ' +
        '`next_selected_currency`, `next_selected_country`, `next_selected_locale`, ' +
        '`next_funnel_name`, `next_prospect_cart`, `next_utm_data`, ' +
        '`next_v2_pending_events`, `next_country_*` and `nextDataLayer_*`. So do ' +
        '`analytics_*`, `visitor_id`, `user_data`, `session_id`, `evclid`, ' +
        '`tn_tag_*`, `upsells_*` and every `debug-*` key. Symptom: you "cleared all ' +
        'storage" and the page still comes up in EUR. Fix: for a genuinely clean ' +
        'first visit, clear both stores in devtools rather than calling this.',
      '- **Expiry is checked on read, never on a timer.** A stale entry sits in ' +
        'storage until something looks at it. Reading storage directly in devtools ' +
        'therefore shows entries the SDK already considers dead — trust the ' +
        'timestamp inside the value, not its presence.',
      '- **Two keys named `session_id` and `analytics_session_id` are different ' +
        'sessions.** One belongs to the user-data collector, one to the event ' +
        'pipeline, and they change at different moments. Do not correlate them.',
      '- **The 365-day `next_user_data` cookie mirrors `user_data`.** Clearing ' +
        'sessionStorage does not remove identity fields; they reappear from the ' +
        'cookie on the next page. Clear cookies too when testing a fresh visitor.',
    ].join('\n')
  );

  return `${blocks(...parts)}\n`;
}

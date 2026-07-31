/**
 * Renders a {@link StateManifest} into `guide/reference/state-reference.md`, following
 * the template in `.claude/skills/sdk-docs/references/state-reference.md`.
 *
 * Field **types** come from the store's real interface rather than the manifest, so the
 * published table cannot disagree with the code about a type.
 *
 * Build-time only — see the note on {@link StateManifest}.
 */

import type { StateManifest, StateOperation } from './state-manifest';
import { stateNav } from './nav';

/** A field's type as declared on the interface, keyed by field name. */
export type FieldTypes = Record<string, { type: string; nullable: boolean }>;

const GENERATED =
  '<!-- Generated from the store manifest. Do not edit by hand:\n' +
  '     edit <store>.state-manifest.ts, then run `npm run docs:reference`. -->';

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

function operationTable(
  title: string,
  intro: string,
  ops: StateOperation[] | undefined
): string | undefined {
  if (!ops?.length) return undefined;
  return blocks(
    `### ${title}`,
    intro,
    [
      '| Call | Effect |',
      '|---|---|',
      ...ops.map(
        o =>
          `| \`${o.name}\` | ${o.effect}${
            o.deprecated ? ` **Deprecated** — ${o.deprecated}` : ''
          } |`
      ),
    ].join('\n')
  );
}

/** `zustand-persist` + a key + an expiry, said in one line a reader can act on. */
function persistenceLine(manifest: StateManifest): string {
  const { mechanism, key, expiry } = manifest.persistence;

  if (mechanism === 'none') {
    // Deliberately not "nothing survives a reload": `config` is unpersisted as a store,
    // yet `selectedCurrency` comes back because something else mirrors it to
    // sessionStorage by hand. An absolute claim here would be wrong, and a reader would
    // trust it over the field row that says otherwise.
    return (
      `**This store is not persisted.** \`${manifest.storeHook}\` is rebuilt on every ` +
      'page load, from meta tags and configuration rather than from storage. Individual ' +
      'values can still be restored by code elsewhere — the Survives column is per ' +
      'field, and it is the one to trust.'
    );
  }

  const how =
    mechanism === 'zustand-persist'
      ? 'Zustand `persist` over sessionStorage'
      : 'sessionStorage, written by the store itself rather than by `persist`';

  return blocks(
    `Persisted to ${how} under \`${key}\`` +
      (expiry ? `, valid for **${expiry}**.` : '. There is no expiry.'),
    expiry
      ? 'Past that window the stored copy is discarded and the store starts empty — ' +
        'so a reader coming back later sees a blank state rather than stale data.'
      : undefined
  );
}

export function renderStateReference(
  manifest: StateManifest,
  types: FieldTypes
): string {
  const parts: Array<string | undefined> = [
    `${stateNav(manifest, 'State Reference')}# ${manifest.storeHook}\n\n${GENERATED}`,
    manifest.summary,
    persistenceLine(manifest),
  ];

  // ── Schema ────────────────────────────────────────────────────────────────
  const KIND_NOTE: Record<string, string> = {
    persisted: 'survives a reload',
    computed: 'recalculated, never written by hand',
    transient: 'runtime only',
  };

  parts.push(
    '## Schema',
    'The **Survives** column is the part that is invisible in the type: two fields can ' +
      'look identical and only one comes back after a refresh.',
    [
      '| Field | Type | Survives | Meaning |',
      '|---|---|---|---|',
      ...manifest.fields.map(f => {
        const t = types[f.name];
        // A union type contains `|`, which ends the table cell — so `Order | null`
        // rendered as two columns and shifted every field after it.
        const type = t ? `\`${t.type.replace(/\|/g, '\\|')}\`` : '—';
        const meaning = f.notes
          ? `${f.description}<br>⚠️ ${f.notes}`
          : f.description;
        return `| \`${f.name}\` | ${type} | ${f.kind} — ${KIND_NOTE[f.kind]} | ${meaning} |`;
      }),
    ].join('\n'),
    `New fields: ${manifest.persistence.newFieldRule}`
  );

  // ── Operations ────────────────────────────────────────────────────────────
  const ops = [
    operationTable(
      'Do this',
      'The supported path. These carry the business logic and talk to the API.',
      manifest.operations
    ),
    operationTable(
      'Direct writes',
      'Set state without an API call. Nothing recalculates unless the effect says so.',
      manifest.setters
    ),
    operationTable(
      'Reads',
      'Lookups and derived values. None of these change state.',
      manifest.selectors
    ),
  ].filter(Boolean);

  if (ops.length) parts.push('## What you can do', ...ops);

  // ── Events ────────────────────────────────────────────────────────────────
  if (manifest.emits?.length) {
    parts.push(
      '## Events',
      'Subscribe with `next.on()` rather than polling the store — these fire once the ' +
        'change is settled.',
      manifest.emits.map(e => `- \`${e}\``).join('\n')
    );
  }

  if (manifest.example) {
    parts.push(
      '## What the data looks like',
      `\`\`\`json\n${manifest.example.trim()}\n\`\`\``
    );
  }

  if (manifest.cautions?.length) {
    parts.push(
      '## Cautions',
      manifest.cautions.map(c => `- ${c}`).join('\n')
    );
  }

  return `${blocks(...parts)}\n`;
}

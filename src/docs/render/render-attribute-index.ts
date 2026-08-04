/**
 * Renders the global attribute index: every `data-*` attribute the SDK reads, on
 * one page, grouped by the feature that owns it.
 *
 * This is the page that replaces the hand-written `data-attributes/` section on the
 * docs site. That section's value was being a single door to "what attributes
 * exist"; its problem was that nothing kept it honest — it listed eight attributes
 * the code does not have. Generating the index from the manifests keeps the door and
 * removes the drift.
 *
 * Build-time only — see the note on {@link FeatureManifest}.
 */

import type { FeatureManifest } from '../schema/feature-manifest';
import { referenceNav } from '../content/nav';
import { SDK_ATTRIBUTES, SDK_CLASSES } from '../content/sdk-attributes';

// An "Autocomplete in your editor" section used to sit here, pointing readers at a
// generated VS Code custom-data file. Both are gone: the file was barely used and
// not worth the upkeep of a generator, a drift test and a shipped asset. This page
// is now the one place attributes are listed.

const GENERATED =
  '<!-- Generated from the feature manifests. Do not edit by hand:\n' +
  "     edit the feature's *.manifest.ts, then run `npm run docs:reference`. -->";

/**
 * Where a feature's guide markdown lives, relative to `docs/attribute-index.md`.
 *
 * Links point at the source `.md` file, not at a site route: the site generator
 * maps a resolved source path to its published page, so a path that opens in the
 * repo is also a working link on the site — and one that does not is broken in
 * both. `page` is a path under the feature's `guide/`, e.g. `overview` or
 * `reference/attributes`.
 */
function featureRoute(manifest: FeatureManifest, page: string): string {
  return `../src/features/${manifest.category}/${manifest.id}/guide/${page}.md`;
}

function statusMark(manifest: FeatureManifest): string {
  if (manifest.status === 'core') return '';
  return ` *(${manifest.status})*`;
}

/** How the feature is switched on, in one short cell. */
function activation(manifest: FeatureManifest): string {
  if (!manifest.activates) return `\`${manifest.activatedByApi}\``;
  const extra = manifest.alsoActivates?.length
    ? ` (also \`${manifest.alsoActivates.join('`, `')}\`)`
    : '';
  return `\`${manifest.activates}\`${extra}`;
}

export function renderAttributeIndex(manifests: FeatureManifest[]): string {
  const byCategory = new Map<string, FeatureManifest[]>();
  for (const manifest of [...manifests].sort((a, b) =>
    a.id.localeCompare(b.id)
  )) {
    const list = byCategory.get(manifest.category) ?? [];
    list.push(manifest);
    byCategory.set(manifest.category, list);
  }

  const total = manifests.reduce(
    (sum, m) =>
      sum +
      m.attributes.length +
      (m.readsElsewhere?.length ?? 0) +
      (m.sets?.length ?? 0),
    0
  );

  const parts: string[] = [
    `${referenceNav('All Attributes')}# All Attributes`,
    GENERATED,
    `Every attribute the SDK reads or writes — ${total} of them across ` +
      `${manifests.length} features — with the feature that owns each one. Follow a ` +
      'feature link for what its attributes mean, their defaults, and their traps.',
    'Attributes marked **sets** are written *by* the SDK for you to read from CSS or ' +
      'tests; you do not set them yourself.',
  ];

  parts.push(
    '## SDK-level',
    'These belong to the SDK itself rather than to a feature — the boot sequence, ' +
      'the shared action base, attribution, and the DOM observer. They are the ones ' +
      'you will not find by looking up a feature.',
    [
      '| Attribute | Owner | Use |',
      '|---|---|---|',
      ...SDK_ATTRIBUTES.map(
        a =>
          `| \`${a.name}\` | ${a.owner} | ${a.setBySdk ? '**sets**' : 'you set it'} |`
      ),
    ].join('\n'),
    'Full descriptions: [SDK-level attributes](./sdk-attributes.md).'
  );

  const classRows = manifests
    .flatMap(m =>
      (m.classes ?? []).map(c => ({
        feature: m.id,
        name: c.name,
        link: featureRoute(m, 'reference/attributes'),
      }))
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.feature.localeCompare(b.feature)
    );

  if (classRows.length) {
    parts.push(
      '## CSS classes',
      'Classes the SDK toggles for you. Style these rather than tracking the same ' +
        'state yourself — the feature already knows it. Follow the feature link for ' +
        'exactly when each is applied.',
      [
        '| Class | Applied by |',
        '|---|---|',
        ...classRows.map(c => `| \`${c.name}\` | [${c.feature}](${c.link}) |`),
      ].join('\n')
    );
  }

  for (const [category, features] of [...byCategory.entries()].sort()) {
    parts.push(`## ${category}`);

    for (const manifest of features) {
      parts.push(
        `### [${manifest.id}](${featureRoute(manifest, 'overview')})${statusMark(manifest)}`,
        manifest.summary,
        `Turned on by ${activation(manifest)}.`
      );

      const rows: string[] = [];
      for (const attr of manifest.attributes) {
        const req = attr.required ? 'required' : 'optional';
        const dflt = attr.default === undefined ? '—' : `\`${attr.default}\``;
        rows.push(`| \`${attr.name}\` | ${req} | ${dflt} |`);
      }
      for (const attr of manifest.readsElsewhere ?? []) {
        rows.push(`| \`${attr.name}\` | on another element | — |`);
      }
      for (const attr of manifest.sets ?? []) {
        rows.push(`| \`${attr.name}\` | **sets** | — |`);
      }

      if (rows.length) {
        parts.push(
          ['| Attribute | Use | Default |', '|---|---|---|', ...rows].join('\n')
        );
      } else {
        parts.push('No attributes — configured entirely from JavaScript.');
      }
    }
  }

  return `${parts.join('\n\n')}\n`;
}

/**
 * The full SDK-level attribute reference, as its own page.
 *
 * The index lists these in one line each; this is where their descriptions and traps
 * live, so the index stays scannable.
 */
export function renderSdkAttributes(): string {
  const parts: string[] = [
    `${referenceNav('SDK-level Attributes')}# SDK-level Attributes`,
    GENERATED,
    'Attributes owned by the SDK itself rather than by any feature — the boot ' +
      'sequence, the shared action base, attribution, and the DOM observer. Looking ' +
      'up a feature will never find these, which is why they have their own page.',
    'For the feature-owned attributes, and every one of these in a single table, ' +
      'see [All Attributes](./attribute-index.md).',
  ];

  for (const attr of SDK_ATTRIBUTES) {
    parts.push(
      `## \`${attr.name}\``,
      [
        '| | |',
        '|---|---|',
        `| Owner | ${attr.owner} |`,
        `| Type | \`${attr.type}\` |`,
        `| Direction | ${attr.setBySdk ? 'the SDK sets it, you read it' : 'you set it, the SDK reads it'} |`,
      ].join('\n'),
      attr.description ?? ''
    );
    if (attr.notes) parts.push(`> **Watch out:** ${attr.notes}`);
  }

  parts.push(
    '## Classes',
    'Applied outside any feature, on the document root, as boot signals.',
    [
      '| Class | Owner | Meaning |',
      '|---|---|---|',
      ...SDK_CLASSES.map(
        c => `| \`${c.name}\` | ${c.owner} | ${c.description} |`
      ),
    ].join('\n')
  );

  return `${parts.filter(Boolean).join('\n\n')}\n`;
}

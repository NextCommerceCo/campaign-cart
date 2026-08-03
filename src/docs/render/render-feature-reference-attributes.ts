/**
 * Renders `guide/reference/attributes.md` — every `data-next-*` attribute a
 * feature declares, plus what it writes back to the DOM (elsewhere-read
 * attributes, set attributes, classes, template tokens). Split out of
 * `render-feature-reference.ts`; see that file for the other generated pages.
 */

import type {
  AttributeDoc,
  FeatureManifest,
  WrittenDoc,
} from '../schema/feature-manifest';
import { blocks, cell, pageHeader } from './render-feature-reference-shared';

/** A 2-column table of the fixed facts about one attribute. */
function factsTable(attr: AttributeDoc): string {
  const rows: Array<[string, string]> = [
    ['Type', `\`${cell(attr.type)}\``],
    ['Required', attr.required ? 'yes' : 'no'],
    ['Default', attr.default === undefined ? '—' : `\`${cell(attr.default)}\``],
  ];
  return [
    '| | |',
    '|---|---|',
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
  ].join('\n');
}

function valuesBlock(values: AttributeDoc['values']): string | undefined {
  if (!values) return undefined;
  if (typeof values === 'string') return `**Valid values:** ${values}`;
  const list = values
    .map(v => `- \`${v.value}\` — ${v.description}`)
    .join('\n');
  return `**Valid values:**\n\n${list}`;
}

function attributeEntry(attr: AttributeDoc, depth: number): string {
  return blocks(
    `${'#'.repeat(depth)} \`${attr.name}\``,
    factsTable(attr),
    attr.description,
    valuesBlock(attr.values),
    attr.notes ? `> **Watch out:** ${attr.notes}` : undefined
  );
}

/** A table for things the feature writes, where per-entry facts are thinner. */
function writtenTable(items: WrittenDoc[]): string {
  const rows = items.map(i => {
    const meaning = [
      i.description,
      i.notes ? `**Watch out:** ${i.notes}` : undefined,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\n+/g, ' ');
    return `| \`${i.name}\` | ${cell(i.values ?? '—')} | ${cell(meaning)} |`;
  });
  return ['| Name | Values | Meaning |', '|---|---|---|', ...rows].join('\n');
}

/** Groups render in the order they first appear; ungrouped entries come first. */
function groupAttributes(
  attributes: AttributeDoc[]
): Array<[string | undefined, AttributeDoc[]]> {
  const order: Array<string | undefined> = [];
  const byGroup = new Map<string | undefined, AttributeDoc[]>();
  for (const attr of attributes) {
    if (!byGroup.has(attr.group)) {
      byGroup.set(attr.group, []);
      order.push(attr.group);
    }
    byGroup.get(attr.group)?.push(attr);
  }
  const ungroupedFirst = [
    ...order.filter(g => g === undefined),
    ...order.filter(g => g !== undefined),
  ];
  return ungroupedFirst.map(g => [g, byGroup.get(g) ?? []]);
}

/** `## Title`, intro, then a table — the shape every written-values section uses. */
function writtenSection(
  title: string,
  intro: string,
  items: WrittenDoc[] | undefined
): string | undefined {
  if (!items?.length) return undefined;
  return blocks(`## ${title}`, intro, writtenTable(items));
}

export function renderAttributes(manifest: FeatureManifest): string {
  const parts: Array<string | undefined> = [
    pageHeader(manifest, 'Attributes'),
    manifest.summary,
    manifest.activates
      ? `Turned on by \`${manifest.activates}\`` +
        (manifest.alsoActivates?.length
          ? ` — and equally by ${manifest.alsoActivates.map(s => `\`${s}\``).join(', ')}.`
          : '.')
      : `Turned on from JavaScript — \`${manifest.activatedByApi}\` — not by an ` +
        'attribute in your markup.',
  ];

  const grouped = groupAttributes(manifest.attributes);
  const grouping = grouped.some(([group]) => group !== undefined);

  for (const [group, attrs] of grouped) {
    if (group) parts.push(`## ${group}`);
    const depth = grouping && group ? 3 : 2;
    attrs.forEach((attr, i) => {
      parts.push(attributeEntry(attr, depth));
      if (i < attrs.length - 1) parts.push('---');
    });
  }

  parts.push(
    writtenSection(
      'Read from other elements',
      'These are not placed on the element this feature is bound to — look for ' +
        'them on inputs elsewhere in the page, or on a linked selector.',
      manifest.readsElsewhere
    ),
    writtenSection(
      'Set by the feature',
      'Written to the element as state changes. Read these from CSS or tests ' +
        'instead of inferring state from the rendered text.',
      manifest.sets
    ),
    writtenSection(
      'CSS classes',
      'Toggled by the feature. Style these rather than tracking the same state ' +
        'yourself.',
      manifest.classes
    ),
    writtenSection(
      'Template tokens',
      "Substituted inside the element's own content on every update.",
      manifest.tokens
    )
  );

  for (const section of manifest.sections ?? []) {
    parts.push(`## ${section.title}`, section.body.trim());
  }

  if (manifest.conflicts?.length) {
    parts.push(
      blocks(
        '## Conflicts',
        manifest.conflicts
          .map(
            c =>
              `- \`${c.feature}\`${c.mode ? ` in \`${c.mode}\` mode` : ''} — ${c.because}`
          )
          .join('\n')
      )
    );
  }

  return `${blocks(...parts)}\n`;
}

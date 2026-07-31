/**
 * Renders the two analytics reference pages under `src/core/guide/reference/`:
 * the event catalogue and the provider matrix.
 *
 * Facts (event names, field names and types, emit sites, the provider registry,
 * every adapter's mapping table) come from the extractor in
 * `src/tests/docs/extract-analytics-events.ts`, so the published tables cannot
 * disagree with the code. Prose comes from `./analytics-events.ts`. Neither half
 * is written here — this file only decides layout.
 *
 * Build-time only — nothing under `src/` outside `src/tests/docs` may import it.
 */

import { coreNav } from './nav';
import {
  ANALYTICS_BLOCKED_EVENTS_NOTE,
  ANALYTICS_DEBUG_NOTES,
  ANALYTICS_ENABLE_NOTE,
  ANALYTICS_EVENTS_INTRO,
  ANALYTICS_FAILURE_STEPS,
  ANALYTICS_FIELD_DOCS,
  ANALYTICS_PROVIDERS_INTRO,
  ANALYTICS_SHARED_SHAPES,
  DL_PREFIX_NOTES,
  type AnalyticsEventDoc,
  type AnalyticsProviderDoc,
} from './analytics-events';

/** One field of an event payload, as read from the validation schema. */
export interface SchemaFieldFact {
  path: string;
  type: string;
  required: boolean;
  sharedShape?: string;
}

/** Where an event object is constructed in the source. */
export interface EmitSiteFact {
  file: string;
  line: number;
  how: string;
}

/** Everything the extractor read out of the analytics source. */
export interface AnalyticsFacts {
  events: Array<{
    name: string;
    category: string;
    hasSchema: boolean;
    description: string;
  }>;
  schemas: Record<string, SchemaFieldFact[]>;
  shared: Record<string, SchemaFieldFact[]>;
  emitSites: Record<string, EmitSiteFact[]>;
  providers: Array<{ key: string; requiredSetting?: string }>;
  providerEventMaps: {
    facebook: Record<string, string>;
    facebookCustomEvents: string[];
    rudderstack: Record<string, string>;
    rudderstackSpecialCases: string[];
    nextCampaign: string[];
    gtmEcommerce: string[];
  };
}

const GENERATED =
  '<!-- Generated. Do not edit by hand: edit src/core/docs/analytics-events.ts\n' +
  '     (prose) or the analytics source (facts), then run `npm run docs:reference`. -->';

/** Human labels for the vocabulary's coarse categories. */
const CATEGORY_TITLES: Record<string, string> = {
  ecommerce: 'Commerce',
  user: 'Identity',
  upsell: 'Post-purchase offers',
  cart: 'Cart lifecycle',
  navigation: 'Navigation',
  engagement: 'Engagement',
};

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/** A union type or a description containing `|` would end the table cell early. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map(r => `| ${r.join(' | ')} |`),
  ].join('\n');
}

/**
 * Anchor of an event's heading, for the index table. The heading is the name in
 * backticks, and the anchor generator drops the backticks while keeping the
 * underscores — `### \`dl_view_item\`` → `#dl_view_item`.
 */
function anchor(eventName: string): string {
  return `#${eventName}`;
}

/**
 * Which destinations receive an event, and under what name — read from the
 * adapters' own mapping tables so the column cannot drift from the code.
 */
function destinations(name: string, facts: AnalyticsFacts): string {
  const maps = facts.providerEventMaps;
  const out: string[] = ['GTM (verbatim)'];

  const fb = maps.facebook[name];
  if (fb) {
    const custom = maps.facebookCustomEvents.includes(fb);
    out.push(`Meta \`${fb}\`${custom ? ' (custom)' : ''}`);
  }

  const rs = maps.rudderstack[name];
  if (rs) out.push(`RudderStack \`${rs}\``);
  else if (maps.rudderstackSpecialCases.includes(name))
    out.push('RudderStack (own handler)');

  if (maps.nextCampaign.includes(name)) out.push('NextCampaign `page_view`');

  return out.join(', ');
}

function fieldMeaning(doc: AnalyticsEventDoc, path: string): string {
  return doc.fields?.[path] ?? ANALYTICS_FIELD_DOCS[path] ?? '';
}

/** The field table for one event, or a line saying why there is none. */
function payloadTable(
  doc: AnalyticsEventDoc,
  fields: SchemaFieldFact[] | undefined
): string {
  if (!fields?.length) {
    return (
      'No field schema is declared for this event, so validation only checks ' +
      'that it has a name. Treat its payload as whatever the code that builds ' +
      'it puts there.'
    );
  }
  return table(
    ['Field', 'Type', 'Required', 'Meaning'],
    fields.map(f => [
      `\`${f.path}\``,
      `\`${cell(f.type)}\``,
      f.required ? 'yes' : 'no',
      cell(fieldMeaning(doc, f.path)),
    ])
  );
}

function sharedShapeSection(
  title: string,
  shapeName: 'UserProperties' | 'Product',
  facts: AnalyticsFacts
): string {
  const shape = ANALYTICS_SHARED_SHAPES[shapeName];
  const fields = facts.shared[shapeName] ?? [];
  return blocks(
    `## ${title}`,
    shape.summary,
    table(
      ['Field', 'Type', 'Meaning'],
      fields.map(f => [
        `\`${f.path}\``,
        `\`${cell(f.type)}\``,
        cell(shape.fields[f.path] ?? ''),
      ])
    )
  );
}

/** One event's full entry: when it fires, where it is built, what it carries. */
function eventSection(doc: AnalyticsEventDoc, facts: AnalyticsFacts): string {
  const sites = facts.emitSites[doc.name] ?? [];

  return blocks(
    `### \`${doc.name}\``,
    // A never-fired event needs the opposite framing: what it would mean if you
    // pushed it, not when to expect it. Saying "fires when: nothing fires it"
    // then repeating that twice more is how a reader stops reading.
    doc.neverFired
      ? `**Nothing in the SDK builds this event.** ${doc.neverFired}\n\n` +
          `**If your page pushes it:** ${doc.firesWhen}`
      : `**Fires when:** ${doc.firesWhen}`,
    `**Reaches:** ${destinations(doc.name, facts)}`,
    sites.length
      ? `**Built at:** ${sites.map(s => `\`${s.file}:${s.line}\``).join(', ')}`
      : undefined,
    doc.providerNotes,
    payloadTable(doc, facts.schemas[doc.name]),
    doc.cautions?.length
      ? doc.cautions.map(c => `> ⚠️ ${c}`).join('\n>\n')
      : undefined
  );
}

export function renderAnalyticsEvents(
  facts: AnalyticsFacts,
  docs: AnalyticsEventDoc[]
): string {
  const byName = new Map(docs.map(d => [d.name, d]));
  const withSchema = facts.events.filter(e => e.hasSchema).length;
  const neverFired = facts.events.filter(
    e => (facts.emitSites[e.name] ?? []).length === 0
  );

  const categories = [...new Set(facts.events.map(e => e.category))];

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'Analytics Events')}# Analytics events\n\n${GENERATED}`,
    ANALYTICS_EVENTS_INTRO,
    `There are **${facts.events.length}** canonical events. ` +
      `**${withSchema}** carry a field schema, which is checked only when debug ` +
      `mode is on and only ever logged — it never blocks an event ` +
      `(\`analytics/index.ts:293-301\`). What can stop an event before it is ` +
      `pushed is the separate always-on rule set in \`analytics/config.ts\`, ` +
      `which checks a handful of required fields per event rather than the whole ` +
      `schema. So a payload missing a schema field still ships; read the field ` +
      `tables as the shape to aim for, not a guarantee. ` +
      `**${neverFired.length}** are declared but never fired by any SDK ` +
      `feature — they are listed so a page can push them and so they can be ` +
      `blocked, not because the SDK produces them.`,
    ANALYTICS_ENABLE_NOTE,
    '## The vocabulary',
    'Grouped the way the source groups it. Every name is exact — these are the ' +
      'strings that land in `window.NextDataLayer` and the strings ' +
      '`blockedEvents` matches.',
  ];

  for (const category of categories) {
    const rows = facts.events
      .filter(e => e.category === category)
      .map(e => [
        `[\`${e.name}\`](${anchor(e.name)})`,
        cell(e.description),
        (facts.emitSites[e.name] ?? []).length ? 'yes' : '**no**',
      ]);
    parts.push(
      `### ${CATEGORY_TITLES[category] ?? category}`,
      table(['Event', 'What it records', 'Fired by the SDK'], rows)
    );
  }

  if (neverFired.length) {
    parts.push(
      '## Declared but never fired',
      'These names are part of the vocabulary — validated, mapped by providers, ' +
        'blockable — yet nothing in the SDK builds them. A tag waiting for one ' +
        'of these will wait forever, which is the most expensive way to find ' +
        'this out.',
      table(
        ['Event', 'Why it is in the vocabulary'],
        neverFired.map(e => [
          `\`${e.name}\``,
          cell(byName.get(e.name)?.neverFired ?? ''),
        ])
      )
    );
  }

  parts.push(
    '## Payload reference',
    'One entry per event: when it fires, where the SDK builds it, which ' +
      'destinations receive it, and every field with what it means to the ' +
      'business. Types are read from the validation schema, so they are the ' +
      'types the pipeline enforces.'
  );

  for (const category of categories) {
    parts.push(`## ${CATEGORY_TITLES[category] ?? category} events`);
    for (const fact of facts.events.filter(e => e.category === category)) {
      const doc = byName.get(fact.name);
      if (!doc) continue;
      parts.push(eventSection(doc, facts));
    }
  }

  parts.push(
    sharedShapeSection('User properties', 'UserProperties', facts),
    sharedShapeSection('Product lines', 'Product', facts),
    '## See also',
    [
      '- [Analytics providers](./analytics-providers.md) — what each destination does with these events, and what to do when one receives nothing.',
      '- [`useConfigStore`](../../../state/config/guide/reference/state-reference.md) — the `analytics` block that decides whether any of this runs.',
    ].join('\n')
  );

  return `${blocks(...parts)}\n`;
}

export function renderAnalyticsProviders(
  facts: AnalyticsFacts,
  docs: AnalyticsProviderDoc[]
): string {
  const byKey = new Map(docs.map(d => [d.key, d]));
  const maps = facts.providerEventMaps;

  /** How many of the canonical names each destination accepts. */
  const accepted: Record<string, string> = {
    gtm: `all ${facts.events.length}`,
    facebook: `${Object.keys(maps.facebook).length} of ${facts.events.length}`,
    rudderstack: `${
      new Set([
        ...Object.keys(maps.rudderstack),
        ...maps.rudderstackSpecialCases,
      ]).size
    } of ${facts.events.length}`,
    nextCampaign: `${maps.nextCampaign.length} of ${facts.events.length}`,
    custom: `all ${facts.events.length}`,
  };

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'Analytics Providers')}# Analytics providers\n\n${GENERATED}`,
    ANALYTICS_PROVIDERS_INTRO,
    '## The matrix',
    table(
      [
        'Provider',
        'Config key',
        'Refuses to start without',
        'Events it accepts',
        'Where they go',
      ],
      facts.providers.map(p => {
        const doc = byKey.get(p.key);
        return [
          doc ? `[${doc.adapter}](#${doc.adapter.toLowerCase()})` : p.key,
          `\`analytics.providers.${p.key}\``,
          p.requiredSetting ? `\`${p.requiredSetting}\`` : 'nothing',
          accepted[p.key] ?? '—',
          cell(doc?.summary ?? ''),
        ];
      })
    ),
    'Every provider is optional. With `analytics.enabled: true` and no provider ' +
      'configured, events are still built, validated and pushed to ' +
      '`window.NextDataLayer` — see [Analytics events](./analytics-events.md).',
    ANALYTICS_BLOCKED_EVENTS_NOTE.join('\n\n'),
    DL_PREFIX_NOTES.join('\n\n'),
    '## Per provider',
  ];

  for (const p of facts.providers) {
    const doc = byKey.get(p.key);
    if (!doc) continue;

    let mapping: string | undefined;
    if (p.key === 'facebook') {
      const rows = Object.entries(maps.facebook).map(([dl, fb]) => [
        `\`${dl}\``,
        `\`${fb}\``,
        maps.facebookCustomEvents.includes(fb) ? '`trackCustom`' : '`track`',
      ]);
      mapping = blocks(
        'Mapped names, read from the adapter:',
        table(['Canonical event', 'Meta event', 'Sent with'], rows)
      );
    } else if (p.key === 'rudderstack') {
      const rows = Object.entries(maps.rudderstack).map(([dl, rs]) => [
        `\`${dl}\``,
        `\`${rs}\``,
      ]);
      mapping = blocks(
        'Mapped names, read from the adapter:',
        table(['Canonical event', 'RudderStack event'], rows),
        maps.rudderstackSpecialCases.length
          ? `Handled outside the table: ${maps.rudderstackSpecialCases
              .map(n => `\`${n}\``)
              .join(
                ', '
              )} — page views become a \`page()\` call, user data an ` +
              '`identify()`.'
          : undefined
      );
    } else if (p.key === 'nextCampaign') {
      mapping = `Mapped names: ${maps.nextCampaign
        .map(n => `\`${n}\``)
        .join(', ')} → \`page_view\`. Everything else is skipped.`;
    } else if (p.key === 'gtm') {
      mapping = blocks(
        'GA4 ecommerce shaping exists for these names, but only on the ' +
          'non-`dl_` path (see the prefix section above):',
        maps.gtmEcommerce.map(n => `\`${n}\``).join(', ')
      );
    }

    parts.push(
      `### ${doc.adapter}`,
      doc.summary,
      `**What it does to an event:** ${doc.reshaping}`,
      `**What it drops:** ${doc.drops}`,
      mapping,
      doc.cautions?.length
        ? doc.cautions.map(c => `> ⚠️ ${c}`).join('\n>\n')
        : undefined
    );
  }

  parts.push(
    '## When nothing arrives',
    'An event can stop at any of these points, in this order. The first three ' +
      'happen before any provider is asked, so a provider that "receives ' +
      'nothing" is often not the provider\'s fault at all. Walk the list from ' +
      'the top.',
    table(
      ['#', 'Stops here when', 'What you see', 'Fix'],
      ANALYTICS_FAILURE_STEPS.map((step, i) => [
        `${i + 1}. **${cell(step.stage)}**<br>\`${step.source}\``,
        cell(step.condition),
        cell(step.symptom),
        cell(step.fix),
      ])
    ),
    ANALYTICS_DEBUG_NOTES.join('\n\n'),
    '## See also',
    [
      '- [Analytics events](./analytics-events.md) — every event, its payload, and which destination sees it under which name.',
      '- [`useConfigStore`](../../../state/config/guide/reference/state-reference.md) — the `analytics` block, including the per-provider settings.',
    ].join('\n')
  );

  return `${blocks(...parts)}\n`;
}

/**
 * Renders a {@link FeatureManifest} into the two generated guide reference pages:
 * `reference/attributes.md` and `reference/events.md`.
 *
 * Output follows the per-feature guide format in `.claude/rules/guide.md`, so a
 * generated page is indistinguishable in shape from the hand-written ones it
 * replaces. Build-time only — see the note on {@link FeatureManifest}.
 */

import type {
  AttributeDoc,
  FeatureLink,
  FeatureManifest,
  WrittenDoc,
} from './feature-manifest';
import { featureNav } from './nav';

/**
 * One `data-next-display` path, extracted from `PROPERTY_MAPPINGS` — the SDK's
 * own routing table — so the published list cannot drift from what resolves.
 */
export interface DisplayPath {
  /** The name written after the namespace, e.g. `total` in `cart.total`. */
  name: string;
  /** The format applied with no `data-next-format`, or `auto`. */
  format: string;
  /** True when the mapping negates another value (`hasItems: '!isEmpty'`). */
  negated: boolean;
}

/**
 * One event's documentation, extracted from its TSDoc on `EventMap`. `EventMap`
 * is the single source of truth for events — this is only the extracted shape,
 * never a second place to write the prose.
 */
export interface EventDoc {
  /** The member's TSDoc summary: the condition that fires the event. */
  when?: string;
  /** Payload fields, from the TSDoc on each member of the payload type. */
  fields?: Array<{ name: string; type: string; description: string }>;
  /** The `@example` tag body, expected to be a JSON payload. */
  example?: string;
}

const GENERATED =
  '<!-- Generated from the feature manifest. Do not edit by hand:\n' +
  '     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->';

/**
 * Joins blocks with a blank line between them, dropping empties. Every helper
 * below returns a block with no leading or trailing newline, so this is the only
 * place that decides vertical spacing — markdown tables and headings both need a
 * blank line around them to render.
 */
function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/**
 * `|` ends a table cell — even inside inline code — so a union type such as
 * `number | undefined` has to be escaped or the row loses its last column.
 */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

/**
 * The top of a generated page: the sidebar frontmatter, the `# Heading`, and the
 * "do not edit by hand" note.
 *
 * `leaf` is both the heading and the sidebar label, so the two cannot disagree.
 * See {@link featureNav} for what the frontmatter does.
 */
function pageHeader(
  manifest: FeatureManifest,
  leaf: string,
  note: string = GENERATED
): string {
  return `${featureNav(manifest, leaf)}# ${leaf}\n\n${note}`;
}

/**
 * Drops the capital on a sentence being spliced mid-sentence. A description written
 * to stand alone ("On the apply button while…") reads as a typo after a colon.
 * Leaves an acronym or an identifier alone.
 */
function lowerFirst(text: string): string {
  if (/^[A-Z]{2,}/.test(text) || /^`/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A 2-column table of the fixed facts about one attribute. */
function factsTable(attr: AttributeDoc): string {
  const rows: Array<[string, string]> = [
    ['Type', `\`${cell(attr.type)}\``],
    ['Required', attr.required ? 'yes' : 'no'],
    ['Default', attr.default === undefined ? '—' : `\`${cell(attr.default)}\``],
  ];
  return ['| | |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join(
    '\n'
  );
}

function valuesBlock(values: AttributeDoc['values']): string | undefined {
  if (!values) return undefined;
  if (typeof values === 'string') return `**Valid values:** ${values}`;
  const list = values.map(v => `- \`${v.value}\` — ${v.description}`).join('\n');
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

/**
 * Every `data-next-display` path a namespace can show, as its own page.
 *
 * Kept separate from `attributes.md` so it works whichever mode owns the
 * reference: a hand-written page keeps its prose and still gets a complete,
 * always-current path inventory beside it.
 */
export function renderDisplayPaths(
  manifest: FeatureManifest,
  displayPaths?: Record<string, DisplayPath[]>
): string {
  const namespace = manifest.displayNamespace ?? '';
  const paths = displayPaths?.[namespace];

  if (!paths?.length) {
    return `${blocks(
      pageHeader(manifest, 'Display Paths'),
      `No paths are declared for the \`${namespace}.\` namespace.`
    )}\n`;
  }

  const rows = paths.map(p => {
    const format = p.format === 'auto' ? 'auto' : `\`${p.format}\``;
    const note = p.negated ? 'Inverse of another value.' : '';
    return `| \`${namespace}.${p.name}\` | ${format} | ${note} |`;
  });

  return `${blocks(
    pageHeader(manifest, 'Display Paths'),
    `Every value the \`${namespace}.\` namespace can show. Write it as ` +
      `\`data-next-display="${namespace}.{path}"\`.`,
    'The Format column is what you get with no `data-next-format`; set that ' +
      'attribute to override it. Formatting and hiding modifiers are the same for ' +
      'every namespace — see ' +
      '[display-core](../../../../display/display-core/guide/reference/attributes.md).',
    ['| Path | Format | Notes |', '|---|---|---|', ...rows].join('\n'),
    'Generated from the SDK\'s own routing table, so this list matches the ' +
      'shipped code rather than a transcription of it.'
  )}\n`;
}

/**
 * Renders `guide/get-started.md` — zero to working, for one feature.
 *
 * Almost none of this is prose that has to be written: the prerequisites are the
 * feature's `dependsOn` and `requires`, the markup is the required attributes plus the
 * fixture snippet Playwright runs, and "did it work" is the feature's own init log and
 * the events it emits. Writing those by hand is how a get-started page ends up
 * describing an attribute that was renamed two releases ago.
 *
 * @param example the fixture-verified snippet, when the feature has one
 * @param initLog the feature's own initialisation log line, for the verify step
 */
export function renderGetStarted(
  manifest: FeatureManifest,
  all: FeatureManifest[],
  example: TestedExample | undefined,
  initLog: string | undefined
): string {
  const ref = (id: string): string => {
    const target = all.find(m => m.id === id);
    return target
      ? `[\`${id}\`](../../../${target.category}/${id}/guide/overview.md)`
      : `\`${id}\``;
  };

  const parts: Array<string | undefined> = [
    pageHeader(
      manifest,
      'Get Started',
      '<!-- Generated from the feature manifest and its e2e fixture. Do not edit by\n' +
        '     hand: edit <feature>.manifest.ts or the fixture, then run\n' +
        '     `npm run docs:reference`. -->'
    ),
    `Turning on \`${manifest.id}\` on a page that already loads the SDK.`,
  ];

  // ── Prerequisites ─────────────────────────────────────────────────────────
  const prereqs = [
    '- The SDK is loaded and the page has an API key in its `<head>`:\n' +
      '  ```html\n' +
      '  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">\n' +
      '  ```',
    ...(manifest.dependsOn ?? []).map(
      d => `- ${ref(d.feature)} is on the page — ${d.because}`
    ),
    ...(manifest.requires ?? []).map(r => `- \`${r.name}\` — ${r.because}`),
  ];
  parts.push('## Prerequisites', prereqs.join('\n'));

  // ── Turn it on ────────────────────────────────────────────────────────────
  const required = manifest.attributes.filter(a => a.required);
  // `[data-next-coupon=""]` is the scanner's selector, not something a reader should
  // copy — lead with the attribute name and keep the selector as the technical detail.
  const activatingAttr = manifest.activates?.match(/\[([a-z-]+)/)?.[1];
  const alsoSelectors = manifest.alsoActivates?.length
    ? ` It is also registered against ${manifest.alsoActivates
        .map(s => `\`${s}\``)
        .join(' and ')}.`
    : '';

  parts.push(
    '## Turn it on',
    manifest.activates
      ? `Put \`${activatingAttr}\` on the element. Nothing registers the feature in ` +
        'JavaScript — the attribute in your markup is the whole wiring step, matched ' +
        `by \`${manifest.activates}\`.${alsoSelectors}`
      : 'There is no attribute for this one — it is turned on from JavaScript, once ' +
        'the SDK is ready:'
  );

  if (!manifest.activates && manifest.apiExample) {
    parts.push(`\`\`\`js\n${manifest.apiExample.trim()}\n\`\`\``);
  }

  if (required.length) {
    parts.push(
      'These attributes are required:',
      [
        '| Attribute | Type | What it does |',
        '|---|---|---|',
        ...required.map(
          a =>
            `| \`${a.name}\` | \`${cell(a.type)}\` | ${
              cell((a.description ?? '').split(/(?<=\.)\s/)[0].trim()) ||
              'see [attributes.md](./reference/attributes.md)'
            } |`
        ),
      ].join('\n'),
      'Everything else is optional — see [attributes.md](./reference/attributes.md).'
    );
  }

  if (example) {
    parts.push(
      `### ${example.title}`,
      `\`\`\`html\n${example.html}\n\`\`\``,
      `This is the markup \`${example.fixture}\` uses, so it is known to work against ` +
        'the current SDK. See [tested-example.md](./reference/tested-example.md).'
    );
  }

  // ── Check it worked ───────────────────────────────────────────────────────
  const signals = [
    initLog
      ? `- With \`?debug=true\` on the URL, the console shows \`${initLog}\` under ` +
        `\`${manifest.logPrefix}\`. No line means the feature never activated — ` +
        'check the activating attribute is spelled exactly as above.'
      : `- With \`?debug=true\` on the URL, look for \`${manifest.logPrefix}\` lines in ` +
        'the console. None at all means the feature never activated.',
    ...(manifest.emits.length
      ? [
          `- It emits ${manifest.emits
            .slice(0, 3)
            .map(e => `\`${e}\``)
            .join(', ')}${manifest.emits.length > 3 ? ', and more' : ''}. Listen for ` +
            "one to confirm it is running:\n" +
            '  ```js\n' +
            `  window.nextReady.push(() => {\n` +
            `    next.on('${manifest.emits[0]}', payload => console.log(payload));\n` +
            '  });\n' +
            '  ```',
        ]
      : []),
    ...(manifest.classes?.length
      ? [
          `- It sets \`${manifest.classes[0].name}\`: ` +
            `${lowerFirst(manifest.classes[0].description)} Watch that class in the ` +
            'element inspector — it is the quickest check that state is tracking.',
        ]
      : []),
  ];
  parts.push('## Check it worked', signals.join('\n'));

  // ── Next steps ────────────────────────────────────────────────────────────
  parts.push(
    '## Next steps',
    [
      '- [overview.md](./overview.md) — what it does and why it is built this way',
      '- [reference/attributes.md](./reference/attributes.md) — every attribute',
      manifest.emits.length
        ? '- [reference/events.md](./reference/events.md) — payloads you can hook'
        : undefined,
      '- [relations.md](./relations.md) — what it needs, and what breaks it',
      '- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work',
    ]
      .filter(Boolean)
      .join('\n')
  );

  return `${blocks(...parts)}\n`;
}

/**
 * Renders `guide/relations.md` — what this feature needs, what it pairs with, and
 * what it must not be combined with.
 *
 * Takes every manifest, not just this one, because relations are **derived in both
 * directions**. A conflict or a pairing declared on one side used to appear only on
 * that side's page: `quantity-control` declared its `cart-item-list` caveat, so
 * someone reading `cart-item-list` never saw it. Only one side needs to write the
 * link now; both pages show it.
 */
export function renderRelations(
  manifest: FeatureManifest,
  all: FeatureManifest[]
): string {
  const others = all.filter(m => m.id !== manifest.id);
  const ref = (id: string): string => {
    const target = all.find(m => m.id === id);
    if (!target) return `\`${id}\``;
    // relations.md sits at guide/, so a sibling feature is two levels up.
    return `[\`${id}\`](../../../${target.category}/${id}/guide/overview.md)`;
  };
  const withMode = (link: { mode?: string }): string =>
    link.mode ? ` in \`${link.mode}\` mode` : '';

  const parts: Array<string | undefined> = [
    pageHeader(
      manifest,
      'Relations',
      '<!-- Generated from the feature manifests. Do not edit by hand:\n' +
        '     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->'
    ),
    `What \`${manifest.id}\` needs on the page, what it is normally used with, and ` +
      'what breaks it.',
  ];

  const dependencies = [
    ...(manifest.dependsOn ?? []).map(
      d => `- ${ref(d.feature)}${withMode(d)} — ${d.because}`
    ),
    ...(manifest.requires ?? []).map(r => `- \`${r.name}\` — ${r.because}`),
  ];
  parts.push(
    '## Dependencies',
    dependencies.length
      ? dependencies.join('\n')
      : `\`${manifest.id}\` works on its own — nothing else has to be on the page.`
  );

  // Conflicts declared here, plus the ones other features declare against this.
  const inboundConflicts = others.flatMap(other =>
    (other.conflicts ?? [])
      .filter(c => c.feature === manifest.id)
      .map(c => `- ${ref(other.id)}${withMode(c)} — ${c.because}`)
  );
  const conflicts = [
    ...(manifest.conflicts ?? []).map(
      c => `- ${ref(c.feature)}${withMode(c)} — ${c.because}`
    ),
    ...inboundConflicts,
  ];
  parts.push(
    '## Conflicts',
    conflicts.length
      ? blocks(
          'Do not use these together on the same element or for the same package.',
          conflicts.join('\n')
        )
      : 'None known. Several instances of this feature can coexist on a page.'
  );

  const pairing = (link: FeatureLink, from: string): string =>
    `- ${ref(from)}${withMode(link)} — ${link.because}` +
    (link.caution ? `\n  - **Watch out:** ${link.caution}` : '');

  // A feature already listed as a dependency or a conflict is not also a "common
  // combination" — saying it twice on one short page reads as a mistake, and the
  // stronger statement is the one to keep.
  const alreadyNamed = new Set([
    ...(manifest.dependsOn ?? []).map(d => d.feature),
    ...(manifest.conflicts ?? []).map(c => c.feature),
    ...others
      .filter(o => (o.conflicts ?? []).some(c => c.feature === manifest.id))
      .map(o => o.id),
  ]);

  const combos = [
    ...(manifest.pairsWith ?? [])
      .filter(p => !alreadyNamed.has(p.feature))
      .map(p => pairing(p, p.feature)),
    ...others.flatMap(other =>
      alreadyNamed.has(other.id)
        ? []
        : (other.pairsWith ?? [])
            .filter(p => p.feature === manifest.id)
            .map(p => pairing(p, other.id))
    ),
  ];
  if (combos.length) {
    parts.push('## Common combinations', combos.join('\n'));
  }

  return `${blocks(...parts)}\n`;
}

/**
 * Renders `reference/errors.md` from the manifest's `errors`, checked against the
 * feature's own `throw` sites by the drift test.
 *
 * A feature that throws nothing gets a page saying so. That is not filler: "can this
 * fail, and what do I do about it" is the question, and "it does not throw" is a real
 * answer — better than the reader finding no page and not knowing whether that means
 * safe or undocumented.
 */
export function renderErrors(manifest: FeatureManifest): string {
  const header = pageHeader(manifest, 'Errors');

  const errors = manifest.errors ?? [];

  if (errors.length === 0) {
    return `${blocks(
      header,
      `\`${manifest.id}\` throws no errors of its own.`,
      'It can still log a problem and carry on rather than throwing — see ' +
        '[logs.md](./logs.md) for the messages it prints and what they mean.'
    )}\n`;
  }

  const parts: Array<string | undefined> = [
    header,
    `Every error \`${manifest.id}\` can raise, at the exact message, so a console ` +
      'line can be matched to a cause.',
    '**Recoverable** means the visitor can get past it by retrying or correcting ' +
      'what they entered — no code change needed. **Fatal** means it happens every ' +
      'time until the markup, code, or config changes.',
  ];

  // Fatal first: those block every visitor, so they are what to fix first.
  const ordered = [
    ...errors.filter(e => e.kind === 'fatal'),
    ...errors.filter(e => e.kind === 'recoverable'),
  ];

  ordered.forEach((error, i) => {
    parts.push(
      blocks(
        `## \`${error.message}\``,
        [
          '| | |',
          '|---|---|',
          `| Type | ${error.kind === 'fatal' ? 'Fatal' : 'Recoverable'} |`,
          `| Cause | ${error.cause} |`,
          error.fromApi ? '| Raised by | the API, not this feature |' : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        `**Fix:** ${error.fix}`
      )
    );
    if (i < ordered.length - 1) parts.push('---');
  });

  return `${blocks(...parts)}\n`;
}

/** One log call site. Mirrors `LogMessage` in `src/tests/docs/extract-logs.ts`. */
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  where: string;
  hasContext: boolean;
}

/** What each level means for someone reading a console, worst first. */
const LEVEL_SECTIONS: Array<{
  level: LogEntry['level'];
  title: string;
  blurb: string;
}> = [
  {
    level: 'error',
    title: 'Error',
    blurb:
      'Something did not work. Each of these means a visitor saw the wrong thing, ' +
      'or nothing at all.',
  },
  {
    level: 'warn',
    title: 'Warn',
    blurb:
      'The feature carried on, but something in the markup or the data was not what ' +
      'it expected — usually a misspelled attribute or an id that matches nothing. ' +
      'Worth fixing even when the page looks fine.',
  },
  {
    level: 'info',
    title: 'Info',
    blurb: 'Normal progress, useful for confirming the feature ran at all.',
  },
  {
    level: 'debug',
    title: 'Debug',
    blurb:
      'Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the ' +
      'play-by-play, not a list of problems.',
  },
];

/**
 * Renders `reference/logs.md`: every message the feature can print, at its exact
 * wording, so a console line can be searched back to the code that produced it.
 */
export function renderLogs(
  manifest: FeatureManifest,
  logs: LogEntry[]
): string {
  const parts: Array<string | undefined> = [
    pageHeader(
      manifest,
      'Logs',
      '<!-- Generated from the logger calls in this feature\'s source. Do not edit by\n' +
        '     hand: change the log line in the code, then run `npm run docs:reference`. -->'
    ),
  ];

  if (logs.length === 0) {
    return `${blocks(...parts, `\`${manifest.id}\` logs nothing.`)}\n`;
  }

  parts.push(
    `Every message \`${manifest.id}\` can print, under the logger prefix ` +
      `\`${manifest.logPrefix}\`. Search a console line here to find what produced ` +
      'it.',
    'Messages are listed at the wording the code uses. A `{name}` inside one is a ' +
      'value filled in at runtime, so search for the text either side of it.'
  );

  for (const section of LEVEL_SECTIONS) {
    const forLevel = logs.filter(l => l.level === section.level);
    if (forLevel.length === 0) continue;

    parts.push(
      `## ${section.title}`,
      section.blurb,
      [
        '| Message | Source | Extra context |',
        '|---|---|---|',
        ...forLevel.map(
          l =>
            `| \`${cell(l.message)}\` | \`${l.where}\` | ${
              l.hasContext ? 'yes' : '—'
            } |`
        ),
      ].join('\n')
    );
  }

  parts.push(
    'The **Extra context** column says whether the call passes a second argument — ' +
      'an object or an error logged alongside the message. Expand that entry in the ' +
      'console to see it; the message alone will not tell you which element or ' +
      'package was involved.'
  );

  return `${blocks(...parts)}\n`;
}

/**
 * The markup for one feature, lifted from the Playwright fixture that tests it.
 * Shape matches `FixtureExample` in `src/tests/docs/extract-fixture-example.ts`;
 * it is redeclared here so this module stays free of test-only imports.
 */
export interface TestedExample {
  title: string;
  html: string;
  fixture: string;
  spec?: string;
}

/**
 * Renders `reference/tested-example.md` — a working snippet that is known to work
 * because a browser test runs it, rather than because someone typed it carefully.
 */
export function renderTestedExample(
  manifest: FeatureManifest,
  example: TestedExample
): string {
  const attribution = example.spec
    ? `Taken from \`${example.fixture}\`, which \`${example.spec}\` boots the real ` +
      'SDK against on every `npm run test:e2e`. If this markup stopped working, that ' +
      'spec would fail — which is the whole reason it lives here rather than being ' +
      'written out by hand.'
    : `Taken from \`${example.fixture}\`, a Playwright fixture the e2e suite loads ` +
      'the real SDK against.';

  // The snippet is published byte-for-byte, which is the point — anything trimmed
  // out would no longer be the markup the test runs. That includes the `id`s the
  // spec uses to find elements, so say plainly that they are not part of the API.
  const testHooks = /\sid="/.test(example.html)
    ? 'The `id` attributes are how the test finds elements. They carry no meaning ' +
      'for the SDK — drop them, or use your own.'
    : undefined;

  return `${blocks(
    pageHeader(
      manifest,
      'Tested Example',
      "<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:\n" +
        '     edit the fixture, then run `npm run docs:reference`. -->'
    ),
    `## ${example.title}`,
    `\`\`\`html\n${example.html}\n\`\`\``,
    attribution,
    `The snippet is a fragment, not a whole page — it leaves out the ` +
      '`<meta name="next-api-key">` and the SDK `<script>` tag that every campaign ' +
      'page needs. For those, see ' +
      `[${manifest.id}'s overview](../overview.md).`,
    testHooks
  )}\n`;
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

export function renderEvents(
  manifest: FeatureManifest,
  eventDocs: Record<string, EventDoc>
): string {
  const parts: Array<string | undefined> = [pageHeader(manifest, 'Events')];

  if (manifest.emits.length === 0) {
    return `${blocks(...parts, `\`${manifest.id}\` emits no events.`)}\n`;
  }

  parts.push(
    "Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes " +
      'declared on `EventMap`, which is where these descriptions come from.'
  );

  manifest.emits.forEach((name, i) => {
    const doc = eventDocs[name];
    parts.push(
      blocks(
        `## \`${name}\``,
        `**When:** ${doc?.when ?? `Undocumented — add a TSDoc comment to \`${name}\` on \`EventMap\`.`}`,
        doc?.fields?.length
          ? blocks(
              '**Payload:**',
              [
                '| Field | Type | Description |',
                '|---|---|---|',
                ...doc.fields.map(
                  f =>
                    `| \`${f.name}\` | \`${cell(f.type)}\` | ${cell(f.description)} |`
                ),
              ].join('\n')
            )
          : undefined,
        doc?.example
          ? blocks('**Example:**', `\`\`\`json\n${doc.example.trim()}\n\`\`\``)
          : undefined
      )
    );
    if (i < manifest.emits.length - 1) parts.push('---');
  });

  return `${blocks(...parts)}\n`;
}

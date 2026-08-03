/**
 * Renders `guide/get-started.md` — zero to working, for one feature. Split out of
 * `render-feature-reference.ts`; see that file for the other generated pages.
 */

import type { FeatureManifest } from '../schema/feature-manifest';
import {
  blocks,
  cell,
  lowerFirst,
  pageHeader,
} from './render-feature-reference-shared';
import type { TestedExample } from './render-feature-reference-tested-example';

/**
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
            .join(
              ', '
            )}${manifest.emits.length > 3 ? ', and more' : ''}. Listen for ` +
            'one to confirm it is running:\n' +
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

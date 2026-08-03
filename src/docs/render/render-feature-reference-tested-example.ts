/**
 * Renders `guide/reference/tested-example.md` — a working snippet that is known
 * to work because a browser test runs it. Split out of
 * `render-feature-reference.ts`; see that file for the other generated pages.
 */

import type { FeatureManifest } from '../schema/feature-manifest';
import { blocks, pageHeader } from './render-feature-reference-shared';

/**
 * The markup for one feature, lifted from the Playwright fixture that tests it.
 * Shape matches `FixtureExample` in `src/docs/extract/extract-fixture-example.ts`;
 * it is redeclared here so this module stays free of test-only imports.
 */
export interface TestedExample {
  title: string;
  html: string;
  fixture: string;
  spec?: string;
}

/**
 * Renders the page: a working snippet that is known to work because a browser
 * test runs it, rather than because someone typed it carefully.
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

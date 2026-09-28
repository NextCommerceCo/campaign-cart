/**
 * Renders `docs/sdk-attributes.md`, the reference for the attributes the SDK owns
 * rather than any one feature. Build-time only.
 */

import { referenceNav } from '../content/nav';
import { SDK_ATTRIBUTES, SDK_CLASSES } from '../content/sdk-attributes';

const GENERATED =
  '<!-- Generated from src/docs/content/sdk-attributes.ts. Do not edit by hand:\n' +
  '     edit that file, then run `npm run docs:reference`. -->';

export function renderSdkAttributes(): string {
  const parts: string[] = [
    `${referenceNav('SDK-level Attributes')}# SDK-level Attributes`,
    GENERATED,
    'Attributes owned by the SDK itself rather than by any feature — the boot ' +
      'sequence, the shared action base, attribution, and the DOM observer. Looking ' +
      'up a feature will never find these, which is why they have their own page.',
    'For the feature-owned attributes, see ' +
      '[Data Attributes](./guides/reference/data-attributes.md).',
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

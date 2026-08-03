/**
 * Renders `guide/reference/errors.md`. Split out of `render-feature-reference.ts`;
 * see that file for the other generated pages.
 */

import type { FeatureManifest } from '../schema/feature-manifest';
import { blocks, pageHeader } from './render-feature-reference-shared';

/**
 * From the manifest's `errors`, checked against the feature's own `throw` sites by
 * the drift test.
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
          error.fromApi
            ? '| Raised by | the API, not this feature |'
            : undefined,
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

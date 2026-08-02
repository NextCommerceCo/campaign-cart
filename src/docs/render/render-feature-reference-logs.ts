/**
 * Renders `guide/reference/logs.md` — every message a feature's `logger.*` calls
 * can print, at its exact wording. Split out of `render-feature-reference.ts`; see
 * that file for the other generated pages.
 */

import type { FeatureManifest } from '../schema/feature-manifest';
import { blocks, cell, pageHeader } from './render-feature-reference-shared';

/** One log call site. Mirrors `LogMessage` in `src/docs/extract/extract-logs.ts`. */
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
 * Every message the feature can print, so a console line can be searched back to
 * the code that produced it.
 */
export function renderLogs(
  manifest: FeatureManifest,
  logs: LogEntry[]
): string {
  const parts: Array<string | undefined> = [
    pageHeader(
      manifest,
      'Logs',
      "<!-- Generated from the logger calls in this feature's source. Do not edit by\n" +
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

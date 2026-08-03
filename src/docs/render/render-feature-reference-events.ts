/**
 * Renders `guide/reference/events.md`. Split out of
 * `render-feature-reference.ts`; see that file for the other generated pages.
 */

import type { FeatureManifest } from '../schema/feature-manifest';
import { blocks, cell, pageHeader } from './render-feature-reference-shared';

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

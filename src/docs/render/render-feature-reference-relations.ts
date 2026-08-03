/**
 * Renders `guide/relations.md` — what a feature needs, what it pairs with, and
 * what it must not be combined with. Split out of `render-feature-reference.ts`;
 * see that file for the other generated pages.
 */

import type { FeatureLink, FeatureManifest } from '../schema/feature-manifest';
import { blocks, pageHeader } from './render-feature-reference-shared';

/**
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

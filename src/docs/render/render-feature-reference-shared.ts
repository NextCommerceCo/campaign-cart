/**
 * Small string helpers shared by every `render-feature-reference-*.ts` module —
 * the page skeleton (`pageHeader`), the block-joining rule, and the two escapes a
 * table cell needs. Split out of `render-feature-reference.ts` so each rendering
 * concern (attributes, display paths, get-started, relations, errors, logs,
 * tested example, events) can live in its own file without copying these.
 */

import type { FeatureManifest } from '../schema/feature-manifest';
import { featureNav } from '../content/nav';

export const GENERATED =
  '<!-- Generated from the feature manifest. Do not edit by hand:\n' +
  '     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->';

/**
 * Joins blocks with a blank line between them, dropping empties. Every helper
 * below returns a block with no leading or trailing newline, so this is the only
 * place that decides vertical spacing — markdown tables and headings both need a
 * blank line around them to render.
 */
export function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/**
 * `|` ends a table cell — even inside inline code — so a union type such as
 * `number | undefined` has to be escaped or the row loses its last column.
 */
export function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

/**
 * The top of a generated page: the sidebar frontmatter, the `# Heading`, and the
 * "do not edit by hand" note.
 *
 * `leaf` is both the heading and the sidebar label, so the two cannot disagree.
 * See {@link featureNav} for what the frontmatter does.
 */
export function pageHeader(
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
export function lowerFirst(text: string): string {
  if (/^[A-Z]{2,}/.test(text) || /^`/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Renders a {@link FeatureManifest} into the generated guide reference pages:
 * `reference/attributes.md`, `reference/events.md`, `reference/display-paths.md`,
 * `get-started.md`, `relations.md`, `reference/errors.md`, `reference/logs.md`, and
 * `reference/tested-example.md`.
 *
 * Output follows the per-feature guide format in `.claude/rules/guide.md`, so a
 * generated page is indistinguishable in shape from the hand-written ones it
 * replaces. Build-time only — see the note on {@link FeatureManifest}.
 *
 * This file is a barrel: each render function lives in its own
 * `render-feature-reference-*.ts` module (one per generated page), and the shared
 * page-header/table-cell helpers live in `render-feature-reference-shared.ts`. Split
 * out once this file passed 900 lines — see `.claude/skills/sdk-structure`. Every
 * name below is re-exported unchanged so `@/docs/render/render-feature-reference`
 * keeps resolving for every existing caller.
 */

export type {
  DisplayPath,
  DisplayPathSource,
} from './render-feature-reference-display-paths';
export { renderDisplayPaths } from './render-feature-reference-display-paths';

export { renderGetStarted } from './render-feature-reference-get-started';

export { renderRelations } from './render-feature-reference-relations';

export { renderErrors } from './render-feature-reference-errors';

export type { LogEntry } from './render-feature-reference-logs';
export { renderLogs } from './render-feature-reference-logs';

export type { TestedExample } from './render-feature-reference-tested-example';
export { renderTestedExample } from './render-feature-reference-tested-example';

export { renderAttributes } from './render-feature-reference-attributes';

export type { EventDoc } from './render-feature-reference-events';
export { renderEvents } from './render-feature-reference-events';

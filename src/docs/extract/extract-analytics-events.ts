/**
 * Reads the analytics source and returns everything about the `dl_*` event
 * vocabulary that a scanner can know for certain: the canonical event list, each
 * event's field schema, where in the source each event is built, and what the
 * provider adapters do with it.
 *
 * Why an extractor rather than a hand-written table: the vocabulary is a literal
 * (`DL_EVENTS`), the field schemas are literals (`eventSchemas`), the provider
 * registry is a literal (`PROVIDER_FACTORIES`), and every adapter's event
 * mapping is a literal. A table copied out of them by hand is a second copy that
 * goes stale — the same failure the analytics manifest gate in
 * `src/tests/utils/analyticsVocabulary.test.ts` exists to prevent. The prose half
 * (what an event means, which providers reshape it, what to do when nothing
 * arrives) is judgement a scanner cannot derive and lives in
 * `src/docs/content/analytics-events.ts`, checked against this extractor in both
 * directions.
 *
 * Build-time only: nothing under `src/` outside `src/docs/` may import this.
 *
 * This file is a barrel over six modules, split out once it passed 700 lines (see
 * `.claude/skills/sdk-structure`):
 *
 * | Module | Owns |
 * |---|---|
 * | `extract-analytics-events-types.ts` | The facts this extractor returns — {@link AnalyticsExtract} and friends |
 * | `extract-analytics-events-ast-helpers.ts` | Generic TS-AST helpers with no analytics-domain logic |
 * | `extract-analytics-events-schemas.ts` | `DL_EVENTS` and `eventSchemas` — the vocabulary and its field shapes |
 * | `extract-analytics-events-emit-sites.ts` | Where in the source each event is actually built |
 * | `extract-analytics-events-providers.ts` | The provider registry and what each adapter does with the vocabulary |
 * | `extract-analytics-events-surface.ts` | The public entry point — `extractAnalytics`, which composes every extractor |
 *
 * Every name below is re-exported unchanged so
 * `@/docs/extract/extract-analytics-events` keeps resolving for every existing
 * caller.
 *
 * @internal
 */

export type {
  AnalyticsExtract,
  DlEventEntry,
  EmitSite,
  ProviderEventMaps,
  ProviderRegistryEntry,
  SchemaField,
  SharedShape,
} from './extract-analytics-events-types';

export { extractEmitSites } from './extract-analytics-events-emit-sites';
export {
  extractProviderEventMaps,
  extractProviderRegistry,
} from './extract-analytics-events-providers';
export {
  extractDlEvents,
  extractEventSchemas,
} from './extract-analytics-events-schemas';
export { extractAnalytics } from './extract-analytics-events-surface';

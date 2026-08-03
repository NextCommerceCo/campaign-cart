/**
 * Returns, per `data-next-display` namespace, every path a value may use — read from
 * the code that answers that namespace.
 *
 * Two things are read, and they answer two different questions:
 *
 * | Read | What it is | Extractor |
 * |---|---|---|
 * | the enhancer that resolves the namespace | **what the SDK answers** | {@link extractResolvedDisplayPaths} |
 * | the `PROPERTY_MAPPINGS` routing table | **what the SDK claims**, for five namespaces | {@link extractDisplayPaths} |
 *
 * The published list comes from the first. The second is a claim checked against it,
 * which is the correction finding 127 in `docs/code-findings.md` asked for: the
 * generated `cart.` page was rendered straight from the routing table, and ten of its
 * twenty-two rows named paths `CartDisplayEnhancer.resolveValue` has no case for
 * while six paths it does answer were missing. A routing entry is a format, a
 * validator and a fallback — never a promise that something resolves the path.
 *
 * The same mistake one layer down is why the **names** come only from the resolver
 * and never from a format table: `bundle-selector`'s reference documented four
 * properties (`compare`, `savings`, `savingsPercentage`, `hasSavings`) that its
 * enhancer has no case for, because they were read off the card renderer's
 * `FORMAT_MAP` (finding 109). The format table is read only to look up the format
 * *of a name the resolver already answers*; names that appear solely in it are
 * reported as {@link ResolvedDisplayPaths.formatsWithoutPath} so the docs suite can
 * fail on the trap in the source instead of waiting for its next victim.
 *
 * **It finds the routing table by name, not by path.** This used to take the one file
 * the table happened to live in, hardcoded in two places, and moving that file failed
 * doc generation with an `ENOENT` rather than anything a reader could act on — which
 * is what blocked relocating the display base classes. {@link findPropertyMappings}
 * searches the candidates it is given, so the table can live wherever it belongs.
 *
 * Build-time only: lives under `src/docs/` and depends on the TypeScript
 * compiler, so it never reaches the bundle.
 *
 * This file is a barrel over six modules, split out once it passed 800 lines (see
 * `.claude/skills/sdk-structure`):
 *
 * | Module | Owns |
 * |---|---|
 * | `extract-display-paths-routing-table.ts` | Reading `PROPERTY_MAPPINGS` — the claim |
 * | `extract-display-paths-ast-helpers.ts` | Generic TS-AST helpers with no namespace logic |
 * | `extract-display-paths-namespace-guards.ts` | Which class answers a namespace, and what code is scoped to a *different* one |
 * | `extract-display-paths-shape-prover.ts` | The format table and the prefix-segment count |
 * | `extract-display-paths-walk.ts` | The walk itself — `walkResolver`, following `switch`es and object-literal lookups |
 * | `extract-display-paths-resolve.ts` | The public entry point — `extractResolvedDisplayPaths`, which finds the resolver and starts the walk |
 *
 * Every name below is re-exported unchanged so `@/docs/extract/extract-display-paths`
 * keeps resolving for every existing caller.
 */

export type { DisplayPath } from './extract-display-paths-routing-table';
export {
  extractDisplayPaths,
  findPropertyMappings,
} from './extract-display-paths-routing-table';

export type { ResolvedDisplayPaths } from './extract-display-paths-resolve';
export { extractResolvedDisplayPaths } from './extract-display-paths-resolve';

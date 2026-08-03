/**
 * Display core — the shared machinery every `data-next-display` feature uses.
 *
 * Context resolution (which package, cart line, or selector a binding is about),
 * the price maths behind calculated properties, and the two console tools that
 * inspect display bindings on a live page. The base class and its routing table
 * live in `@/core/base/base-display-enhancer` instead, because four
 * `features/cart/**` display files extend it too.
 *
 * @internal
 */

export {
  DisplayContextProvider,
  setupContextProviders,
} from './display-context';
export type { DisplayContext } from './display-context';
export { PackageContextResolver } from './package-context-resolver';
export { PriceCalculator } from './price-calculator';
export type { PackageMetrics } from './price-calculator';
export { DisplayDebugPanel } from './display-debug-panel';
export { FormatValidator } from './format-validator';
export type { ValidationIssue, ValidationReport } from './format-validator';

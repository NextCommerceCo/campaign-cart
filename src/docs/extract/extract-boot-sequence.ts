/**
 * Reads the SDK's boot sequence out of `core/sdk-initializer.ts`.
 *
 * `SDKInitializer.initialize()` is a flat list of `await this.x()` calls, so the order
 * an author needs — what runs, when, and what has to finish before `window.next`
 * exists — is already written down in the source. Transcribing it into markdown by
 * hand produces a page that is correct on the day it is written and wrong after the
 * next reorder, which is the failure mode that matters most here: a reader who trusts
 * a stale order calls `next.getCartData()` too early and sees an empty cart.
 *
 * Four things come out:
 *
 * 1. **The ordered steps** — name, awaited or not, the `if` guarding it, and whether an
 *    error inside it escapes to `initialize()`'s `catch` (see {@link BootStep.errorsEscape}).
 *    A step that has been split out into its own file is followed through the import
 *    that reaches it (see {@link resolveImportedCall}), so extracting a step to a free
 *    function does not silently drop it from the page or relabel its failure behaviour.
 * 2. **What the page can observe** — the `data-next-sdk-loading` writes and the
 *    `next-display-ready` class, each tagged with the phase it belongs to.
 * 3. **The events** — `next:ready` from the loader, `next:initialized` from the end of
 *    boot, `next:display-ready` from the DOM scan. The loader is read too, because the
 *    single most expensive misunderstanding about boot is that `next:ready` means ready.
 * 4. **The failure path** — retry count, the delay before each retry, and whether the
 *    error is re-thrown once the retries are spent.
 *
 * This file is a barrel over six modules, split out once it passed 900 lines (see
 * `.claude/skills/sdk-structure`):
 *
 * | Module | Owns |
 * |---|---|
 * | `extract-boot-sequence-types.ts` | The facts this extractor returns — {@link BootSequence} and friends |
 * | `extract-boot-sequence-ast-helpers.ts` | Generic TS-AST helpers with no boot-sequence logic |
 * | `extract-boot-sequence-scripts.ts` | Following a script the loader builds as a string, not real code |
 * | `extract-boot-sequence-step-analysis.ts` | Whether a step's errors escape to `initialize()`'s `catch` |
 * | `extract-boot-sequence-imports.ts` | Following a step split into its own file through the import that reaches it |
 * | `extract-boot-sequence-collect.ts` | The walk itself — steps, signals, events, retry policy |
 * | `extract-boot-sequence-sequence.ts` | The public entry point — `extractBootSequence`, which finds `initialize()` and starts the walk |
 *
 * Every name below is re-exported unchanged so `@/docs/extract/extract-boot-sequence`
 * keeps resolving for every existing caller.
 *
 * @internal
 */

export type {
  BootEvent,
  BootSequence,
  BootSignal,
  BootSource,
  BootStep,
  BootThrow,
  RetryPolicy,
} from './extract-boot-sequence-types';

export { extractBootSequence } from './extract-boot-sequence-sequence';

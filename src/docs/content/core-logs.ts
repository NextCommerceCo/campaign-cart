/**
 * The judgement layer for `src/core`'s console output — barrel for the pieces below.
 *
 * The messages themselves are read from the source — `src/docs/extract/extract-logs.ts`
 * finds every `logger.error|warn|info|debug` call in `src/core` — so the page can carry
 * the **exact** wording a reader pastes into a console search box. What the source
 * cannot say is what a line *means* and what to *do* about it, and
 * `.claude/rules/guide.md` requires exactly that for the lines someone looks up after
 * something broke.
 *
 * So the split follows what a reader is doing:
 *
 * - `error` and `warn` — hand-written **Meaning** and **Action** in
 *   {@link CORE_LOG_NOTES}. Drift-checked in both directions: a new `error` or `warn`
 *   in `src/core` fails the test until it is explained, and a note whose message no
 *   longer exists fails until it is removed.
 * - `info` and `debug` — listed with their source location and nothing else. These are
 *   read in the context of the lines around them, and 330 of them with invented prose
 *   apiece would be noise.
 *
 * {@link CORE_LOG_SOURCES} carries the other thing a generator cannot derive: what each
 * of the 36 logger prefixes *is*, in product terms, so a console line can be traced to
 * the part of the SDK that produced it.
 *
 * Two more registries exist for messages the AST-based extractor cannot read at all:
 * {@link CORE_UNREADABLE_LOGS} for `logger.error`/`logger.warn` calls whose first
 * argument is not a literal (concatenated across several strings, or forwarded through
 * a private wrapper), and {@link CORE_CONSOLE_LOGS} for bare `console.error` /
 * `console.warn` calls that bypass `Logger` entirely.
 *
 * Build-time only, like the feature manifests and `sdk-attributes.ts`: nothing under
 * `src/` may import this, or every description here ships in the bundle that loads on
 * customer landing pages.
 *
 * This file used to hold all of it — types, the source registry, the notes, the
 * healthy-boot sample, and the two "unreadable" registries — and grew past 2,100 lines
 * as five subsystem splits this session each added source declarations. It is now a
 * barrel: every export below lives in its own sibling file, so an importer of
 * `core-logs.ts` keeps resolving exactly as before.
 */

export type {
  NotedLevel,
  CoreLogSource,
  CoreLogNote,
  CoreUnreadableLog,
  CoreConsoleLog,
  CoreHealthyLine,
} from './core-logs.types';

export { CORE_HEALTHY_BOOT } from './core-logs.healthy-boot';
export { CORE_LOG_SOURCES } from './core-logs.sources';
export { CORE_LOG_NOTES } from './core-logs.notes';
export { CORE_UNREADABLE_LOGS } from './core-logs.unreadable';
export { CORE_CONSOLE_LOGS } from './core-logs.console';

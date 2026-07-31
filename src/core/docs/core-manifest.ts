/**
 * The typed contract of a **core subsystem** — one author-facing part of the SDK's
 * engine, and the pages that document it.
 *
 * Core needed a third manifest kind because neither of the existing two fits it.
 * A {@link ./feature-manifest.FeatureManifest} describes something an author turns on
 * with a `data-next-*` attribute; a {@link ./state-manifest.StateManifest} describes a
 * store's schema. Core is neither: nobody activates the boot sequence and it has no
 * fields. What it has is **contracts** — what boots in what order, what it reads off
 * the document, what it writes to storage, what it prints to the console, and which
 * switches an author can flip.
 *
 * That distinction is why calling core "internal" is only half true: the *classes* are
 * internal and free to move, the *behaviour* is depended on by every campaign page. An
 * author never imports `SDKInitializer`, and absolutely depends on what it does.
 *
 * **This file is inventory, not prose.** The judgement — the mental model, the domain
 * rules, the traps — lives in `src/core/guide/subsystems/<id>.md`, one file per
 * subsystem. Keeping the prose out of here is deliberate: a single shared TypeScript
 * literal is the one shape that cannot be written by several people at once.
 *
 * **Build-time only.** Nothing under `src/` may import a manifest — they carry
 * documentation, and a runtime import would ship every description in the bundle that
 * loads on customer landing pages.
 */

import type { EventMap } from '@/types/global';

/**
 * A generated reference page a subsystem's contracts are documented on.
 *
 * These are the pages under `src/core/guide/reference/`, each extracted from the
 * source by its own generator, so a subsystem points at them rather than restating
 * their contents (`.claude/rules/documentation.md` §4 — one fact, one place).
 */
export type CoreReferencePage =
  /** The ordered boot steps, from `SDKInitializer.initialize()`. */
  | 'boot-sequence'
  /** Every storage key, its storage, and its TTL. */
  | 'storage-keys'
  /** Every `<meta name="…">` the boot sequence reads. */
  | 'meta-tags'
  /** Every URL query parameter the SDK reads. */
  | 'url-parameters'
  /** Every `logger.*` message core prints, by prefix and level. */
  | 'logs'
  /** Every error core throws, with recoverable-vs-fatal and a fix. */
  | 'errors'
  /** The `dl_*` analytics event catalogue. */
  | 'analytics-events'
  /** Which provider reshapes, drops, or forwards each event. */
  | 'analytics-providers'
  /** The `window.next` methods an author can call. */
  | 'javascript-api'
  /** Everything the SDK installs on `window`, including `nextDebug`. */
  | 'window-surface';

/**
 * How an author interacts with a subsystem — the thing they are looking for when they
 * open its page.
 *
 * Worth stating per subsystem because the answer is not uniform, and guessing wrong
 * wastes a reader's time: analytics is configured, the event bus is subscribed to, and
 * the boot sequence can only be observed.
 */
export type AuthorSurface =
  /** Configured before boot — a meta tag, `window.nextConfig`, or the loader. */
  | 'configured'
  /** Called at runtime through `window.next` / `sdk.*`. */
  | 'called'
  /** Subscribed to — the author reacts to what it emits. */
  | 'subscribed'
  /** Observed only: it runs on its own and the author reads its signals. */
  | 'observed'
  /** Switched on with a URL parameter, for debugging rather than in production. */
  | 'debug-only';

export interface CoreSubsystem {
  /**
   * Kebab-case id. It must match the overview's filename —
   * `src/core/guide/subsystems/<id>.md` — which a drift test enforces, so a renamed
   * subsystem cannot leave its page behind under the old name.
   */
  id: string;
  /** Reader-facing title, in product terms rather than class names. */
  title: string;
  /**
   * One sentence: what this part of the engine does for the page. Written for an
   * author who has never opened `src/core`, so no class name may carry the sentence
   * on its own.
   */
  summary: string;
  /**
   * The files or folders this subsystem owns, relative to `src/`. A drift test asserts
   * each still exists, so a deleted file cannot keep a documented subsystem alive.
   *
   * Folders end with `/`.
   */
  sources: string[];
  howAuthorsReachIt: AuthorSurface[];
  /**
   * The generated reference pages that carry this subsystem's contracts. The overview
   * links to these instead of repeating them.
   */
  reference?: CoreReferencePage[];
  /**
   * Events this subsystem emits. Typed as `keyof EventMap`, so a renamed event breaks
   * the build rather than rotting in the docs.
   */
  emits?: (keyof EventMap)[];
  /**
   * Traps, each naming the trap, the symptom, and the fix
   * (`.claude/rules/documentation.md` §2 — a warning with no fix is noise).
   *
   * These are the short form for the subsystem index; the full treatment belongs in
   * the overview.
   */
  cautions?: string[];
  /**
   * Set when the subsystem is documented for the next maintainer rather than for a
   * page author, with the reason. Excluded from the reader-facing coverage metric —
   * the plan's "leave contributor-only plumbing alone".
   */
  contributorOnly?: string;
}

export function defineCoreSubsystem(subsystem: CoreSubsystem): CoreSubsystem {
  return subsystem;
}

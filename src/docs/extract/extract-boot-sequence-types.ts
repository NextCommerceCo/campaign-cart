/**
 * The facts {@link extractBootSequence} in `./extract-boot-sequence-sequence` returns —
 * split into its own module so every other sibling can depend on the shape without
 * depending on the extraction logic itself.
 */

/** A file to read, plus the short name used in every anchor this module reports. */
export interface BootSource {
  /** Absolute path. */
  path: string;
  /** How it is cited in the docs, e.g. `core/sdk-initializer.ts`. */
  name: string;
}

/** One `throw new Error('…')` inside a boot step. */
export interface BootThrow {
  message: string;
  where: string;
}

/** One statement of `initialize()` that calls something. */
export interface BootStep {
  /** 1-based position in `initialize()`. */
  index: number;
  /** As written at the call site: `waitForDOM`, `cartOperations.clear`. */
  name: string;
  /** `this` for `SDKInitializer`'s own methods, otherwise the receiver as written. */
  receiver: string;
  /** False means boot moves on without waiting for this step to finish. */
  awaited: boolean;
  /** The `if` condition wrapping the call, when the step is conditional. */
  guardedBy?: string;
  where: string;
  /**
   * True when an error inside this step reaches `initialize()`'s `catch` — the method
   * has an `await` or a `throw` that is not inside a `try`/`catch` of its own. False
   * means the step handles its own failures and boot continues past it.
   *
   * `undefined` when the call cannot be analysed at all: it is neither a method
   * declared on `SDKInitializer` nor a call this module can follow through an import
   * to a function whose body it can read (a call through an imported object, such as
   * `cartOperations.clear()`, or a module specifier that does not resolve to a file on
   * disk). A step split out to its own free function and called through the import
   * that reaches it (see {@link resolveImportedCall}) is not one of those cases — its
   * body is read the same as a method's.
   */
  errorsEscape?: boolean;
  /**
   * True when the method has a `try`/`catch` of its own. Together with
   * {@link BootStep.errorsEscape} this separates "handles its own failures" from "has
   * nothing that can fail" — two very different rows for a reader, and both of them
   * come out as `errorsEscape: false`.
   */
  catchesOwnErrors?: boolean;
  /** Literal throws inside the method — how this step can abort the boot. */
  throws: BootThrow[];
}

/** Something the boot writes onto the document that CSS or a script can watch. */
export interface BootSignal {
  kind: 'attribute' | 'class';
  /** `body` or `html`. */
  target: string;
  name: string;
  /** For an attribute, the value written. */
  value?: string;
  phase: 'boot-start' | 'display-ready' | 'boot-complete' | 'boot-failed';
  where: string;
}

/** One event the boot path dispatches. */
export interface BootEvent {
  name: string;
  /** Where a listener has to be attached. */
  target: 'window' | 'document' | 'event-bus';
  /** Keys of the `detail` object literal, in source order. */
  detail: string[];
  /** First dispatch site. */
  where: string;
  /** How many places dispatch it — the loader fires `next:ready` from three. */
  sites: number;
}

/** What `initialize()` does when a step throws. */
export interface RetryPolicy {
  maxRetries: number;
  /** Milliseconds before each retry, in order. Empty when it is not a literal. */
  delays: number[];
  /** The delay expression as written, for when it stops reducing to numbers. */
  delayExpression: string;
  /** True when the `catch` re-runs `initialize()` itself. */
  recursive: boolean;
  /** True when the error is re-thrown after the retries are spent. */
  rethrows: boolean;
  where: string;
}

export interface BootSequence {
  steps: BootStep[];
  signals: BootSignal[];
  events: BootEvent[];
  retry: RetryPolicy;
  /** True when a second `initialize()` returns early instead of booting twice. */
  reentryGuarded: boolean;
  /** Every method name declared on `SDKInitializer`, for the drift check. */
  methods: string[];
}

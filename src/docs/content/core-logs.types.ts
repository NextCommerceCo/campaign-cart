/**
 * Type declarations for `src/core`'s console-output judgement layer.
 *
 * Split out of `core-logs.ts` so the four kinds of content that file grew — type
 * shapes, the source registry, the hand-written notes, and the healthy-boot sample —
 * each live in their own file, with `core-logs.ts` staying a barrel so every existing
 * import keeps resolving. See that file's module doc for the reasoning behind the
 * split itself.
 */

/** Levels that require a hand-written Meaning and Action. */
export type NotedLevel = 'error' | 'warn';

/**
 * One subsystem of `src/core` and the console prefix it logs under.
 *
 * Order here is the order the sections appear on the page: what a reader meets first
 * when a page misbehaves (boot, DOM scanning) before the parts that only matter once
 * something specific is wrong (a single analytics provider).
 */
export interface CoreLogSource {
  /**
   * The prefix as it appears in the console, without the brackets — `[SDKInitializer]`
   * is declared as `SDKInitializer`. A `{name}` in it marks a prefix decided at
   * runtime; see {@link dynamicPrefix}.
   */
  prefix: string;
  /** Path relative to `src/core`. Checked against the file that logs. */
  file: string;
  /** Which part of the page's life this covers, for grouping the index. */
  area: string;
  /** One line, in product terms: what this part of the SDK does. */
  what: string;
  /**
   * Set when the file has no `createLogger('literal')` of its own, because the prefix
   * is decided at runtime — from a provider name passed to `super()`, or from the
   * feature class that extends the shared base. The drift test requires this flag to
   * agree with the source.
   */
  dynamicPrefix?: boolean;
  /**
   * The file that owns the `Logger('…')` literal, when this file does not. A facade
   * split across modules — `next-commerce.ts` and its `next-commerce.*.ts` siblings —
   * builds one logger and hands it to each module, so the prefix a reader sees in the
   * console is declared in a file they would not think to open.
   */
  prefixFrom?: string;
  /** How the prefix is arrived at, for a reader who cannot find it in the file. */
  prefixNote?: string;
}

/** Meaning and Action for one `error` or `warn` message. */
export interface CoreLogNote {
  level: NotedLevel;
  /**
   * The message exactly as the extractor reads it from the source, with `${…}`
   * rendered as `{…}`. Matched against the source, so a reworded log line fails the
   * test until this is updated too.
   */
  message: string;
  /** What the line tells you — including when it is expected rather than a problem. */
  meaning: string;
  /** What to do about it. "Nothing" is a valid answer when it is genuinely nothing. */
  action: string;
}

/**
 * An `error` or `warn` the extractor cannot read, declared by hand instead.
 *
 * Two shapes in `src/core` defeat a source reader that only accepts a literal first
 * argument, and both carry messages a reader will search for:
 *
 * 1. **A message split across concatenated string literals**, which several adapters
 *    use to keep a long "…and here is the fix" sentence inside the line width.
 * 2. **A message forwarded through a private wrapper** — `DataLayerManager` funnels
 *    every error through `this.error(message, …)`, so the `logger.error` call site sees
 *    only a variable and the real wording is at the caller.
 *
 * These are held here rather than by changing the extractor, which serves 28 features
 * and is not this page's to redefine. The drift test still pins them to the code: each
 * entry's {@link anchor} must appear verbatim in {@link file}, and every non-literal
 * `error`/`warn` call site in `src/core` must be claimed by an entry — so a new one
 * cannot ship unexplained either.
 */
export interface CoreUnreadableLog extends CoreLogNote {
  /** Path relative to `src/core`, matching a {@link CoreLogSource.file}. */
  file: string;
  /**
   * A distinctive fragment of the message as it is written in the source. Must appear
   * verbatim in the file; its line becomes the `file:line` shown on the page, so there
   * is no line number to maintain by hand.
   */
  anchor: string;
  /** True when the call passes a second argument — an object or an error. */
  hasContext?: boolean;
  /**
   * Set for case 2 above: the wording lives at a caller of a private logging helper, so
   * the `logger.*` call site itself carries no message.
   */
  forwarded?: boolean;
}

/**
 * A message printed with a bare `console.error` / `console.warn` instead of through
 * `Logger`.
 *
 * Not a variation on the above — a different mechanism, with consequences a reader has
 * to know. These lines carry no prefix unless the string writes one out by hand, they
 * ignore the log level and debug mode entirely (so they print for every visitor on the
 * module bundle), and `Logger` cannot silence them. `attribution-collector.ts` alone has
 * nine, all on paths that lose attribution data, so leaving them off the page would hide
 * a whole subsystem's failure modes.
 *
 * The debug tooling under `core/debug/` is excluded: its console output is the tool
 * talking to the person using it, not the SDK reporting on a customer page.
 *
 * These are a code defect as well as a documentation problem — the project rule is to
 * log through `this.logger` — so this list is expected to shrink.
 */
export interface CoreConsoleLog extends CoreLogNote {
  /** Path relative to `src/core`. */
  file: string;
  /** A fragment that must appear verbatim in the file; its line is shown on the page. */
  anchor: string;
  /** True when the call passes a second argument — an object or an error. */
  hasContext?: boolean;
}

/** One line of the healthy-boot sample, referencing a message that must exist. */
export interface CoreHealthyLine {
  /** A {@link CoreLogSource.prefix}. */
  prefix: string;
  /** An extracted message from that source, verbatim. */
  message: string;
}

/**
 * Row shapes shared by the core reference generators: the attribute, meta-tag and
 * URL-parameter tables, the core error page, and the core log page.
 *
 * Build-time only. Nothing the SDK ships may import this, or the prose these rows
 * carry would load on every customer landing page.
 */

/** One accepted value of an enumerated attribute, and what choosing it does. */
export interface AttributeValue {
  value: string;
  /** What this value makes the SDK do, in product terms. */
  description: string;
}

/** An attribute, meta tag, or URL parameter the integrator writes. */
export interface AttributeDoc {
  /** Exact name, e.g. `data-next-debug`. */
  name: string;
  /**
   * Heading to file this row under. Rows with no group are listed first,
   * ungrouped. Groups render in the order they first appear.
   */
  group?: string;
  /** TypeScript-ish type as the reader should think of it, e.g. `number`. */
  type: string;
  /** Whether the SDK throws or does nothing without it. */
  required?: boolean;
  /** Value used when it is absent. Omit when there is no default. */
  default?: string;
  /** Markdown. What it does and how changing it changes behaviour. */
  description?: string;
  /** Enumerated values, or a free-text constraint like `positive integer`. */
  values?: AttributeValue[] | string;
  /** Markdown. The trap, the symptom, and the fix. */
  notes?: string;
}

/**
 * One error a reader can hit, and what to do about it.
 *
 * `.claude/rules/guide.md` forbids documenting an error without saying whether it
 * is recoverable, because that is the first thing a reader needs to know.
 */
export interface ErrorDoc {
  /**
   * The exact message, as thrown. Must appear verbatim in the source, or set
   * {@link fromApi} for one that originates outside it.
   */
  message: string;
  /**
   * `recoverable` — the visitor can get past it by retrying or correcting input; no
   * code change needed. `fatal` — it needs a code, markup, or config change, and
   * will happen every time until then.
   */
  kind: 'recoverable' | 'fatal';
  /** What produced it. */
  cause: string;
  /** Actionable steps. Markdown; a code block is fine. */
  fix: string;
  /**
   * Set when the message comes from the API rather than being thrown in the SDK,
   * which exempts it from the source check.
   */
  fromApi?: boolean;
}

/** One log call site, as `extract-logs.ts` reads it out of the source. */
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  where: string;
  hasContext: boolean;
}

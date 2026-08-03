import type { Logger } from '@/core/logger';

/**
 * Everything the extracted conditional-display helpers need from the
 * enhancer instance. Built fresh on every evaluation so the helpers never
 * read a stale snapshot of the enhancer's fields.
 */
export interface ConditionalDisplayContext {
  /** Logger of the owning enhancer, used for all warn/debug/info output. */
  logger: Logger;
  /** The element the enhancer is bound to (shipping context lookup). */
  element: HTMLElement;
  /** Parsed `data-next-show` / `data-next-hide` condition tree. */
  condition: any;
  /** `data-next-package-id` resolved from the element's ancestry. */
  packageContext: number | null;
  /** Selector this element belongs to, when a selection condition is used. */
  selectorId: string | null;
}

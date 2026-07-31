/**
 * Tooltip config type and attribute parsing.
 */

export interface TooltipConfig {
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  delay?: number;
  maxWidth?: string;
  className?: string;
}

/**
 * Reads the tooltip attributes off `element` into a `TooltipConfig` — the
 * `placement`, `offset`, `delay`, `max-width` and `class` variants of
 * `data-next-tooltip`.
 *
 * Listed individually rather than as a wildcard on purpose: `npm run docs:coverage`
 * scans source for attribute tokens, and a trailing hyphen in prose reads as a
 * real prefix-pattern attribute that no manifest declares — which fails the gate.
 */
export function parseTooltipConfig(element: HTMLElement): TooltipConfig {
  return {
    placement:
      (element.getAttribute('data-next-tooltip-placement') as any) || 'top',
    offset: parseInt(element.getAttribute('data-next-tooltip-offset') || '8'),
    delay: parseInt(element.getAttribute('data-next-tooltip-delay') || '500'),
    maxWidth: element.getAttribute('data-next-tooltip-max-width') || '200px',
    className: element.getAttribute('data-next-tooltip-class') || '',
  };
}

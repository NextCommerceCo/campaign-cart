/**
 * Tooltip renderer
 * Building and positioning the tooltip DOM.
 */

import {
  computePosition,
  flip,
  shift,
  offset,
  arrow as arrowMiddleware,
} from '@floating-ui/dom';
import type { Logger } from '@/core/logger';
import type { TooltipConfig } from './tooltip.types';

/** Reads the tooltip text off `data-next-tooltip`. */
export function getTooltipContent(element: HTMLElement): string {
  return element.getAttribute('data-next-tooltip') || '';
}

export interface CreateTooltipCallbacks {
  /** Called when the pointer enters the tooltip itself (prevents it hiding while hovered). */
  onTooltipMouseEnter: () => void;
  /** Called when the pointer leaves the tooltip itself. */
  onTooltipMouseLeave: () => void;
}

export interface CreatedTooltip {
  tooltip: HTMLElement;
  arrow: HTMLElement;
}

/** Builds the tooltip + arrow elements (not yet attached to the document). */
export function createTooltip(
  content: string,
  config: TooltipConfig,
  callbacks: CreateTooltipCallbacks
): CreatedTooltip {
  const tooltip = document.createElement('div');
  tooltip.className = `next-tooltip ${config.className || ''}`.trim();
  tooltip.id = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  tooltip.role = 'tooltip';
  tooltip.style.maxWidth = config.maxWidth || '200px';

  // Create content element
  const contentEl = document.createElement('div');
  contentEl.className = 'next-tooltip__content';
  contentEl.textContent = content;

  // Create arrow element
  const arrow = document.createElement('div');
  arrow.className = 'next-tooltip__arrow';

  tooltip.appendChild(contentEl);
  tooltip.appendChild(arrow);

  // Add hover listeners to tooltip to prevent hiding when hovering over it
  tooltip.addEventListener('mouseenter', () => {
    callbacks.onTooltipMouseEnter();
  });

  tooltip.addEventListener('mouseleave', () => {
    callbacks.onTooltipMouseLeave();
  });

  return { tooltip, arrow };
}

export function updateTooltipContent(
  tooltip: HTMLElement | null,
  content: string
): void {
  if (!tooltip) return;

  const contentEl = tooltip.querySelector('.next-tooltip__content');
  if (contentEl) {
    contentEl.textContent = content;
  }
}

export interface MountTooltipParams {
  tooltip: HTMLElement;
  element: HTMLElement;
  logger: Logger;
}

/** Appends the tooltip to `document.body` and logs the anchor element's position (DOM half of `show`). */
export function mountTooltip({
  tooltip,
  element,
  logger,
}: MountTooltipParams): void {
  document.body.appendChild(tooltip);

  // Debug: Log element position
  const rect = element.getBoundingClientRect();
  logger.debug('Element position', {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    scrollY: window.scrollY,
    scrollX: window.scrollX,
  });
}

/** Adds the visible class on the next animation frame (DOM half of `show`). */
export function revealTooltip(tooltip: HTMLElement | null): void {
  requestAnimationFrame(() => {
    if (tooltip) {
      tooltip.classList.add('next-tooltip--visible');
    }
  });
}

export interface DismissTooltipHandle {
  /** Reads the *current* tooltip field at the time the removal timeout fires. */
  getTooltip: () => HTMLElement | null;
  clearTooltip: () => void;
  clearArrow: () => void;
}

/**
 * Removes the visible class, then removes the tooltip from the DOM after the
 * animation (DOM half of `hide`).
 *
 * Reads the tooltip back through `handle.getTooltip()` at the time the
 * timeout fires rather than closing over the `tooltip` argument — matches the
 * original's `this.tooltip` re-read, so it is unaffected by a new tooltip
 * being created before this timeout runs.
 */
export function dismissTooltip(
  tooltip: HTMLElement,
  handle: DismissTooltipHandle
): void {
  tooltip.classList.remove('next-tooltip--visible');

  // Remove after animation
  setTimeout(() => {
    const current = handle.getTooltip();
    if (current && current.parentNode) {
      current.parentNode.removeChild(current);
    }
    handle.clearTooltip();
    handle.clearArrow();
  }, 200);
}

export interface PositionTooltipParams {
  tooltip: HTMLElement | null;
  arrow: HTMLElement | null;
  element: HTMLElement;
  config: TooltipConfig;
  logger: Logger;
  onError: (error: unknown, context: string) => void;
}

/** Positions the tooltip (and its arrow) relative to `element` via Floating UI. */
export async function positionTooltip({
  tooltip,
  arrow,
  element,
  config,
  logger,
  onError,
}: PositionTooltipParams): Promise<void> {
  if (!tooltip || !arrow) return;

  try {
    const { x, y, placement, middlewareData } = await computePosition(
      element,
      tooltip,
      {
        placement: config.placement || 'top',
        middleware: [
          offset(config.offset || 8),
          flip(),
          shift({ padding: 5 }),
          arrowMiddleware({ element: arrow }),
        ],
        strategy: 'fixed',
      }
    );

    // Position tooltip
    Object.assign(tooltip.style, {
      left: `${x}px`,
      top: `${y}px`,
    });

    // Position arrow
    if (middlewareData.arrow) {
      const { x: arrowX, y: arrowY } = middlewareData.arrow;

      const staticSide = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right',
      }[placement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left'];

      Object.assign(arrow.style, {
        left: arrowX != null ? `${arrowX}px` : '',
        top: arrowY != null ? `${arrowY}px` : '',
        right: '',
        bottom: '',
        [staticSide as string]: '-4px',
      });
    }

    // Update tooltip placement class for styling
    tooltip.setAttribute('data-placement', placement);

    logger.debug('Tooltip positioned', { x, y, placement });
  } catch (error) {
    onError(error, 'position tooltip');
  }
}

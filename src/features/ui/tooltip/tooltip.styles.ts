/**
 * Tooltip styles
 * The CSS injected once per page for `.next-tooltip` and its variants.
 */

import type { Logger } from '@/core/logger';

export const TOOLTIP_STYLES = `
      .next-tooltip {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 99999;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
        transform: scale(0.95);
        pointer-events: none;
      }

      .next-tooltip--visible {
        opacity: 1;
        visibility: visible;
        transform: scale(1);
        pointer-events: auto;
      }

      .next-tooltip__content {
        background: #333;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.4;
        font-weight: 400;
        text-align: center;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
        max-width: 200px;
        white-space: normal;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .next-tooltip__arrow {
        position: absolute;
        width: 8px;
        height: 8px;
        background: #333;
        transform: rotate(45deg);
      }

      .next-tooltip[data-placement^="top"] .next-tooltip__arrow {
        border-top: none;
        border-left: none;
      }

      .next-tooltip[data-placement^="bottom"] .next-tooltip__arrow {
        border-bottom: none;
        border-right: none;
      }

      .next-tooltip[data-placement^="left"] .next-tooltip__arrow {
        border-left: none;
        border-bottom: none;
      }

      .next-tooltip[data-placement^="right"] .next-tooltip__arrow {
        border-right: none;
        border-top: none;
      }

      .next-tooltip--light .next-tooltip__content {
        background: #fff;
        color: #333;
        border: 1px solid #ddd;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .next-tooltip--light .next-tooltip__arrow {
        background: #fff;
        border: 1px solid #ddd;
      }

      .next-tooltip--error .next-tooltip__content {
        background: #dc3545;
        color: #fff;
      }

      .next-tooltip--error .next-tooltip__arrow {
        background: #dc3545;
      }

      .next-tooltip--success .next-tooltip__content {
        background: #28a745;
        color: #fff;
      }

      .next-tooltip--success .next-tooltip__arrow {
        background: #28a745;
      }

      .next-tooltip--warning .next-tooltip__content {
        background: #ffc107;
        color: #333;
      }

      .next-tooltip--warning .next-tooltip__arrow {
        background: #ffc107;
      }

      .next-tooltip--large .next-tooltip__content {
        padding: 12px 16px;
        font-size: 14px;
        max-width: 300px;
      }

      .next-tooltip--small .next-tooltip__content {
        padding: 4px 8px;
        font-size: 12px;
        max-width: 150px;
      }

      @media (hover: none) {
        .next-tooltip {
          transition-duration: 0.15s;
        }
      }

      @media (prefers-contrast: high) {
        .next-tooltip__content {
          border: 2px solid currentColor;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .next-tooltip {
          transition: opacity 0.1s ease, visibility 0.1s ease;
          transform: none;
        }
        
        .next-tooltip--visible {
          transform: none;
        }
      }
`;

let stylesInjected = false;

/**
 * Injects `TOOLTIP_STYLES` into `document.head` once per page load. Safe to
 * call from every `TooltipEnhancer` instance — the module-level flag (backed
 * by a `#next-tooltip-styles` element check as a second guard) makes repeat
 * calls a no-op.
 */
export function injectStyles(logger: Logger): void {
  if (stylesInjected) return;

  const styleId = 'next-tooltip-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = TOOLTIP_STYLES;

  document.head.appendChild(style);
  stylesInjected = true;

  logger.debug('Tooltip styles injected into document head');
}

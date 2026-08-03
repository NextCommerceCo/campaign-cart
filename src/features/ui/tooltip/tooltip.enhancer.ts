/**
 * Tooltip Enhancer
 * Creates tooltips for elements with data-next-tooltip attribute using Floating UI
 */

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { injectStyles } from './tooltip.styles';
import { parseTooltipConfig } from './tooltip.types';
import type { TooltipConfig } from './tooltip.types';
import {
  getTooltipContent,
  createTooltip,
  updateTooltipContent,
  mountTooltip,
  revealTooltip,
  dismissTooltip,
  removeTooltipNow,
  positionTooltip,
} from './tooltip.renderer';
import {
  cleanupTimeouts,
  scheduleShow,
  scheduleHide,
  setupEventListeners,
} from './tooltip.handlers';
import type { TooltipTimers } from './tooltip.handlers';

export type { TooltipConfig } from './tooltip.types';

export class TooltipEnhancer extends BaseEnhancer {
  private tooltip: HTMLElement | null = null;
  private arrow: HTMLElement | null = null;
  private timers: TooltipTimers = {
    showTimeout: null,
    hideTimeout: null,
    dismissTimeout: null,
  };
  private config: TooltipConfig;
  private isVisible = false;

  constructor(element: HTMLElement) {
    super(element);
    this.config = parseTooltipConfig(this.element);
    injectStyles(this.logger);
  }

  public async initialize(): Promise<void> {
    try {
      this.validateElement();
      setupEventListeners(this.element, {
        onMouseEnter: this.handleMouseEnter,
        onMouseLeave: this.handleMouseLeave,
        onFocus: this.handleFocus,
        onBlur: this.handleBlur,
        onTouchStart: this.handleTouchStart,
        onKeydown: this.handleKeydown,
      });
      this.logger.debug('Tooltip enhancer initialized');
    } catch (error) {
      this.handleError(error, 'initialize');
    }
  }

  public update(): void {
    // Re-parse config in case attributes changed
    this.config = parseTooltipConfig(this.element);

    // Update tooltip content if it's currently visible
    if (this.isVisible && this.tooltip) {
      updateTooltipContent(this.tooltip, getTooltipContent(this.element));
    }
  }

  public override destroy(): void {
    // `super.destroy()` runs cleanupEventListeners(), which only detaches listeners —
    // none of the tooltip/timer state `hide()` reads below is touched by it.
    super.destroy();

    this.hide();
    // `hide()` above may have just scheduled a 200ms dismissal for the
    // tooltip that was visible — finish it synchronously instead of leaving a
    // DOM node (and a timer) to outlive the enhancer.
    this.finalizeStaleDismissal();
    cleanupTimeouts(this.timers);
  }

  protected override cleanupEventListeners(): void {
    this.element.removeEventListener('mouseenter', this.handleMouseEnter);
    this.element.removeEventListener('mouseleave', this.handleMouseLeave);
    this.element.removeEventListener('focus', this.handleFocus);
    this.element.removeEventListener('blur', this.handleBlur);
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('keydown', this.handleKeydown);
  }

  private handleMouseEnter = (): void => {
    scheduleShow(this.timers, this.config.delay, () => this.show());
  };

  private handleMouseLeave = (): void => {
    // Only hide if we're not moving to the tooltip itself
    scheduleHide(this.timers, () => this.hide());
  };

  private handleFocus = (): void => {
    scheduleShow(this.timers, this.config.delay, () => this.show());
  };

  private handleBlur = (): void => {
    scheduleHide(this.timers, () => this.hide());
  };

  private handleTouchStart = (): void => {
    // On touch devices, toggle tooltip
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  };

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isVisible) {
      this.hide();
    }
  };

  /**
   * Cancels a pending dismissal (the 200ms fade-out `hide()` scheduled) and
   * removes the tooltip it was scheduled for immediately, without waiting out
   * the rest of the fade.
   *
   * Called from `show()` before mounting a new tooltip and from `destroy()` —
   * both are cases where an old tooltip could still be mid-dismissal
   * (`isVisible` is already `false`, but `tooltip` has not been nulled yet).
   * Finishing it here, synchronously, means the timeout `dismissTooltip`
   * scheduled either never fires (it was cancelled) or was already fully
   * handled — `tooltip`/`arrow` are never left pointing at a removed element,
   * and a re-tap can never race the removal of the tooltip it just mounted.
   */
  private finalizeStaleDismissal(): void {
    if (this.timers.dismissTimeout !== null) {
      clearTimeout(this.timers.dismissTimeout);
      this.timers.dismissTimeout = null;
    }
    if (this.tooltip) {
      removeTooltipNow(this.tooltip);
      this.tooltip = null;
      this.arrow = null;
    }
  }

  private async show(): Promise<void> {
    if (this.isVisible) return;

    const content = getTooltipContent(this.element);
    if (!content) return;

    try {
      this.finalizeStaleDismissal();

      const created = createTooltip(content, this.config, {
        onTooltipMouseEnter: () => cleanupTimeouts(this.timers),
        onTooltipMouseLeave: () => scheduleHide(this.timers, () => this.hide()),
      });
      this.tooltip = created.tooltip;
      this.arrow = created.arrow;
      if (!this.tooltip) return;

      this.isVisible = true;
      mountTooltip({
        tooltip: this.tooltip,
        element: this.element,
        logger: this.logger,
      });

      // Give browser a chance to render before positioning
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Position the tooltip using Floating UI
      await positionTooltip({
        tooltip: this.tooltip,
        arrow: this.arrow,
        element: this.element,
        config: this.config,
        logger: this.logger,
        onError: (error, context) => this.handleError(error, context),
      });

      // Add show class for animation
      revealTooltip(this.tooltip);

      // Set ARIA attributes for accessibility
      this.element.setAttribute('aria-describedby', this.tooltip.id);

      this.logger.debug('Tooltip shown');
    } catch (error) {
      this.handleError(error, 'show tooltip');
    }
  }

  private hide(): void {
    if (!this.isVisible || !this.tooltip) return;

    this.isVisible = false;

    // Capture the element/arrow this dismissal is for — the callback must act
    // on these, not on whatever `this.tooltip`/`this.arrow` point to when the
    // timeout fires, or a tooltip mounted by a `show()` in between gets torn
    // down out from under itself (finding 96).
    const dismissedTooltip = this.tooltip;
    const dismissedArrow = this.arrow;
    this.timers.dismissTimeout = dismissTooltip(dismissedTooltip, () => {
      this.timers.dismissTimeout = null;
      // Defensive: under normal operation `show()` always finalizes a stale
      // dismissal (and thus cancels this timeout) before replacing `tooltip`/
      // `arrow`, so these should still be the same elements. Guarded anyway so
      // this callback can never clear a *different* tooltip's fields.
      if (this.tooltip === dismissedTooltip) {
        this.tooltip = null;
      }
      if (this.arrow === dismissedArrow) {
        this.arrow = null;
      }
    });

    // Remove ARIA attributes
    this.element.removeAttribute('aria-describedby');

    this.logger.debug('Tooltip hidden');
  }
}

/**
 * Tooltip event wiring and timers.
 */

export interface TooltipTimers {
  showTimeout: number | null;
  hideTimeout: number | null;
}

export function cleanupTimeouts(timers: TooltipTimers): void {
  if (timers.showTimeout) {
    clearTimeout(timers.showTimeout);
    timers.showTimeout = null;
  }
  if (timers.hideTimeout) {
    clearTimeout(timers.hideTimeout);
    timers.hideTimeout = null;
  }
}

export function scheduleShow(
  timers: TooltipTimers,
  delay: number | undefined,
  onShow: () => void
): void {
  cleanupTimeouts(timers);
  timers.showTimeout = window.setTimeout(() => {
    onShow();
  }, delay);
}

export function scheduleHide(timers: TooltipTimers, onHide: () => void): void {
  cleanupTimeouts(timers);
  timers.hideTimeout = window.setTimeout(() => {
    onHide();
  }, 150); // Slightly longer delay to prevent flicker
}

export interface TooltipEventHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onTouchStart: () => void;
  onKeydown: (e: KeyboardEvent) => void;
}

export function setupEventListeners(
  element: HTMLElement,
  handlers: TooltipEventHandlers
): void {
  // Mouse events
  element.addEventListener('mouseenter', handlers.onMouseEnter);
  element.addEventListener('mouseleave', handlers.onMouseLeave);

  // Focus events for accessibility
  element.addEventListener('focus', handlers.onFocus);
  element.addEventListener('blur', handlers.onBlur);

  // Touch events for mobile
  element.addEventListener('touchstart', handlers.onTouchStart);

  // Escape key to hide tooltip
  document.addEventListener('keydown', handlers.onKeydown);
}

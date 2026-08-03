/**
 * Trigger logic for the simple exit-intent behavior — detecting mobile vs
 * desktop, deciding whether an exit gesture should fire the popup, wiring the
 * mouseleave/scroll listeners, and persisting the trigger count/time to
 * sessionStorage.
 */

import type { Logger } from '@/core/logger';
import type {
  ExitIntentListenerContext,
  ExitIntentListeners,
  ExitIntentSessionData,
  ExitIntentTriggerContext,
  ExitIntentTriggerState,
} from './simple-exit-intent.types';

export function isMobileDevice(): boolean {
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check viewport width (mobile typically < 768px)
  const isMobileWidth = window.innerWidth < 768;

  // Check user agent for mobile devices
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);

  // Consider it mobile if it has touch AND (mobile width OR mobile UA)
  return hasTouch && (isMobileWidth || isMobileUA);
}

export function shouldTrigger(state: ExitIntentTriggerState): boolean {
  if (!state.isEnabled) return false;
  if (state.hasPopup) return false; // Already showing
  if (state.triggerCount >= state.maxTriggers) return false;
  if (Date.now() - state.lastTriggerTime < state.cooldownPeriod) return false;

  // Additional check for mobile even if not disabled globally
  if (state.disableOnMobile && isMobileDevice()) return false;

  return true;
}

export function setupEventListeners(
  ctx: ExitIntentListenerContext
): ExitIntentListeners {
  const listeners: ExitIntentListeners = {
    mouseLeaveHandler: null,
    scrollHandler: null,
  };

  // Desktop: mouse leave detection (always enabled on desktop)
  if (!isMobileDevice()) {
    listeners.mouseLeaveHandler = (e: MouseEvent) => {
      // Check if mouse truly left the page by verifying relatedTarget
      // This works reliably across Safari, Firefox, Edge, and Chrome
      const relatedTarget = e.relatedTarget as Node | null;
      if (
        shouldTrigger(ctx.getTriggerState()) &&
        (!relatedTarget || relatedTarget.nodeName === 'HTML') &&
        e.clientY <= 10
      ) {
        ctx.triggerExitIntent();
      }
    };
    // Use mouseout on documentElement for better cross-browser support
    document.documentElement.addEventListener(
      'mouseout',
      listeners.mouseLeaveHandler
    );
  }

  // Mobile: scroll detection (only if explicitly enabled)
  if (isMobileDevice() && ctx.mobileScrollTrigger) {
    listeners.scrollHandler = () => {
      if (shouldTrigger(ctx.getTriggerState())) {
        const scrollPercent =
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) *
          100;
        if (scrollPercent >= 50) {
          ctx.triggerExitIntent();
        }
      }
    };
    window.addEventListener('scroll', listeners.scrollHandler, {
      passive: true,
    });
  }

  return listeners;
}

/** Bumps the trigger count/time, saves to sessionStorage, then shows the popup — in that order. */
export function triggerExitIntent(ctx: ExitIntentTriggerContext): void {
  ctx.incrementTriggerCount();
  ctx.setLastTriggerTime(Date.now());

  // Save to session storage
  ctx.saveToSessionStorage();

  ctx.showPopup();
}

export function saveToSessionStorage(
  useSessionStorage: boolean,
  sessionStorageKey: string,
  triggerCount: number,
  lastTriggerTime: number,
  logger: Logger
): void {
  if (
    useSessionStorage &&
    typeof window !== 'undefined' &&
    window.sessionStorage
  ) {
    try {
      const data: ExitIntentSessionData = {
        triggerCount,
        lastTriggerTime,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(data));
    } catch (error) {
      logger.debug('Failed to save to session storage:', error);
    }
  }
}

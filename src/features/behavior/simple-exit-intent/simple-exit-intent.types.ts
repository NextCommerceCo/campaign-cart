/**
 * Local types for the simple exit-intent behavior — the `setup()` options
 * shape, and the context objects threaded into the handlers/renderer layers
 * so they don't need to read state off the enhancer instance directly.
 */

import type { Logger } from '@/core/logger';
import type { EventMap } from '@/types/global';

/** Options accepted by `ExitIntentEnhancer.setup()` (i.e. `next.exitIntent({...})`). */
export interface SimpleExitIntentOptions {
  image?: string; // Now optional - use either image or template
  template?: string; // Name of the template to use (e.g., 'exit-intent')
  action?: () => void | Promise<void>;
  disableOnMobile?: boolean;
  mobileScrollTrigger?: boolean; // Enable scroll trigger on mobile
  maxTriggers?: number; // Configure max triggers
  useSessionStorage?: boolean; // Enable/disable session storage
  sessionStorageKey?: string; // Custom session storage key
  overlayClosable?: boolean; // Allow overlay click to close
  showCloseButton?: boolean; // Show close button on modal
  imageClickable?: boolean; // Make image clickable to trigger action (default: true for backward compat)
  actionButtonText?: string; // Text for action button (if provided, shows button instead of clickable image)
}

/**
 * The exit-intent events as an overload set, so a context object can carry a
 * single `emit` callback without losing the event-name/payload pairing that
 * `BaseEnhancer.emit`'s generic signature normally guarantees.
 */
export interface ExitIntentEmit {
  (event: 'exit-intent:shown', detail: EventMap['exit-intent:shown']): void;
  (event: 'exit-intent:clicked', detail: EventMap['exit-intent:clicked']): void;
  (
    event: 'exit-intent:dismissed',
    detail: EventMap['exit-intent:dismissed']
  ): void;
  (event: 'exit-intent:closed', detail: EventMap['exit-intent:closed']): void;
  (event: 'exit-intent:action', detail: EventMap['exit-intent:action']): void;
}

/** State `shouldTrigger` needs to decide whether to fire, threaded explicitly instead of read off `this`. */
export interface ExitIntentTriggerState {
  isEnabled: boolean;
  hasPopup: boolean;
  triggerCount: number;
  maxTriggers: number;
  lastTriggerTime: number;
  cooldownPeriod: number;
  disableOnMobile: boolean;
}

/** Shape persisted to sessionStorage under the (configurable) `sessionStorageKey`. */
export interface ExitIntentSessionData {
  triggerCount: number;
  lastTriggerTime: number;
  timestamp: number;
}

/** The listener handles `setupEventListeners` may create, so the enhancer can remove them on cleanup. */
export interface ExitIntentListeners {
  mouseLeaveHandler: ((e: MouseEvent) => void) | null;
  scrollHandler: ((e: Event) => void) | null;
}

/** What `setupEventListeners` needs from the enhancer to wire up its listeners. */
export interface ExitIntentListenerContext {
  mobileScrollTrigger: boolean;
  getTriggerState: () => ExitIntentTriggerState;
  triggerExitIntent: () => void;
}

/** Callbacks `triggerExitIntent` needs to mutate the enhancer's counters and continue the trigger sequence. */
export interface ExitIntentTriggerContext {
  incrementTriggerCount: () => void;
  setLastTriggerTime: (time: number) => void;
  saveToSessionStorage: () => void;
  showPopup: () => void;
}

/** State the popup renderer needs to build and wire up the popup DOM. */
export interface ExitIntentPopupContext {
  imageUrl: string;
  templateName: string;
  templateElement: HTMLTemplateElement | null;
  action: (() => void | Promise<void>) | null;
  overlayClosable: boolean;
  showCloseButton: boolean;
  imageClickable: boolean;
  actionButtonText: string;
  logger: Logger;
  emit: ExitIntentEmit;
  hidePopup: () => void;
  saveToSessionStorage: () => void;
}

/** The overlay/popup pair a popup-builder function creates. */
export interface ExitIntentPopupElements {
  popupElement: HTMLElement;
  overlayElement: HTMLElement;
}

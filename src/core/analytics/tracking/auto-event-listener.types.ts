import { EventBus } from '@/core/events';

/** Debounce window per event name, in milliseconds. */
export interface EventDebounceConfig {
  [eventName: string]: number;
}

/**
 * What a `setup*EventListeners` function needs from the `AutoEventListener`
 * instance to register its handlers. Passed in rather than imported as a
 * singleton so each handler module stays a plain, testable function.
 */
export interface AutoEventListenerContext {
  eventBus: EventBus;
  eventHandlers: Map<string, Function>;
  /** Debounce gate — see `AutoEventListener.shouldProcessEvent`. */
  shouldProcessEvent(eventName: string): boolean;
  /** Waits for the debounced cart calculation to settle — see `AutoEventListener.waitForCartCalculation`. */
  waitForCartCalculation(timeoutMs?: number): Promise<void>;
}

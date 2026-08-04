/**
 * Loading, saving, and expiring the event timeline's localStorage history.
 * Extracted verbatim from `event-timeline-panel.ts` (see docs/code-findings.md
 * #137) — logic unchanged. The storage-key constants moved here as plain
 * exported `const`s (were `private static readonly` on the class) so the
 * doc-generation source scan (`extract-storage-keys.ts`) attributes them to
 * this file regardless of which module references them; `saveTimeout` and
 * `events` cross the module boundary via a small live-accessor context
 * (`PersistenceHost`) instead of `this`, because the debounced save in
 * `saveEvents` reads both at fire time, not at call time.
 */
import type { TimelineEvent } from './event-timeline-panel.types';

export const EVENTS_STORAGE_KEY = 'debug-events-history';
export const SHOW_INTERNAL_KEY = 'debug-events-show-internal';
export const VIEW_KEY = 'debug-events-view';
const MAX_STORED_EVENTS = 100; // Reduced from 500 to keep localStorage smaller
const STORAGE_EXPIRY_KEY = 'debug-events-expiry';
const STORAGE_EXPIRY_HOURS = 2; // Clear after 2 hours

/** What `saveEvents` needs live (read at fire time, not at call time). */
export interface PersistenceHost {
  readonly events: TimelineEvent[];
  saveTimeout: ReturnType<typeof setTimeout> | null;
}

function checkAndCleanExpiredStorage(): void {
  try {
    const expiryTime = localStorage.getItem(STORAGE_EXPIRY_KEY);
    const now = Date.now();

    if (!expiryTime || parseInt(expiryTime) < now) {
      // Clear expired events
      localStorage.removeItem(EVENTS_STORAGE_KEY);

      // Set new expiry time
      const newExpiry = now + STORAGE_EXPIRY_HOURS * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_EXPIRY_KEY, newExpiry.toString());
    }
  } catch (error) {
    console.error('Failed to check storage expiry:', error);
  }
}

/**
 * Reads saved timeline state. Returns only the fields whose source had a
 * valid value — the caller assigns each present field onto its own state,
 * leaving the rest at their defaults, exactly like the original per-field
 * `if` checks.
 */
export function loadSavedState(formatRelativeTime: (timestamp: number) => string): {
  showInternalEvents?: boolean;
  view?: 'analytics' | 'events';
  events?: TimelineEvent[];
} {
  // Check if stored events have expired
  checkAndCleanExpiredStorage();

  const result: {
    showInternalEvents?: boolean;
    view?: 'analytics' | 'events';
    events?: TimelineEvent[];
  } = {};

  // Load show internal events preference
  const savedShowInternal = localStorage.getItem(SHOW_INTERNAL_KEY);
  if (savedShowInternal !== null) {
    result.showInternalEvents = savedShowInternal === 'true';
  }

  // Load active view (defaults to 'analytics').
  const savedView = localStorage.getItem(VIEW_KEY);
  if (savedView === 'analytics' || savedView === 'events') {
    result.view = savedView;
  }

  // Load saved events
  try {
    const savedEvents = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (savedEvents) {
      const parsed = JSON.parse(savedEvents);
      if (Array.isArray(parsed)) {
        // Only load recent events (last hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        result.events = parsed
          .filter(event => event.timestamp > oneHourAgo)
          .slice(0, MAX_STORED_EVENTS)
          .map(event => ({
            ...event,
            relativeTime: formatRelativeTime(event.timestamp),
          }));
      }
    }
  } catch (error) {
    console.error('Failed to load saved events:', error);
    // Clear corrupted data
    localStorage.removeItem(EVENTS_STORAGE_KEY);
  }

  return result;
}

function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }

    // Filter out DOM elements and Window objects
    if (value instanceof Window) return '[Window]';
    if (value instanceof Document) return '[Document]';
    if (value instanceof HTMLElement) return '[HTMLElement]';
    if (value instanceof Node) return '[Node]';
    if (value instanceof Event) {
      // Extract safe properties from Event objects
      return {
        type: value.type,
        target: value.target ? '[EventTarget]' : undefined,
        timeStamp: value.timeStamp,
        bubbles: value.bubbles,
        cancelable: value.cancelable,
      };
    }

    // Filter out functions
    if (typeof value === 'function') return '[Function]';

    return value;
  });
}

export function saveEvents(ctx: PersistenceHost): void {
  // Debounce saves to avoid too many localStorage writes
  if (ctx.saveTimeout) {
    clearTimeout(ctx.saveTimeout);
  }

  ctx.saveTimeout = setTimeout(() => {
    try {
      // Filter out old events (only keep last hour) and limit count
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentEvents = ctx.events
        .filter(event => event.timestamp > oneHourAgo)
        .slice(0, MAX_STORED_EVENTS);

      // Only save if we have events
      if (recentEvents.length > 0) {
        // Simplify event data to reduce size
        const simplifiedEvents = recentEvents.map(event => ({
          id: event.id,
          timestamp: event.timestamp,
          type: event.type,
          name: event.name,
          // Limit data size to first 200 chars if it's a string
          data:
            typeof event.data === 'string' && event.data.length > 200
              ? event.data.substring(0, 200) + '...'
              : event.data,
          source: event.source,
          isInternal: event.isInternal,
        }));

        const serialized = safeStringify(simplifiedEvents);

        // Check size before saving (localStorage typically has 5-10MB limit)
        if (serialized.length > 500000) {
          // 500KB limit per key
          // If still too large, save only half the events
          const halfEvents = simplifiedEvents.slice(
            0,
            Math.floor(simplifiedEvents.length / 2)
          );
          localStorage.setItem(
            EVENTS_STORAGE_KEY,
            safeStringify(halfEvents)
          );
        } else {
          localStorage.setItem(EVENTS_STORAGE_KEY, serialized);
        }
      }

      // Update expiry if not set
      if (!localStorage.getItem(STORAGE_EXPIRY_KEY)) {
        const expiry = Date.now() + STORAGE_EXPIRY_HOURS * 60 * 60 * 1000;
        localStorage.setItem(STORAGE_EXPIRY_KEY, expiry.toString());
      }
    } catch (error) {
      console.error('Failed to save events:', error);
      // If we hit quota exceeded, clear the events
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        localStorage.removeItem(EVENTS_STORAGE_KEY);
      }
    }
  }, 500); // Debounce for 500ms
}

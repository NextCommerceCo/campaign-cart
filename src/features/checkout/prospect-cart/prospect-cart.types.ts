/**
 * Types for the Prospect Cart feature: the enhancer's public config/data shapes,
 * plus the small context objects each sibling module takes instead of reaching
 * back into {@link ProspectCartEnhancer}.
 */

import type { Logger } from '@/core/logger';
import type { IApiClient } from '@/api/client.types';

export interface ProspectCartConfig {
  autoCreate?: boolean;
  triggerOn?:
    | 'formStart'
    | 'emailEntry'
    | 'phoneEntry'
    | 'emailAndPhone'
    | 'manual';
  emailField?: string;
  phoneField?: string;
  includeUtmData?: boolean;
  sessionTimeout?: number; // minutes
  minPhoneDigits?: number;
}

export interface ProspectCart {
  id: string;
  prospect_id: string;
  email?: string;
  created_at: string;
  expires_at: string;
  utm_data?: Record<string, string>;
  cart_data?: any;
}

/** Needs from the enhancer: `element` to query the field, `logger` to report a miss. */
export interface FieldDiscoveryContext {
  element: HTMLElement;
  logger: Logger;
}

/** Needs from the enhancer: `phoneField` to prefer intl-tel-input's own verdict, the
 *  configured `minPhoneDigits` fallback, and `logger` for a thrown-validator trace. */
export interface PhoneValidationContext {
  phoneField: HTMLInputElement | undefined;
  minPhoneDigits: number | undefined;
  logger: Logger;
}

/** Mutable timeout handle shared between `triggers.ts` and the orchestrator's
 *  `checkAndCreateCart` cleanup, the same `{ value }` ref shape used for guard
 *  state elsewhere in the SDK. */
export interface TimeoutRef {
  value: number | undefined;
}

/** Mutable "has a prospect already been recorded" flag, shared between
 *  `triggers.ts` (the `formStart` handler sets it directly, bypassing field
 *  validation) and the orchestrator's `checkAndCreateCart` gate. */
export interface HasTriggeredRef {
  value: boolean;
}

/** Needs from the enhancer: the fields to listen on, the trigger's config, a place to
 *  park the phone-trigger's debounce handle, and the gate to call once a debounce settles.
 *  `createProspectCart` and `hasTriggeredRef` exist only for `formStart`, which creates
 *  the cart directly instead of going through `checkAndCreateCart`'s validation. */
export interface TriggerContext {
  element: HTMLElement;
  emailField: HTMLInputElement | undefined;
  phoneField: HTMLInputElement | undefined;
  logger: Logger;
  phoneBlurTimeoutRef: TimeoutRef;
  hasTriggeredRef: HasTriggeredRef;
  isValidPhone: (phone: string) => boolean;
  checkAndCreateCart: () => void;
  createProspectCart: () => Promise<void>;
}

/** Mutable prospect-cart handle read and written by `createProspectCart`, shared with
 *  the orchestrator so its public API (`getCurrentProspectCart`, `abandonCart`, …) sees
 *  the same value. */
export interface ProspectCartRef {
  value: ProspectCart | undefined;
}

/** Needs from the enhancer: the API client, the fields to read, config for the
 *  cart's session expiry, a place to store the result, and a way to emit events. */
export interface CartCreationContext {
  apiClient: IApiClient;
  element: HTMLElement;
  emailField: HTMLInputElement | undefined;
  config: ProspectCartConfig;
  logger: Logger;
  prospectCartRef: ProspectCartRef;
  emitProspectEvent: (type: string, data?: any) => void;
  getFormattedPhoneNumber: () => string;
  isValidEmail: (email: string) => boolean;
  isValidPhone: (phone: string) => boolean;
}

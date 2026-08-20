/**
 * What happens to the shopper's contact details once they *finish* with a field —
 * remembering them for next time, and telling the prospect cart about them.
 *
 * Three jobs, all keyed off the same moment:
 *
 * - **the prospect cart's email** is kept in step, so an abandoned checkout can be
 *   recovered by the address the shopper actually typed;
 * - **name, email and phone are written to user-data storage**, which outlives the page —
 *   it is what prefills the form on a later visit and what analytics attaches to events;
 * - **the prospect cart is created** as soon as email, first name and last name are all
 *   known.
 *
 * It runs on `blur` and `change` only, never on `input`. That is deliberate: writing on
 * every keystroke would save `a@`, `a@g`, `a@gm` … and create a prospect cart against a
 * half-typed address, which is a recovery email sent to nobody.
 *
 * Extracted from the field-name routing half of `handleFieldChange`. It needs three things
 * from the form ({@link ContactPersistenceContext}) and touches neither the DOM nor the
 * checkout store.
 */

import type { Iti } from 'intl-tel-input';

import type { Logger } from '@/core/logger';
import { userDataStorage } from '@/core/analytics/user-data-storage';
import type { ProspectCartEnhancer } from '../prospect-cart/prospect-cart.enhancer';
import { normalizePhone } from '../validation/phone-validation';

/** The three things this module needs from the checkout form. */
export interface ContactPersistenceContext {
  /**
   * The prospect cart, when one exists. Absent on a form whose prospect cart failed to
   * initialise, in which case only user-data storage is written.
   */
  prospectCartEnhancer: ProspectCartEnhancer | undefined;
  /** `intl-tel-input` instances keyed `shipping` / `billing`, for the E.164 phone number. */
  phoneInputs: Map<string, Iti>;
  logger: Logger;
}

/** The subset of stored user data this module writes. */
interface ContactUpdates {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** The fields whose values are worth keeping beyond this page. */
const PERSISTED_FIELDS = ['email', 'fname', 'lname', 'phone'];

/** The fields that together are enough to create a prospect cart. */
const PROSPECT_CART_FIELDS = ['email', 'fname', 'lname'];

/**
 * Commits one contact field the shopper has finished with.
 *
 * Call only for `blur` and `change`; anything else is the shopper mid-word. `fieldName` is
 * the shipping-side name (`email`, `fname`, `lname`, `phone`) — any other name is ignored,
 * so it is safe to call for every field.
 *
 * @example
 * ```ts
 * if (event.type === 'blur' || event.type === 'change') {
 *   persistContactField({ prospectCartEnhancer, phoneInputs, logger }, 'email', input.value);
 * }
 * ```
 */
export function persistContactField(
  ctx: ContactPersistenceContext,
  fieldName: string,
  value: string
): void {
  // Update ProspectCartEnhancer when email changes
  if (fieldName === 'email' && ctx.prospectCartEnhancer) {
    ctx.prospectCartEnhancer.updateEmail(value);
  }

  // Save user data to cookies for persistence
  if (PERSISTED_FIELDS.includes(fieldName)) {
    const updates: ContactUpdates = {};
    if (fieldName === 'email') updates.email = value;
    if (fieldName === 'fname') updates.firstName = value;
    if (fieldName === 'lname') updates.lastName = value;
    if (fieldName === 'phone') {
      // Stored international, so a shopper who returns on a later page is repopulated
      // with a number the orders API takes as-is.
      updates.phone = normalizePhone(value, ctx.phoneInputs.get('shipping'));
    }

    userDataStorage.updateUserData(updates);
    ctx.logger.debug(
      'Updated user data storage:',
      fieldName,
      updates[
        fieldName === 'fname'
          ? 'firstName'
          : fieldName === 'lname'
            ? 'lastName'
            : (fieldName as keyof ContactUpdates)
      ]
    );
  }

  // Check if we have enough data to create prospect cart
  if (ctx.prospectCartEnhancer && PROSPECT_CART_FIELDS.includes(fieldName)) {
    ctx.prospectCartEnhancer.checkAndCreateCart();
  }
}

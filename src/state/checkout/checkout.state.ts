/**
 * Checkout Store - Zustand store for checkout flow state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeVoucherCode } from '@/utils/voucher';
import { isExpressPaymentMethod } from '@/utils/payment-method';
import { CHECKOUT_STORAGE_KEY } from '@/core/storage';
import type { CheckoutPaymentMethod } from '@/types/global';

export interface CheckoutState {
  step: number;
  isProcessing: boolean;
  errors: Record<string, string>;
  formData: Record<string, any>;
  paymentToken?: string;
  paymentMethod: CheckoutPaymentMethod;
  shippingMethod?:
    | {
        id: number;
        name: string;
        price: number;
        code: string;
      }
    | undefined;
  billingAddress?:
    | {
        first_name: string;
        last_name: string;
        address1: string;
        address2?: string | undefined;
        city: string;
        province: string;
        postal: string;
        country: string;
        phone: string;
      }
    | undefined;
  sameAsShipping: boolean;
  testMode: boolean;
  vouchers: string[];
}

interface CheckoutActions {
  setStep: (step: number) => void;
  setProcessing: (processing: boolean) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  updateFormData: (data: Record<string, any>) => void;
  setPaymentToken: (token: string) => void;
  setPaymentMethod: (method: CheckoutState['paymentMethod']) => void;
  setShippingMethod: (method: CheckoutState['shippingMethod']) => void;
  setBillingAddress: (address: CheckoutState['billingAddress']) => void;
  setSameAsShipping: (same: boolean) => void;
  setTestMode: (testMode: boolean) => void;
  addVoucher: (code: string) => void;
  removeVoucher: (code: string) => void;
  reset: () => void;
}

/**
 * Every field of `T` spelled out — an optional key becomes a **required** key whose type
 * still allows `undefined`. Annotating {@link initialState} with it is what makes a
 * forgotten field a compile error; see the note there for why that matters.
 */
type AllFieldsOf<T> = { [K in Extract<keyof T, string>]: T[K] };

/**
 * The state a fresh checkout starts from, and the only thing `reset()` writes.
 *
 * Every field is listed, including the three that are optional, because `reset()` calls
 * `set(initialState)` and Zustand's `set` **merges**: a field missing here is a field a
 * reset cannot clear. That is not hypothetical — `billingAddress`, `paymentToken` and
 * `shippingMethod` were once absent, and two of them persist, so finishing an order and
 * starting another in the same tab carried the previous shopper's billing address and card
 * token into the next checkout on a shared or kiosk browser.
 *
 * The {@link AllFieldsOf} annotation is the guard against that happening again: add an
 * optional field to {@link CheckoutState} and forget it here, and this literal stops
 * compiling.
 */
const initialState: AllFieldsOf<CheckoutState> = {
  step: 1,
  isProcessing: false,
  errors: {},
  formData: {},
  paymentToken: undefined,
  paymentMethod: 'credit-card',
  shippingMethod: undefined,
  billingAddress: undefined,
  sameAsShipping: true,
  testMode: false,
  vouchers: [],
};

/**
 * The checkout store — the shopper's in-progress checkout: entered form fields,
 * selected payment/shipping, and processing flags. Read it to prefill or inspect
 * the checkout; it persists across reloads so a shopper doesn't lose progress.
 *
 * @example
 * ```ts
 * const { paymentMethod, sameAsShipping } = useCheckoutStore.getState();
 * ```
  * @category Checkout
 */
export const useCheckoutStore = create<CheckoutState & CheckoutActions>()(
  persist(
    set => ({
      ...initialState,

      setStep: (step: number) => {
        set({ step });
      },

      setProcessing: (isProcessing: boolean) => {
        set({ isProcessing });
      },

      setError: (field: string, error: string) => {
        set(state => ({
          errors: { ...state.errors, [field]: error },
        }));
      },

      clearError: (field: string) => {
        set(state => {
          const { [field]: _, ...errors } = state.errors;
          return { errors };
        });
      },

      clearAllErrors: () => {
        set({ errors: {} });
      },

      updateFormData: (data: Record<string, any>) => {
        set(state => ({
          formData: { ...state.formData, ...data },
        }));
      },

      setPaymentToken: (paymentToken: string) => {
        set({ paymentToken });
      },

      setPaymentMethod: (paymentMethod: CheckoutState['paymentMethod']) => {
        set({ paymentMethod });
      },

      setShippingMethod: (shippingMethod: CheckoutState['shippingMethod']) => {
        set({ shippingMethod });
      },

      setBillingAddress: (billingAddress: CheckoutState['billingAddress']) => {
        set({ billingAddress });
      },

      setSameAsShipping: (sameAsShipping: boolean) => {
        set({ sameAsShipping });
      },

      setTestMode: (testMode: boolean) => {
        set({ testMode });
      },

      addVoucher: (code: string) => {
        set(state => ({
          vouchers: [...state.vouchers, code],
        }));
      },

      removeVoucher: (code: string) => {
        const normalizedCode = normalizeVoucherCode(code);
        set(state => ({
          vouchers: state.vouchers.filter(
            v => normalizeVoucherCode(v) !== normalizedCode
          ),
        }));
      },

      /**
       * Returns every field to its initial value — step 1, empty form, no coupons,
       * `credit-card`, and no billing address, card token or shipping method.
       *
       * Deliberately a **merge** rather than a replace (`set(initialState, true)`): the
       * setters above sit on the same object as the state, so replacing would take them
       * with it and leave a store with no methods. What a merge needs instead is an
       * {@link initialState} that names every field — which its annotation enforces.
       */
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: CHECKOUT_STORAGE_KEY,
      storage: {
        getItem: name => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: name => {
          sessionStorage.removeItem(name);
        },
      },
      // Exclude transient state from persistence
      partialize: state => {
        // Don't persist express payment methods (they should reset to credit-card on page load/navigation)
        const paymentMethod = isExpressPaymentMethod(state.paymentMethod)
          ? 'credit-card'
          : state.paymentMethod;

        // Filter out sensitive payment fields from formData
        const {
          cvv,
          card_cvv,
          month,
          expiration_month,
          year,
          expiration_year,
          'exp-month': expMonth,
          'exp-year': expYear,
          card_number,
          ...remainingFormData
        } = state.formData;

        // Remove empty string values from formData (no point persisting empty fields)
        const safeFormData = Object.fromEntries(
          Object.entries(remainingFormData).filter(([_, value]) => {
            // Keep non-empty strings, booleans, and numbers
            if (typeof value === 'string') return value.trim() !== '';
            if (typeof value === 'boolean' || typeof value === 'number')
              return true;
            return false;
          })
        );

        // Filter out empty billing address fields
        let billingAddress = state.billingAddress;
        if (billingAddress) {
          const filteredBilling = Object.fromEntries(
            Object.entries(billingAddress).filter(([_, value]) => {
              if (typeof value === 'string') return value.trim() !== '';
              return false;
            })
          );
          // Only persist if there's at least one non-empty field
          billingAddress =
            Object.keys(filteredBilling).length > 0
              ? (filteredBilling as any)
              : undefined;
        }

        return {
          step: state.step,
          formData: safeFormData, // Exclude CVV, expiration, card number, and empty values
          shippingMethod: state.shippingMethod,
          billingAddress, // Only non-empty billing fields
          sameAsShipping: state.sameAsShipping,
          paymentMethod, // Every method except the three express ones survives a reload
          vouchers: state.vouchers, // Persist so user-entered coupons survive refresh; bundle vouchers are deduped on re-apply
          // Explicitly exclude:
          // - errors (transient validation state)
          // - isProcessing (transient UI state)
          // - paymentToken (sensitive, should not persist)
          // - testMode (session-specific)
          // - CVV, card number, expiration (sensitive payment data)
          // - Empty string values (no benefit to persist)
        } as any;
      },
    }
  )
);

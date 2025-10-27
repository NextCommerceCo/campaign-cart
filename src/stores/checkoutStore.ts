/**
 * Checkout Store - Zustand store for checkout flow state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CheckoutState {
  step: number;
  isProcessing: boolean;
  errors: Record<string, string>;
  formData: Record<string, any>;
  paymentToken?: string;
  paymentMethod: 'card_token' | 'paypal' | 'apple_pay' | 'google_pay' | 'credit-card' | 'klarna';
  shippingMethod?: {
    id: number;
    name: string;
    price: number;
    code: string;
  } | undefined;
  billingAddress?: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string | undefined;
    city: string;
    province: string;
    postal: string;
    country: string;
    phone: string;
  } | undefined;
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

const initialState: CheckoutState = {
  step: 1,
  isProcessing: false,
  errors: {},
  formData: {},
  paymentMethod: 'credit-card',
  sameAsShipping: true,
  testMode: false,
  vouchers: [],
};

export const useCheckoutStore = create<CheckoutState & CheckoutActions>()(
  persist(
    (set) => ({
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
        set(state => ({
          vouchers: state.vouchers.filter(v => v !== code),
        }));
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'next-checkout-store', // Key in sessionStorage
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
      // Exclude transient state from persistence
      partialize: (state) => {
        // Don't persist express payment methods (they should reset to credit-card on page load/navigation)
        const paymentMethod = (state.paymentMethod === 'apple_pay' ||
                               state.paymentMethod === 'google_pay' ||
                               state.paymentMethod === 'paypal')
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
            if (typeof value === 'boolean' || typeof value === 'number') return true;
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
          billingAddress = Object.keys(filteredBilling).length > 0 ? filteredBilling as any : undefined;
        }

        return {
          step: state.step,
          formData: safeFormData, // Exclude CVV, expiration, card number, and empty values
          shippingMethod: state.shippingMethod,
          billingAddress, // Only non-empty billing fields
          sameAsShipping: state.sameAsShipping,
          paymentMethod, // Only persist credit-card/klarna, not express methods
          // Explicitly exclude:
          // - errors (transient validation state)
          // - isProcessing (transient UI state)
          // - paymentToken (sensitive, should not persist)
          // - testMode (session-specific)
          // - vouchers (will be revalidated on page load)
          // - CVV, card number, expiration (sensitive payment data)
          // - Empty string values (no benefit to persist)
        } as any;
      },
    }
  )
);
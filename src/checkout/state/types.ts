import type { Address, User } from '../../engine/events/checkout';
import type { CheckoutError, OpenCart } from '../../engine/types';

declare module '../../engine/types' {
  interface State {
    checkout?: CheckoutState;
  }
}

export interface CountryOption {
  code: string;
  name: string;
}

export type FieldError =
  'blank' | 'not_selected' | 'invalid' | 'invalid_characters' | 'contains_emoji' | 'too_long' | 'not_in_state';

export interface FieldFormat {
  pattern?: string;
  example?: string;
  masks?: Array<string | { start?: string; mask: string }>;
  calling_code?: string;
  national_prefix?: string;
}

export interface FieldRule {
  required: boolean;
  /** Where its texts are in i18n-rules' `/v1/locales`: `fields.postcode.zip_code`. */
  label_id?: string;
  label?: string;
  label_optional?: string;
  autocomplete?: string;
  input?: {
    type?: string;
    placeholder?: string;
    max_length?: number;
    input_mode?: string;
    auto_capitalize?: string;
    span?: number;
  };
  format?: FieldFormat;
  errors?: Partial<Record<FieldError, string>>;
}

export type FormatPart = { field: string } | { text: string };

export interface CountryRules {
  country: CountryOption;
  fields: Partial<Record<string, FieldRule>>;
  states?: CountryOption[];
  address?: { layout: string[][]; format?: FormatPart[][]; format_latin?: FormatPart[][] };
}

export interface PhoneRead {
  value: string;
  country: string;
  national?: string;
  international?: string;
}

export interface CheckoutState {
  fields: Record<string, string>;
  phones: Record<string, PhoneRead>;
  sameAsShipping: boolean;
  paymentMethod: string;
  step: number;
  /** The step each page of this checkout showed, by path: a page the shopper comes back to shows its own step. */
  steps?: Record<string, number>;
  errors: Record<string, CheckoutError>;
  status: 'idle' | 'placing' | 'placed';
  countries: CountryOption[];
  rules: Record<string, CountryRules>;
  rulesDown?: boolean;
  prospectSaved: boolean;
  openCart?: OpenCart;
  user?: User;
  shippingAddress?: Address;
  billingAddress?: Address;
  cardReady?: boolean;
  pendingRef?: string;
  /** The payment method of the order at the gateway: an express button's, which the form never selected. */
  pendingMethod?: string;
  /** The order placed last came from an express button, not the form; kept on this page only. */
  express?: boolean;
  /** The checkout's `Checkout.id`, set when it starts; a paid order starts a new one. */
  id?: string;
  /** The analytics events already sent for this checkout, such as `add_shipping_info`. */
  reported?: string[];
}

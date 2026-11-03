import type { Attribution } from '../../engine/attribution';
import type { ApiLine } from '../../engine/cart/types';
import type { CheckoutError } from '../../engine/types';

export interface AddressSuggestion {
  label: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    state_code: string;
    postcode: string;
    country: string;
    country_code: string;
  };
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
  errors: Record<string, CheckoutError>;
  status: 'idle' | 'placing' | 'placed';
  countries: CountryOption[];
  rules: Record<string, CountryRules>;
  rulesDown?: boolean;
  prospectSaved: boolean;
  pendingRef?: string;
  failurePath?: string;
}

export interface Address {
  first_name: string;
  last_name: string;
  line1: string;
  line2?: string;
  line4: string;
  state?: string;
  postcode?: string;
  country: string;
  phone_number?: string;
}

export interface OrderUser {
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  phone_number?: string;
  accepts_marketing: boolean;
}

export interface OrderBody {
  lines: ApiLine[];
  shipping_address?: Address;
  billing_same_as_shipping_address?: boolean;
  billing_address?: Address;
  shipping_method: number;
  payment_detail: { payment_method: string; card_token?: string };
  user?: OrderUser;
  vouchers: string[];
  attribution: Attribution;
  currency: string;
  success_url: string;
  payment_failed_url: string;
}

export interface ProspectBody {
  lines: ApiLine[];
  user: OrderUser;
  currency: string;
  attribution: Attribution;
}

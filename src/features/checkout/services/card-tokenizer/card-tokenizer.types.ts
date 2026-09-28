/**
 * What passes between `CreditCardService` and NextPayment. The service owns everything
 * on the page (classes, error labels, floating labels, analytics); the tokenizer owns
 * only the script, and translates its callbacks into the shapes below.
 */

import type { CardTextKey } from './card-texts';

/** The two fields that live in the provider's iframe. */
export type HostedCardField = 'number' | 'cvv';

/** Every field a card error can point at. `undefined` is an error about no one field. */
export type CardErrorField = HostedCardField | 'month' | 'year' | 'full_name';

/**
 * What changed in a hosted field. `hasValue` and `valid` are `undefined` when the event
 * does not carry them: a focus or blur says nothing about the value. `validation` is the
 * provider re-reporting validity without the shopper typing, so it clears no error.
 */
export interface HostedFieldState {
  field: HostedCardField;
  action: 'focus' | 'blur' | 'input' | 'validation';
  hasValue?: boolean;
  valid?: boolean;
}

/**
 * One reason a card could not be tokenized. `textKey` is where the sentence lives in the
 * address-rules service's locale file; `message` is the English the provider sent, or
 * ours when it sent none, and is shown when no translation is available.
 */
export interface CardError {
  field?: CardErrorField;
  textKey: CardTextKey;
  message: string;
}

/** The payment method the provider returned with a token: last four, card type and so on. */
export type CardPaymentMethod = Record<string, unknown>;

/** The cardholder data a tokenize call sends along with the hosted fields. */
export interface CardHolderData {
  full_name: string;
  month: string;
  year: string;
}

export interface CardTokenizerEvents {
  onReady: () => void;
  onFieldState: (state: HostedFieldState) => void;
  /** A tokenize attempt failed, or the provider reported a failure of its own. Never empty. */
  onError: (errors: CardError[]) => void;
  onToken: (token: string, paymentMethod: CardPaymentMethod) => void;
}

/** Where the hosted fields mount, and the texts they show. */
export interface HostedFieldsMount {
  numberId: string;
  cvvId: string;
  labels: Record<HostedCardField, string>;
  placeholders: Record<HostedCardField, string>;
  titles: Record<HostedCardField, string>;
}

/**
 * The seam between `CreditCardService` and whichever script draws the hosted card
 * fields. The service owns everything on the page (classes, error labels, floating
 * labels, analytics); a tokenizer owns only the provider's script and translates its
 * events into the shapes below, so the service never branches on the provider.
 */

import type { CardTextKey } from './card-texts';

/** The two fields that live in the provider's iframe. */
export type HostedCardField = 'number' | 'cvv';

/** Every field a card error can point at. `undefined` is an error about no one field. */
export type CardErrorField = HostedCardField | 'month' | 'year' | 'full_name';

/** The script that draws the hosted fields. */
export type CardTokenizerProvider = 'spreedly' | 'next-payment';

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

export interface CardTokenizer {
  readonly provider: CardTokenizerProvider;
  /** Loads the provider's script and mounts the fields. `onReady` fires when they take input. */
  mount(mount: HostedFieldsMount, events: CardTokenizerEvents): Promise<void>;
  /** Starts a tokenize attempt; the outcome arrives through `onToken` or `onError`. */
  tokenize(card: CardHolderData): void;
  focus(field: HostedCardField): void;
  /** No-op where the provider cannot change a placeholder after mounting. */
  setPlaceholder(field: HostedCardField, text: string): void;
  /** Empties the hosted fields. */
  reset(): void;
  destroy(): void;
}

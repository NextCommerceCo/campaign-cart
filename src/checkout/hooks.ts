import type { Lead } from './state/contact';
import type { Scope } from './state/rules';
import type { Checkout } from '../engine/events/checkout';
import type { AddressSuggestion } from '../engine/types';

/** What 0.4.x support adds to a checkout: `compat/checkout.ts` makes them, `bindCheckout` calls them. */
export interface CheckoutHooks {
  lead?(): Lead | undefined;
  countries?(): string[];
  hiddenStates?(): string[];
  autocomplete?(): boolean;
  addressFilled?(type: 'shipping' | 'billing', components: AddressSuggestion): void;
  expressOrder?(): string[] | undefined;
  walletChecks?(): Scope | null | undefined;
  opened?(checkout: Checkout): void;
  /** Once the page's parts are bound, before the first render. */
  bound?(): void;
  /** A step passed its checks, before the next step's page opens. */
  advanced?(): void;
  /** An order was placed, before the page leaves. */
  placed?(): void;
}

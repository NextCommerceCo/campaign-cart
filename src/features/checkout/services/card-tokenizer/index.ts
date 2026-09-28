/**
 * Gate for the hosted card fields' providers — re-exports and the one choice between
 * them, no other logic.
 */

import type { CardInputConfig } from '@/types/global';

import type { CardTokenizer } from './card-tokenizer.types';
import { NextPaymentTokenizer } from './next-payment';
import { SpreedlyIframeTokenizer } from './spreedly-iframe';

export * from './card-tokenizer.types';
export { cardErrorKey, cardText, translatedCardText } from './card-texts';
export type { CardTextKey } from './card-texts';

/** `cardInputConfig.provider` picks the script; Spreedly's iFrame when it is unset. */
export function createCardTokenizer(
  environmentKey: string,
  config?: CardInputConfig
): CardTokenizer {
  return config?.provider === 'next-payment'
    ? new NextPaymentTokenizer(environmentKey, config)
    : new SpreedlyIframeTokenizer(environmentKey, config);
}

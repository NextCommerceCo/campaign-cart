/** A payment method the Campaigns API knows, by its code. */
export interface PaymentMethod {
  /** The name a page shows. */
  label: string;
  /** What pages and campaigns also call it. */
  aliases?: readonly string[];
  /** A wallet the shopper picks in the form: it gives the shopper's details, so the form may check less. */
  wallet?: boolean;
  /** Offered as an express button. */
  express?: boolean;
}

export const PAYMENT_METHODS: Readonly<Record<string, PaymentMethod>> = {
  card_token: { label: 'Credit Card', aliases: ['credit', 'credit_card', 'card', 'bankcard'] },
  saved_card: { label: 'Saved Card' },
  apple_pay: { label: 'Apple Pay', wallet: true, express: true },
  google_pay: { label: 'Google Pay', wallet: true, express: true },
  paypal: { label: 'PayPal', wallet: true, express: true },
  shop_pay: { label: 'Shop Pay', express: true },
  ideal: { label: 'iDEAL' },
  sepa_debit: { label: 'SEPA Direct Debit' },
  klarna: { label: 'Klarna' },
  link: { label: 'Link' },
  affirm: { label: 'Affirm' },
  bancontact: { label: 'Bancontact' },
  external: { label: 'External' },
  giropay: { label: 'Giropay' },
  sofort: { label: 'Sofort' },
  swish: { label: 'Swish' },
  twint: { label: 'Twint' },
};

const ALIASES = new Map(
  Object.entries(PAYMENT_METHODS).flatMap(([code, m]) => (m.aliases ?? []).map((alias) => [alias, code] as const)),
);

/** The API's code for a method a page or a campaign names: `credit-card` and `bankcard` are `card_token`. */
export function paymentCode(word: string): string {
  const code = word.trim().toLowerCase().replace(/[\s-]/g, '_');
  return ALIASES.get(code) ?? code;
}

/** The name a page shows for a method: its label, else the code as the API sent it. */
export const paymentLabel = (code: string): string => PAYMENT_METHODS[paymentCode(code)]?.label ?? code;

/** `payment_type` as 0.4.x analytics sent it: `Credit Card` for a card, else the API's code. */
export const paymentType = (code: string | undefined): string | undefined =>
  code === 'card_token' ? PAYMENT_METHODS.card_token!.label : code;

export const isWallet = (code: string): boolean => !!PAYMENT_METHODS[code]?.wallet;

export const isExpress = (code: string): boolean => !!PAYMENT_METHODS[code]?.express;

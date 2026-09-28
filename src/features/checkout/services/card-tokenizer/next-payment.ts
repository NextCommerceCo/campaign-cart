/**
 * The hosted card fields drawn by NextPayment, served per environment key from
 * `payments.29next.com/js/v1/payment.js?env_key=…`. The script arrives with its
 * signed credentials already in it and defines `window.NextPayment` once per page.
 *
 * Its callbacks do not line up with a tokenize attempt the way Spreedly's do, and that
 * is what most of this file is about:
 *
 * - `onValidation` reports `month` / `year` / `full_name` from NextPayment's own check
 *   inside `submit()`, and nothing else follows: no `onError`, no `onTokenized`. Those
 *   errors end the attempt here.
 * - It also reports `number` / `cvv`, and a rejected attempt then gets an `onError`
 *   repeating them as a bare string. The structured errors are kept, and the echo ends
 *   the attempt with them.
 * - `onTokenized` hands back the whole response; the token a card order needs is
 *   `tokenResponse.payment_method.token`, not `tokenResponse.token`, which is the
 *   transaction's.
 */

import { createLogger } from '@/core/logger';
import type { CardInputConfig } from '@/types/global';

import { cardErrorField, cardErrorKey } from './card-texts';
import type {
  CardError,
  CardErrorField,
  CardHolderData,
  CardPaymentMethod,
  CardTokenizer,
  CardTokenizerEvents,
  HostedCardField,
  HostedFieldsMount,
} from './card-tokenizer.types';

const SCRIPT_URL = 'https://payments.29next.com/js/v1/payment.js';

/** `{ attribute: 'number', key: 'errors.invalid', message: 'Card number is invalid' }`. */
interface NextPaymentFieldError {
  attribute?: string;
  key?: string;
  message?: string;
}

interface NextPaymentOptions {
  numberEl: string;
  cvvEl: string;
  numberFormat?: string;
  labels?: Record<HostedCardField, string>;
  placeholder?: Record<HostedCardField, string>;
  titles?: Record<HostedCardField, string>;
  styling?: Partial<
    Record<HostedCardField | 'placeholder', Record<string, string>>
  >;
}

interface NextPaymentInstance {
  onReady: () => void;
  onValidation: (payload: { errors?: NextPaymentFieldError[] }) => void;
  onError: (error: unknown) => void;
  onTokenized: (result: unknown) => void;
  onFieldStateChange: (payload: { field?: unknown; action?: unknown }) => void;
  setFocus(field: HostedCardField): void;
  submit(formData: CardHolderData): void;
  destroy(): void;
}

declare global {
  interface Window {
    NextPayment?: new (options: NextPaymentOptions) => NextPaymentInstance;
  }
}

/** The options only Spreedly's iFrame script can apply; NextPayment fixes them itself. */
const UNSUPPORTED_OPTIONS = [
  'fieldType',
  'enableAutoComplete',
  'requiredAttributes',
  'allowBlankName',
  'allowExpiredDate',
  'fraud',
  'nonce',
  'timestamp',
  'certificateToken',
  'signature',
] as const;

/**
 * The same look the Spreedly fields default to, as NextPayment takes it: camelCase
 * properties, not a CSS string.
 */
const DEFAULT_FIELD_STYLE: Record<string, string> = {
  color: '#212529',
  fontSize: '.925rem',
  fontWeight: '400',
  width: '100%',
  height: '100%',
  fontFamily:
    'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans","Liberation Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"',
};

/**
 * `'font-size: 1rem; font-family: "A; B", serif'` → `{ fontSize: '1rem', fontFamily:
 * '"A; B", serif' }`. A `;` inside quotes or parentheses does not end a declaration.
 */
export function cssTextToStyle(css: string): Record<string, string> {
  const style: Record<string, string> = {};
  const declarations: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;
  for (const char of css) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (char === ';' && depth === 0) {
      declarations.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  declarations.push(current);

  for (const declaration of declarations) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!property || !value) continue;
    style[property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] =
      value;
  }
  return style;
}

/**
 * NextPayment sends `errors.invalid` for an empty number or CVV too, and says which it
 * was only in its English: `Card number is required` / `Card number is invalid`.
 */
function isEmptyFieldError(error: NextPaymentFieldError): boolean {
  return error.key === 'errors.blank' || /required/i.test(error.message ?? '');
}

function toCardError(error: NextPaymentFieldError): CardError {
  const field = cardErrorField(error.attribute);
  return {
    ...(field && { field }),
    textKey: cardErrorKey(field, error.key, isEmptyFieldError(error)),
    message: error.message ?? 'An error occurred processing your payment.',
  };
}

/**
 * `onError`'s payload, which depends on what failed: a string, a gateway response
 * `{ errors: [...] }`, `{ message, reason }` when the CVV outlived its three minutes,
 * or `{ message }`.
 */
export function normalizeNextPaymentError(error: unknown): CardError[] {
  if (typeof error === 'string') {
    return [{ textKey: 'payment.errors.generic', message: error }];
  }
  if (error && typeof error === 'object') {
    const { errors, message, reason } = error as {
      errors?: unknown;
      message?: unknown;
      reason?: unknown;
    };
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.map(e => toCardError(e as NextPaymentFieldError));
    }
    if (typeof message === 'string') {
      return [
        {
          textKey:
            reason !== undefined
              ? 'payment.errors.session_expired'
              : 'payment.errors.generic',
          message,
        },
      ];
    }
  }
  return [
    {
      textKey: 'payment.errors.generic',
      message: 'An error occurred processing your payment. Please try again.',
    },
  ];
}

/** `tokenResponse.payment_method`, when the response has one. */
function paymentMethodOf(result: unknown): CardPaymentMethod | undefined {
  const paymentMethod = (
    result as { tokenResponse?: { payment_method?: unknown } } | null
  )?.tokenResponse?.payment_method;
  return paymentMethod && typeof paymentMethod === 'object'
    ? (paymentMethod as CardPaymentMethod)
    : undefined;
}

const PRE_VALIDATED: ReadonlySet<CardErrorField | undefined> = new Set([
  'month',
  'year',
  'full_name',
]);

let scriptLoad: Promise<void> | undefined;

/** Once per page: the script defines `window.NextPayment` once and skips a second load. */
function loadScript(environmentKey: string): Promise<void> {
  if (window.NextPayment) return Promise.resolve();
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}?env_key=${encodeURIComponent(environmentKey)}`;
    script.async = true;
    script.onload = () =>
      window.NextPayment
        ? resolve()
        : reject(new Error('NextPayment script loaded without NextPayment'));
    script.onerror = () => reject(new Error('Failed to load NextPayment'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptLoad = undefined;
    throw error;
  });
  return scriptLoad;
}

export class NextPaymentTokenizer implements CardTokenizer {
  public readonly provider = 'next-payment';
  private readonly logger = createLogger('CreditCardService');
  private instance: NextPaymentInstance | undefined;
  private ready = false;
  private mounted: [HostedFieldsMount, CardTokenizerEvents] | undefined;
  /** A tokenize attempt is waiting for its outcome. */
  private pending = false;
  /** The number / CVV errors of the pending attempt, for the echo that ends it. */
  private fieldErrors: CardError[] = [];

  constructor(
    private readonly environmentKey: string,
    private readonly config?: CardInputConfig
  ) {}

  public async mount(
    mount: HostedFieldsMount,
    events: CardTokenizerEvents
  ): Promise<void> {
    this.mounted = [mount, events];
    const ignored = UNSUPPORTED_OPTIONS.filter(
      option => this.config?.[option] !== undefined
    );
    if (ignored.length > 0) {
      this.logger.debug('NextPayment ignores these card options:', ignored);
    }

    await loadScript(this.environmentKey);
    this.create(mount, events);
  }

  public tokenize(card: CardHolderData): void {
    if (!this.instance) return;
    this.pending = true;
    this.fieldErrors = [];
    this.instance.submit({ ...card });
  }

  public focus(field: HostedCardField): void {
    if (this.ready) this.instance?.setFocus(field);
  }

  /** NextPayment sets its placeholders once, at mount. */
  public setPlaceholder(): void {}

  public reset(): void {
    if (!this.mounted) return;
    this.teardown();
    this.create(...this.mounted);
  }

  public destroy(): void {
    this.teardown();
    this.mounted = undefined;
  }

  private teardown(): void {
    this.instance?.destroy();
    this.instance = undefined;
    this.ready = false;
    this.pending = false;
  }

  private create(mount: HostedFieldsMount, events: CardTokenizerEvents): void {
    const NextPayment = window.NextPayment;
    if (!NextPayment) return;

    const styles = this.config?.styles;
    const instance = new NextPayment({
      numberEl: mount.numberId,
      cvvEl: mount.cvvId,
      numberFormat: this.config?.numberFormat ?? 'prettyFormat',
      labels: mount.labels,
      placeholder: mount.placeholders,
      titles: mount.titles,
      styling: {
        number: styles?.number
          ? cssTextToStyle(styles.number)
          : DEFAULT_FIELD_STYLE,
        cvv: styles?.cvv ? cssTextToStyle(styles.cvv) : DEFAULT_FIELD_STYLE,
        ...(styles?.placeholder && {
          placeholder: cssTextToStyle(styles.placeholder),
        }),
      },
    });
    this.instance = instance;

    instance.onReady = () => {
      if (this.instance !== instance) return;
      this.logger.info('[NextPayment] Hosted fields ready');
      this.ready = true;
      events.onReady();
    };

    instance.onFieldStateChange = payload => {
      const field = payload?.field;
      const action = payload?.action;
      if (field !== 'number' && field !== 'cvv') return;
      if (action === 'focus' || action === 'blur') {
        events.onFieldState({ field, action });
      }
    };

    instance.onValidation = payload => {
      const errors = (payload?.errors ?? []).map(toCardError);
      const preValidation = errors.filter(e => PRE_VALIDATED.has(e.field));
      if (this.pending && preValidation.length > 0) {
        this.settle(events, preValidation);
        return;
      }

      const action = this.pending ? 'validation' : 'input';
      for (const field of ['number', 'cvv'] as const) {
        const error = errors.find(e => e.field === field);
        events.onFieldState({
          field,
          action,
          valid: !error,
          hasValue: !error || error.textKey.endsWith('.invalid'),
        });
      }
      if (this.pending) {
        this.fieldErrors = errors.filter(e => !PRE_VALIDATED.has(e.field));
      }
    };

    instance.onError = error => {
      const errors =
        this.pending && this.fieldErrors.length > 0
          ? this.fieldErrors
          : normalizeNextPaymentError(error);
      this.logger.error(
        '[NextPayment] Tokenization failed:',
        errors.map(e => ({ field: e.field, key: e.textKey }))
      );
      this.settle(events, errors);
    };

    instance.onTokenized = result => {
      this.pending = false;
      const paymentMethod = paymentMethodOf(result);
      const token = paymentMethod?.['token'];
      if (!paymentMethod || typeof token !== 'string' || token === '') {
        this.logger.error('[NextPayment] Tokenized without a payment method');
        events.onError(normalizeNextPaymentError(undefined));
        return;
      }
      this.logger.info('[NextPayment] Successfully tokenized', {
        last4: paymentMethod['last_four_digits'],
        cardType: paymentMethod['card_type'],
      });
      events.onToken(token, paymentMethod);
    };
  }

  private settle(events: CardTokenizerEvents, errors: CardError[]): void {
    this.pending = false;
    this.fieldErrors = [];
    events.onError(errors);
  }
}

/**
 * The hosted card fields drawn by NextPayment, served per environment key from
 * `payments.29next.com/js/v1/payment.js?env_key=…`. The script arrives with its
 * signed credentials already in it and defines `window.NextPayment` once per page.
 *
 * Its callbacks do not line up one-to-one with a tokenize attempt, and that is what
 * most of this file is about:
 *
 * - `onValidation` fires on submit only. It reports `month` / `year` / `full_name` from
 *   NextPayment's own check inside `submit()`, and nothing else follows: no `onError`,
 *   no `onTokenized`. Those errors end the attempt here.
 * - It also reports `number` / `cvv`, and a rejected attempt then gets an `onError`
 *   repeating them as a bare string ("Invalid card number"). The structured errors are
 *   kept, and the echo ends the attempt with them.
 * - Whether the number or CVV is empty or wrong, and as the shopper types, comes from
 *   `onFieldStateChange`, which carries both fields' length and validity on every
 *   event. NextPayment's error `key` is `errors.invalid` either way.
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

/**
 * What `onFieldStateChange` reports, on every focus, blur, keystroke and hover: the
 * field the event is about, and the state of both fields.
 *
 * `{"cardType":"visa","cvvLength":3,"luhnValid":false,"numberLength":16,
 * "validCvv":true,"validNumber":false,"action":"mouseover","field":"cvv",
 * "focused":false,"hovered":true}`
 */
interface NextPaymentFieldState {
  field?: unknown;
  action?: unknown;
  numberLength?: unknown;
  cvvLength?: unknown;
  validNumber?: unknown;
  validCvv?: unknown;
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
  onFieldStateChange: (payload: NextPaymentFieldState | undefined) => void;
  setFocus(field: HostedCardField): void;
  submit(formData: CardHolderData): void;
  destroy(): void;
}

declare global {
  interface Window {
    NextPayment?: new (options: NextPaymentOptions) => NextPaymentInstance;
  }
}

/**
 * Options the SDK once passed to Spreedly's iFrame script. NextPayment fixes each of
 * them itself, so a page still setting one gets a debug line saying it does nothing.
 */
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

/** The card fields' default look. NextPayment takes camelCase properties, not CSS text. */
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
 * `empty` says whether the field was empty. NextPayment's own `key` cannot: it sends
 * `errors.invalid` for an empty number or CVV as well as a wrong one.
 */
function toCardError(
  error: NextPaymentFieldError,
  empty: boolean = error.key === 'errors.blank'
): CardError {
  const field = cardErrorField(error.attribute);
  return {
    ...(field && { field }),
    textKey: cardErrorKey(field, error.key, empty),
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

const HOSTED_FIELDS = ['number', 'cvv'] as const;

/** One field's value length and validity, from a field state change. */
function readFieldState(
  payload: NextPaymentFieldState,
  field: HostedCardField
): { length: number; valid?: boolean } | undefined {
  const length = field === 'number' ? payload.numberLength : payload.cvvLength;
  const valid = field === 'number' ? payload.validNumber : payload.validCvv;
  if (typeof length !== 'number') return undefined;
  return { length, ...(typeof valid === 'boolean' && { valid }) };
}

const PRE_VALIDATED: ReadonlySet<CardErrorField | undefined> = new Set([
  'month',
  'year',
  'full_name',
]);

/**
 * How long a loaded script's credentials are used before the fields are rebuilt from a
 * fresh one. nexus signs them when it serves `payment.js`, and Spreedly stops accepting
 * them 30 minutes to an hour later (`get_iframe_signature` in nexus); 25 minutes stays
 * under either.
 */
export const CREDENTIALS_TTL_MS = 25 * 60 * 1000;

let scriptLoad: Promise<void> | undefined;

/**
 * Loads `payment.js` once per page. `fresh` loads it again for new credentials: the
 * script defines `window.NextPayment` only when it is undefined, so the old class is
 * deleted first or the new script would keep it.
 */
function loadScript(environmentKey: string, fresh = false): Promise<void> {
  if (fresh) {
    delete window.NextPayment;
    scriptLoad = undefined;
  } else if (window.NextPayment) {
    return Promise.resolve();
  }
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

export class NextPaymentTokenizer {
  private readonly logger = createLogger('CreditCardService');
  private instance: NextPaymentInstance | undefined;
  private ready = false;
  private mounted: [HostedFieldsMount, CardTokenizerEvents] | undefined;
  /** A tokenize attempt is waiting for its outcome. */
  private pending = false;
  /** The number / CVV errors of the pending attempt, for the echo that ends it. */
  private fieldErrors: CardError[] = [];
  /** How many characters each hosted field holds, as the last field event said. */
  private lengths: Record<HostedCardField, number> = { number: 0, cvv: 0 };
  /** The cardholder data of the pending attempt. */
  private submitted: CardHolderData | undefined;
  /** When the script whose credentials the fields use was loaded. */
  private loadedAt = 0;
  /** A rebuild from a fresh script is under way. */
  private refreshing: Promise<void> | undefined;
  private listeners = new AbortController();

  constructor(
    private readonly environmentKey: string,
    private readonly config?: CardInputConfig
  ) {}

  public async mount(
    mount: HostedFieldsMount,
    events: CardTokenizerEvents
  ): Promise<void> {
    this.mounted = [mount, events];
    const given = (this.config ?? {}) as Record<string, unknown>;
    const ignored = UNSUPPORTED_OPTIONS.filter(
      option => given[option] !== undefined
    );
    if (ignored.length > 0) {
      this.logger.debug('NextPayment ignores these card options:', ignored);
    }

    await loadScript(this.environmentKey);
    this.loadedAt = Date.now();
    this.create(mount, events);

    // A shopper back from another tab gets fresh fields before typing into stale ones.
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'visible' && this.stale()) {
          void this.refresh();
        }
      },
      { signal: this.listeners.signal }
    );
  }

  /**
   * Starts a tokenize attempt. Credentials past {@link CREDENTIALS_TTL_MS} would be
   * refused, so instead the fields are rebuilt and the attempt fails at once, asking
   * for the card again; so does an attempt made while they are being rebuilt.
   */
  public tokenize(card: CardHolderData): void {
    const events = this.mounted?.[1];
    if (!events) return;
    if (this.refreshing !== undefined || !this.instance || this.stale()) {
      void this.refresh();
      events.onError([
        {
          textKey: 'payment.errors.session_expired',
          message: 'Your card details timed out. Enter them again.',
        },
      ]);
      return;
    }
    this.pending = true;
    this.fieldErrors = [];
    this.submitted = { ...card };
    this.instance.submit({ ...card });
  }

  public focus(field: HostedCardField): void {
    if (this.ready) this.instance?.setFocus(field);
  }

  /** NextPayment sets its placeholders once, at mount; this keeps the call sites honest. */
  public setPlaceholder(_field: HostedCardField, _text: string): void {}

  public reset(): void {
    if (!this.mounted) return;
    this.teardown();
    this.create(...this.mounted);
  }

  public destroy(): void {
    this.listeners.abort();
    this.teardown();
    this.mounted = undefined;
  }

  private stale(): boolean {
    return Date.now() - this.loadedAt > CREDENTIALS_TTL_MS;
  }

  /** Rebuilds the fields from a freshly loaded script, which carries new credentials. */
  private refresh(): Promise<void> {
    const mounted = this.mounted;
    if (!mounted) return Promise.resolve();
    this.refreshing ??= (async () => {
      this.logger.info(
        '[NextPayment] Credentials expired, reloading the card fields'
      );
      this.teardown();
      try {
        await loadScript(this.environmentKey, true);
        this.loadedAt = Date.now();
        if (this.mounted === mounted) this.create(...mounted);
      } catch (error) {
        this.logger.error(
          '[NextPayment] Could not reload the card fields',
          error
        );
        mounted[1].onError([
          {
            textKey: 'payment.errors.network',
            message:
              "Couldn't load the card form. Refresh the page and try again.",
          },
        ]);
      } finally {
        this.refreshing = undefined;
      }
    })();
    return this.refreshing;
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
      if (!payload || (field !== 'number' && field !== 'cvv')) return;

      for (const each of HOSTED_FIELDS) {
        const state = readFieldState(payload, each);
        if (!state) continue;
        this.lengths[each] = state.length;
        const { valid } = state;
        // Only a keystroke in a field clears its error; every other event (a hover
        // included) still carries both fields' state, which is kept current quietly.
        events.onFieldState({
          field: each,
          action: action === 'input' && each === field ? 'input' : 'validation',
          hasValue: state.length > 0,
          ...(valid !== undefined && { valid }),
        });
      }
      if (action === 'focus' || action === 'blur') {
        events.onFieldState({ field, action });
      }
    };

    // Fires on submit only; the fields' live state comes from `onFieldStateChange`.
    instance.onValidation = payload => {
      if (!this.pending) return;
      const errors = (payload?.errors ?? []).map(error =>
        toCardError(error, this.wasEmpty(error))
      );
      const preValidation = errors.filter(e => PRE_VALIDATED.has(e.field));
      if (preValidation.length > 0) {
        this.settle(events, preValidation);
        return;
      }
      this.fieldErrors = errors;
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
      events.onToken(token, paymentMethod);
    };
  }

  /** Whether the field an error names was empty: its length, or what was submitted. */
  private wasEmpty(error: NextPaymentFieldError): boolean {
    const field = cardErrorField(error.attribute);
    switch (field) {
      case 'number':
      case 'cvv':
        return this.lengths[field] === 0;
      case 'month':
        return !this.submitted?.month;
      case 'year':
        return !this.submitted?.year;
      default:
        return error.key === 'errors.blank';
    }
  }

  private settle(events: CardTokenizerEvents, errors: CardError[]): void {
    this.pending = false;
    this.fieldErrors = [];
    events.onError(errors);
  }
}

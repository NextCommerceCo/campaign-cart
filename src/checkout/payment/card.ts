import type { CheckoutActions } from '../state/checkout';
import type { Engine } from '../../engine/engine';
import { showField } from '../form/errors';
import { fieldControl } from '../form/fields';
import { cardText, formText, refusedText, textOf } from '../form/texts';
import { bindExpiry, type Expiry } from './expiry';

declare const __VERSION__: string;

type FieldChange = { field?: string; action?: string; validNumber?: boolean; validCvv?: boolean };
type Validation = { errors?: Array<{ attribute?: string; message?: string }> };

interface NextPaymentInstance {
  onReady: () => void;
  onFieldStateChange: (state?: FieldChange) => void;
  onValidation: (payload?: Validation) => void;
  onError: (error: unknown) => void;
  onTokenized: (result: unknown) => void;
  submit(card: Record<string, string>, params: { metadata: Record<string, string> }): void;
  destroy(): void;
}

declare global {
  interface Window {
    NextPayment?: new (options: object) => NextPaymentInstance;
  }
}

const SCRIPT = 'https://payments.29next.com/js/v1/payment.js';
const CREDENTIALS_TTL = 60 * 60 * 1000;
const TOKENIZE_TIMEOUT = 30_000;
const FIELD_STYLE = {
  color: '#212529',
  fontSize: '.925rem',
  fontWeight: '400',
  width: '100%',
  height: '100%',
  fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

let script: Promise<void> | undefined;

function loadScript(envKey: string, fresh: boolean): Promise<void> {
  if (fresh) {
    delete window.NextPayment;
    script = undefined;
  } else if (window.NextPayment) return Promise.resolve();
  script ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = `${SCRIPT}?env_key=${encodeURIComponent(envKey)}${fresh ? `&reload=${Date.now()}` : ''}`;
    el.async = true;
    el.onload = () => (window.NextPayment ? resolve() : reject(new Error('payment.js loaded without NextPayment')));
    el.onerror = () => reject(new Error('payment.js failed to load'));
    document.head.append(el);
  }).catch((err: unknown) => {
    script = undefined;
    throw err;
  });
  return script;
}

export interface Card {
  tokenize(): Promise<string>;
  check(): void;
  render(): void;
}

type HostedField = 'number' | 'cvv';
type HostedFields = ReadonlyArray<readonly [HTMLElement, HostedField]>;
type Flags = Record<HostedField, boolean>;
type Pending = { resolve: (token: string) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> };

function markHostedFields(hosts: HostedFields): void {
  for (const [el, field] of hosts) {
    el.id = `spreedly-${field}`;
    el.setAttribute('data-spreedly', field);
    el.classList.add('spreedly-field-transition');
  }
}

function renderHostedFields(hosts: HostedFields, errors: Map<string, string>, valid: Flags, focused: Flags): void {
  for (const [el, field] of hosts) {
    const text = errors.get(field);
    showField(el, field, text ? 'error' : valid[field] ? 'valid' : 'neutral', text);
    el.classList.toggle('next-focused', focused[field]);
    el.classList.toggle('has-focus', focused[field]);
  }
}

function hostedFieldOptions(): object {
  return {
    numberEl: 'spreedly-number',
    cvvEl: 'spreedly-cvv',
    numberFormat: 'prettyFormat',
    labels: {
      number: textOf('payment.card.number.label', 'Card Number'),
      cvv: textOf('payment.card.cvv.label', 'Security Code'),
    },
    placeholder: {
      number: textOf('payment.card.number.placeholder', 'Card Number'),
      cvv: textOf('payment.card.cvv.placeholder', 'CVV *'),
    },
    titles: {
      number: textOf('payment.card.number.title', 'Enter your card number'),
      cvv: textOf('payment.card.cvv.title', 'Enter your Security Code'),
    },
    styling: { number: FIELD_STYLE, cvv: FIELD_STYLE },
  };
}

interface CardView {
  errors: Map<string, string>;
  valid: Flags;
  focused: Flags;
  render(): void;
  changed(): void;
}

function cardView(hosts: HostedFields, expiry: Expiry, checkout: CheckoutActions): CardView {
  const errors = new Map<string, string>();
  const valid = { number: false, cvv: false };
  const focused = { number: false, cvv: false };
  const render = () => {
    renderHostedFields(hosts, errors, valid, focused);
    expiry.render(errors);
  };
  const changed = () => {
    if (valid.number && valid.cvv && expiry.month() && expiry.year()) checkout.paymentReady();
    render();
  };
  return { errors, valid, focused, render, changed };
}

function applyFieldState(state: FieldChange | undefined, { errors, valid, focused }: CardView): boolean {
  const field = state?.field;
  if (field !== 'number' && field !== 'cvv') return false;
  if (typeof state?.validNumber === 'boolean') valid.number = state.validNumber;
  if (typeof state?.validCvv === 'boolean') valid.cvv = state.validCvv;
  if (state?.action === 'input') errors.delete(field);
  if (state?.action === 'focus' || state?.action === 'blur') focused[field] = state.action === 'focus';
  return true;
}

function addValidationErrors(errors: Map<string, string>, payload?: Validation): void {
  for (const e of payload?.errors ?? []) {
    const field = e.attribute === 'month' || e.attribute === 'year' || e.attribute === 'cvv' ? e.attribute : 'number';
    errors.set(field, e.message ?? refusedText(field));
  }
}

function cardDetails(engine: Engine, expiry: Expiry): Record<string, string> {
  const { fields } = engine.getState().checkout!;
  const names = { first_name: fields.first_name ?? '', last_name: fields.last_name ?? '' };
  return {
    full_name: `${names.first_name} ${names.last_name}`.trim(),
    ...names,
    month: expiry.month(),
    year: expiry.year(),
  };
}

interface PaymentJs {
  /** Loaded, and its credentials still fresh. */
  ready(): boolean;
  reload(): void;
  submit(card: Record<string, string>, metadata: Record<string, string>): Promise<string>;
}

function connect(envKey: string, form: HTMLFormElement, view: CardView): PaymentJs {
  let instance: NextPaymentInstance | undefined;
  let loadedAt = 0;
  let pending: Pending | undefined;

  const settle = (token?: string, error?: string) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    if (token) pending.resolve(token);
    else pending.reject(new Error(error ?? formText({ code: 'card' })));
    pending = undefined;
    view.render();
  };

  const create = () => {
    const NextPayment = window.NextPayment;
    if (!NextPayment) return;
    instance?.destroy();
    instance = new NextPayment(hostedFieldOptions());
    instance.onReady = () => form.classList.remove('next-loading-spreedly');
    instance.onFieldStateChange = (state) => applyFieldState(state, view) && view.changed();
    instance.onValidation = (payload) => {
      addValidationErrors(view.errors, payload);
      if (view.errors.size) settle(undefined, [...view.errors.values()].join('. '));
    };
    instance.onError = (error) => {
      const message = (error as { message?: unknown } | undefined)?.message;
      settle(undefined, typeof message === 'string' ? message : undefined);
    };
    instance.onTokenized = (result) => {
      const token = (result as { tokenResponse?: { payment_method?: { token?: unknown } } } | undefined)?.tokenResponse
        ?.payment_method?.token;
      settle(typeof token === 'string' && token ? token : undefined);
    };
  };

  const load = (fresh: boolean) =>
    loadScript(envKey, fresh).then(() => {
      loadedAt = Date.now();
      create();
    });

  const stale = () => Date.now() - loadedAt > CREDENTIALS_TTL;
  form.classList.add('next-loading-spreedly');
  void load(false).catch(() => form.classList.remove('next-loading-spreedly'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && loadedAt && stale()) void load(true).catch(() => {});
  });

  return {
    ready: () => !!instance && !stale(),
    reload: () => void load(true).catch(() => {}),
    submit: (card, metadata) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => settle(undefined, 'Credit card tokenization timed out'), TOKENIZE_TIMEOUT);
        pending = { resolve, reject, timer };
        instance!.submit(card, { metadata });
      }),
  };
}

export function bindCard(engine: Engine, checkout: CheckoutActions, form: HTMLFormElement): Card | undefined {
  const number = fieldControl(form, 'cc-number');
  const cvv = fieldControl(form, 'cvv');
  const campaign = engine.getState().campaign;
  const envKey = campaign?.payment_env_key;
  if (!number || !cvv || !campaign || !envKey) return undefined;

  const hosts = [
    [number, 'number'],
    [cvv, 'cvv'],
  ] as const;
  markHostedFields(hosts);
  const expiry = bindExpiry(form);
  const view = cardView(hosts, expiry, checkout);
  const { errors, render } = view;
  const paymentJs = connect(envKey, form, view);
  expiry.onChange((cleared) => {
    cleared.forEach((key) => errors.delete(key));
    view.changed();
  });

  return {
    render,
    check() {
      errors.clear();
      if (!view.valid.number) errors.set('number', cardText('number'));
      if (!view.valid.cvv) errors.set('cvv', cardText('cvv'));
      expiry.check(errors);
      render();
    },
    tokenize() {
      errors.clear();
      expiry.check(errors);
      render();
      if (errors.size) return Promise.reject(new Error([...errors.values()].join('. ')));
      if (!paymentJs.ready()) {
        paymentJs.reload();
        return Promise.reject(new Error(formText({ code: 'card_expired' })));
      }
      return paymentJs.submit(cardDetails(engine, expiry), {
        source: 'next-campaign-cart',
        sdk_version: __VERSION__,
        campaign_id: String(campaign.id),
        page: location.origin + location.pathname,
      });
    },
  };
}

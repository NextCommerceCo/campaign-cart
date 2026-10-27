import { type CheckoutActions, paymentCode } from '../state/checkout';
import type { Engine } from '../../engine/engine';
import { FIELD_ATTRS } from '../../compat/checkout';
import { option, showField } from '../form/errors';
import { cardText, label } from '../form/texts';

declare const __VERSION__: string;

interface NextPaymentInstance {
  onReady: () => void;
  onFieldStateChange: (state?: { field?: string; action?: string; validNumber?: boolean; validCvv?: boolean }) => void;
  onValidation: (payload?: { errors?: Array<{ attribute?: string; message?: string }> }) => void;
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
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const FIELD_STYLE = {
  color: '#212529',
  fontSize: '.925rem',
  fontWeight: '400',
  width: '100%',
  height: '100%',
  fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
};

const control = <T extends Element = HTMLElement>(root: ParentNode, ...names: string[]) =>
  root.querySelector<T>(names.flatMap((n) => FIELD_ATTRS.map((a) => `[${a}="${n}"]`)).join(', '));

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

function fillExpiry(month: HTMLSelectElement | null, year: HTMLSelectElement | null): void {
  if (month && month.options.length <= 1) {
    month.append(
      ...MONTHS.map((m, i) => option(`(${String(i + 1).padStart(2, '0')}) ${m}`, String(i + 1).padStart(2, '0'))),
    );
  }
  if (year && year.options.length <= 1) {
    const now = new Date().getFullYear();
    year.append(...Array.from({ length: 20 }, (_, i) => option(String(now + i), String(now + i))));
  }
}

export interface Card {
  tokenize(): Promise<string>;
  check(): void;
  render(): void;
}

export function bindCard(engine: Engine, checkout: CheckoutActions, form: HTMLFormElement): Card | undefined {
  const number = control(form, 'cc-number');
  const cvv = control(form, 'cvv');
  const month = control<HTMLSelectElement>(form, 'exp-month', 'cc-month');
  const year = control<HTMLSelectElement>(form, 'exp-year', 'cc-year');
  const envKey = engine.getState().campaign?.payment_env_key;
  if (!number || !cvv || !envKey) return undefined;

  for (const [el, field] of [
    [number, 'number'],
    [cvv, 'cvv'],
  ] as const) {
    el.id = `spreedly-${field}`;
    el.setAttribute('data-spreedly', field);
    el.classList.add('spreedly-field-transition');
  }
  fillExpiry(month, year);

  const errors = new Map<string, string>();
  const valid = { number: false, cvv: false };
  const focused = { number: false, cvv: false };
  let instance: NextPaymentInstance | undefined;
  let loadedAt = 0;
  let pending:
    | { resolve: (token: string) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
    | undefined;

  const render = () => {
    for (const [el, field] of [
      [number, 'number'],
      [cvv, 'cvv'],
    ] as const) {
      const text = errors.get(field);
      showField(el, field, text ? 'error' : valid[field] ? 'valid' : 'neutral', text);
      el.classList.toggle('next-focused', focused[field]);
      el.classList.toggle('has-focus', focused[field]);
    }
    for (const [el, field] of [
      [month, 'month'],
      [year, 'year'],
    ] as const) {
      if (el) showField(el, field, errors.has(field) ? 'error' : 'neutral', errors.get(field));
    }
  };

  const ready = () => {
    if (valid.number && valid.cvv && month?.value && year?.value) checkout.paymentReady('card_token');
  };

  const settle = (token?: string, error?: string) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    if (token) pending.resolve(token);
    else pending.reject(new Error(error ?? 'Please check your card details and try again.'));
    pending = undefined;
    render();
  };

  const create = () => {
    const NextPayment = window.NextPayment;
    if (!NextPayment) return;
    instance?.destroy();
    instance = new NextPayment({
      numberEl: 'spreedly-number',
      cvvEl: 'spreedly-cvv',
      numberFormat: 'prettyFormat',
      labels: { number: 'Card Number', cvv: 'Security Code' },
      placeholder: { number: 'Card Number', cvv: 'CVV *' },
      titles: { number: 'Enter your card number', cvv: 'Enter your Security Code' },
      styling: { number: FIELD_STYLE, cvv: FIELD_STYLE },
    });
    instance.onReady = () => form.classList.remove('next-loading-spreedly');
    instance.onFieldStateChange = (state) => {
      const field = state?.field;
      if (field !== 'number' && field !== 'cvv') return;
      if (typeof state?.validNumber === 'boolean') valid.number = state.validNumber;
      if (typeof state?.validCvv === 'boolean') valid.cvv = state.validCvv;
      if (state?.action === 'input') errors.delete(field);
      if (state?.action === 'focus' || state?.action === 'blur') focused[field] = state.action === 'focus';
      ready();
      render();
    };
    instance.onValidation = (payload) => {
      for (const e of payload?.errors ?? []) {
        const field =
          e.attribute === 'month' || e.attribute === 'year' || e.attribute === 'cvv' ? e.attribute : 'number';
        errors.set(field, e.message ?? `Please enter a valid ${label(field).toLowerCase()}`);
      }
      if (errors.size) settle(undefined, [...errors.values()].join('. '));
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
  for (const el of [month, year]) {
    el?.addEventListener('change', () => {
      errors.delete(el === month ? 'month' : 'year');
      ready();
      render();
    });
  }

  const checkExpiry = () => {
    const now = new Date();
    if (!month?.value) errors.set('month', cardText('month'));
    if (!year?.value) errors.set('year', cardText('year'));
    if (month?.value && Number(year?.value) === now.getFullYear() && Number(month.value) < now.getMonth() + 1) {
      errors.set('month', cardText('expired'));
    }
  };

  return {
    render,
    check() {
      errors.clear();
      if (!valid.number) errors.set('number', cardText('number'));
      if (!valid.cvv) errors.set('cvv', cardText('cvv'));
      checkExpiry();
      render();
    },
    tokenize() {
      errors.clear();
      checkExpiry();
      render();
      if (errors.size) return Promise.reject(new Error([...errors.values()].join('. ')));
      if (!instance || stale()) {
        void load(true).catch(() => {});
        return Promise.reject(new Error('Your card details timed out. Enter them again.'));
      }
      const { fields } = engine.getState().checkout!;
      const names = { first_name: fields.first_name ?? '', last_name: fields.last_name ?? '' };
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => settle(undefined, 'Credit card tokenization timed out'), TOKENIZE_TIMEOUT);
        pending = { resolve, reject, timer };
        instance!.submit(
          {
            full_name: `${names.first_name} ${names.last_name}`.trim(),
            ...names,
            month: month!.value,
            year: year!.value,
          },
          {
            metadata: {
              source: 'next-campaign-cart',
              sdk_version: __VERSION__,
              page: location.origin + location.pathname,
            },
          },
        );
      });
    },
  };
}

const RADIOS =
  'input[name="payment_method"], [data-next-checkout-field="payment-method"], [os-checkout-field="payment-method"]';

export function bindPayment(engine: Engine, checkout: CheckoutActions, form: HTMLFormElement): () => void {
  const radios = [...form.querySelectorAll<HTMLInputElement>(RADIOS)].filter((r) => r.type === 'radio');
  const panels = [...form.querySelectorAll<HTMLElement>('[data-next-payment-method]')];
  const offered = engine.getState().campaign?.available_payment_methods?.map((m) => paymentCode(m.code));
  const codeOf = (el: Element, attr: string) => paymentCode(el.getAttribute(attr) ?? '');

  if (offered?.length) {
    for (const panel of panels) {
      const code = codeOf(panel, 'data-next-payment-method');
      if (code === 'card_token' || offered.includes(code)) continue;
      panel.classList.add('next-hidden');
      panel.style.display = 'none';
    }
  }

  const usable = (radio: HTMLInputElement) => !radio.closest<HTMLElement>('[data-next-payment-method].next-hidden');
  const saved = engine.getState().checkout?.paymentMethod;
  const initial =
    radios.find((r) => usable(r) && paymentCode(r.value) === saved) ??
    radios.find((r) => usable(r) && r.checked) ??
    radios.find(usable);
  if (initial) checkout.setPaymentMethod(initial.value);
  for (const radio of radios)
    radio.addEventListener('change', () => radio.checked && checkout.setPaymentMethod(radio.value));

  return () => {
    const method = engine.getState().checkout?.paymentMethod;
    for (const radio of radios) radio.checked = paymentCode(radio.value) === method;
    for (const panel of panels) {
      const on = codeOf(panel, 'data-next-payment-method') === method;
      panel.classList.toggle('next-selected', on);
      const body = panel.querySelector<HTMLElement>('[data-next-payment-form]');
      if (!body) continue;
      body.setAttribute('data-next-payment-state', on ? 'expanded' : 'collapsed');
      body.classList.toggle('payment-method__form--expanded', on);
      body.classList.toggle('payment-method__form--collapsed', !on);
      body.style.height = on ? '' : '0px';
      body.style.overflow = on ? '' : 'hidden';
    }
  };
}

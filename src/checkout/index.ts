import { RulesApi } from './state/rules';
import { type CheckoutActions, createCheckout } from './state/checkout';
import type { Lead } from './state/contact';
import type { CheckoutState } from './state/types';
import { redirectFor } from './state/place-order';
import type { Engine } from '../engine/engine';
import { nextUrl } from '../engine/params';
import type { Query } from '../engine/query';
import type { Send } from '../engine/types';
import { localeOf } from '../engine/format';
import { metaContent } from '../bindings/dom';
import { I18N_RULES, rulesSend, serviceTexts, textsIn, type Texts } from '../engine/texts';
import { bindAddress } from './address/country';
import { bindAddressForms } from './address/block';
import { bindAutocomplete } from './address/autocomplete';
import { bindBilling, cloneBillingRows } from './address/billing';
import { bindExpress } from './payment/express';
import { bindPaymentWidget } from './payment/widget';
import { bindFields, type Fields, phoneRequired, scanFields, syncFields } from './form/fields';
import { bindLabels } from './form/labels';
import type { Checkout } from '../engine/events/checkout';
import type { CheckoutHooks } from './hooks';
import { legacyCheckout } from '../compat/checkout';
import { errorBox, showBox, shown } from './form/errors';
import { bindCard, type Card } from './payment/card';
import { bindPayment } from './payment/methods';
import { bindPhones } from './address/phone';
import { bindReview } from './review';
import { errorTexts, expressText, formText, label, useTexts } from './form/texts';

const SUBMIT = 'button[type="submit"], input[type="submit"], [data-next-checkout-submit], [os-checkout-submit]';

function failureUrl(): string {
  const url = new URL(location.href);
  url.searchParams.set('payment_failed', 'true');
  return metaContent('next-failure-url', 'os-failure-url') ?? url.href;
}

function overlay(): (busy: boolean) => void {
  let el: HTMLElement | undefined;
  return (busy) => {
    if (busy && !el) {
      el = Object.assign(document.createElement('div'), {
        className: 'next-loading-overlay',
        innerHTML:
          '<style>@keyframes next-spin{to{transform:rotate(360deg)}}.next-loading-spinner .spinner{width:30px;height:30px;border:3px solid rgba(0,0,0,.1);border-top-color:var(--brand--color--primary,#000);border-radius:50%;animation:next-spin 1s linear infinite}</style><div class="next-loading-spinner"><div class="spinner"></div></div>',
      });
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        backgroundColor: 'rgba(255,255,255,.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '9999',
      });
      document.body.append(el);
    }
    if (!busy && el) {
      el.remove();
      el = undefined;
    }
  };
}

function parseLead(value: string): Lead | undefined {
  const words = value
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (words.length === 1 && words[0] === 'off') return 'off';
  if (!words.length || words.some((w) => w !== 'email' && w !== 'phone')) return undefined;
  return words.includes('email') ? (words.includes('phone') ? 'email+phone' : 'email') : 'phone';
}

function leadOf(engine: Engine, form: HTMLFormElement, hooks: CheckoutHooks): Lead {
  const value = form.getAttribute('data-next-lead');
  const legacy = hooks.lead?.();
  if (value === null) return legacy ?? 'email';
  const lead = parseLead(value);
  if (!lead) engine.log.warn(`data-next-lead="${value}" is not email, phone, email+phone or off; using email`);
  return lead ?? 'email';
}

interface BindOptions {
  navigate?: (url: string) => void;
  /** How it asks i18n-rules: boot's names the campaign's key. */
  rules?: Send;
  /** 0.4.x `checkout:started`: once a page, when the page opens the checkout. */
  legacyCheckoutStarted?: (checkout: Checkout) => void;
  /** Where `checkout.errors` gets the texts the page shows. */
  query?: Query;
  /** The page's own texts by language (0.4.x `nextConfig.translations`), read before i18n-rules' and the English. */
  translations?: Readonly<Record<string, Texts>>;
}

function bindTexts(engine: Engine, send: Send, translations: Readonly<Record<string, Texts>>): RulesApi {
  const lang = localeOf(engine.getState()) || 'en';
  const own = textsIn(translations, lang);
  useTexts(own, serviceTexts(send, lang));
  return new RulesApi(send, I18N_RULES, lang, own);
}

function pageUrls(engine: Engine, form: HTMLFormElement) {
  const go = form.getAttribute('data-next-go');
  const middleStep = form.hasAttribute('data-next-step');
  if (middleStep && !go) engine.log.warn('data-next-step on the checkout form needs data-next-go, its next page');
  const successUrl = () => (!middleStep && go) || metaContent('next-success-url', 'next-next-url', 'os-next-page');
  if (!successUrl() && !middleStep) {
    engine.log.error(
      'the checkout page has no <meta name="next-success-url">: the purchase will not be tracked, and a payment gateway will send the shopper to /success',
    );
  }
  const stepUrl = form.getAttribute('data-next-checkout-step') ?? form.getAttribute('os-checkout-step');
  return { successUrl, stepUrl: (middleStep && go) || stepUrl };
}

function stepOf(engine: Engine, form: HTMLFormElement, page: string, stepUrl: string | null): number {
  const { step: advanced, steps } = engine.getState().checkout!;
  return (
    Number(form.getAttribute('data-next-step-number')) || steps?.[page] || (advanced > 1 ? advanced : stepUrl ? 1 : 0)
  );
}

function focusFirstError(engine: Engine, fields: Fields): void {
  const errors = engine.getState().checkout?.errors ?? {};
  const first = [...fields].find(([name, el]) => errors[name] && shown(el))?.[1];
  setTimeout(() => {
    first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    first?.focus({ preventScroll: true });
  }, 100);
}

function errorText(state: CheckoutState, fields: Fields, box: string): string {
  const order = [...fields.keys()];
  const unshown = Object.keys(state.errors)
    .filter((name) => {
      if (name === 'form' || state.errors[name]?.warning) return false;
      const el = fields.get(name);
      return !el || !shown(el);
    })
    .sort((a, b) => (order.indexOf(a) + 1 || order.length + 1) - (order.indexOf(b) + 1 || order.length + 1));
  const parts = [];
  if (state.errors.form) parts.push(formText(state.errors.form));
  if (unshown.length) parts.push(formText({ code: 'unshown' }, { fields: unshown.map((n) => label(n)).join(', ') }));
  return box === 'express' && parts.length ? expressText(parts.join(' ')) : parts.join(' ');
}

function renderErrorBoxes(form: HTMLFormElement, box: string, text: string): void {
  const target =
    box === 'express'
      ? (document.querySelector<HTMLElement>('[data-next-component="express-error"]') ?? errorBox(document, 'credit'))
      : (errorBox(form, box) ?? errorBox(document, box));
  for (const el of document.querySelectorAll<HTMLElement>('[data-next-component$="-error"]')) {
    if (el !== target) showBox(el, undefined);
  }
  if (target) showBox(target, text || undefined);
}

function bindSubmitState(engine: Engine, form: HTMLFormElement): () => void {
  const buttons = [...form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(SUBMIT)].map(
    (button) => [button, button.disabled] as const,
  );
  const showOverlay = overlay();
  return () => {
    const busy = engine.getState().checkout?.status !== 'idle';
    showOverlay(busy);
    for (const [button, wasDisabled] of buttons) {
      button.disabled = busy || wasDisabled;
      button.setAttribute('aria-busy', String(busy));
    }
  };
}

interface Parts {
  fields: Fields;
  card: Card | undefined;
  renders: Array<() => void>;
}

/**
 * Billing rows and the payment widget add fields, so they come before scanFields; the phone and postcode listeners
 * come before bindFields', so a value is masked before it is read; labels float after the address fills its selects.
 */
function bindParts(engine: Engine, checkout: CheckoutActions, form: HTMLFormElement, hooks: CheckoutHooks): Parts {
  cloneBillingRows(form);
  const paymentWidget = bindPaymentWidget(engine, form);
  const fields = scanFields(form);
  const autocomplete = () => hooks.autocomplete?.() && bindAutocomplete(fields, checkout, hooks.addressFilled);
  const addressForms = bindAddressForms(engine, form, fields, autocomplete);
  const labels = bindLabels(form);
  autocomplete();
  const card = bindCard(engine, checkout, form);
  const phones = bindPhones(engine, checkout, form, fields, I18N_RULES);
  const address = bindAddress(engine, form, fields, hooks.hiddenStates?.() ?? []);
  const renders = [
    addressForms,
    bindFields(engine, checkout, form, fields),
    phones,
    address,
    labels,
    bindBilling(engine, checkout, form),
    bindPayment(engine, checkout, form),
    paymentWidget,
  ];
  return { fields, card, renders };
}

interface Urls extends ReturnType<typeof pageUrls> {
  step: number;
  navigate: (url: string) => void;
}

interface Order {
  pay(expressMethod?: string): Promise<void>;
  /** The error box the last attempt reports to: `express`, or the payment method's. */
  box(): string;
}

function bindOrder(
  engine: Engine,
  checkout: CheckoutActions,
  form: HTMLFormElement,
  { fields, card }: Parts,
  { successUrl, stepUrl, step, navigate }: Urls,
  hooks: CheckoutHooks,
): Order {
  let box = 'credit';
  const current = () => new URL(location.href);

  const pay = async (expressMethod?: string): Promise<void> => {
    syncFields(fields, checkout, engine.getState().checkout);
    box = expressMethod ? 'express' : (engine.getState().checkout?.paymentMethod ?? 'credit');
    const order = await checkout.placeOrder({
      expressMethod,
      walletChecks: hooks.walletChecks?.(),
      successUrl: successUrl(),
      failureUrl: failureUrl(),
      pageUrl: location.href,
      tokenize: card?.tokenize,
      phoneRequired: phoneRequired(fields),
    });
    if (!order) {
      const errors = Object.keys(engine.getState().checkout?.errors ?? {});
      if (!expressMethod && box === 'card_token' && errors.some((name) => name !== 'form')) card?.check();
      return focusFirstError(engine, fields);
    }
    hooks.placed?.();
    navigate(redirectFor(order, successUrl(), current(), engine.getState().visit.params));
  };

  const advance = () => {
    syncFields(fields, checkout, engine.getState().checkout);
    if (!checkout.nextStep(step === 1 && phoneRequired(fields))) return focusFirstError(engine, fields);
    hooks.advanced?.();
    navigate(nextUrl(stepUrl!, current(), engine.getState().visit.params));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (stepUrl) advance();
    else void pay();
  });
  return { pay, box: () => box };
}

export function bindCheckout(
  engine: Engine,
  form: HTMLFormElement,
  {
    navigate = (url) => location.assign(url),
    rules: send = rulesSend(window.fetch.bind(window)),
    legacyCheckoutStarted,
    query,
    translations = {},
  }: BindOptions = {},
): CheckoutActions {
  const rules = bindTexts(engine, send, translations);
  const hooks = legacyCheckout(engine, form, legacyCheckoutStarted);
  const lead = leadOf(engine, form, hooks);
  const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, rules, { lead, opened: hooks.opened }));
  engine.checkout = checkout;
  const urls = pageUrls(engine, form);
  form.noValidate = true;
  const parts = bindParts(engine, checkout, form, hooks);
  const page = location.pathname;
  const step = stepOf(engine, form, page, urls.stepUrl);
  const renderSubmit = bindSubmitState(engine, form);
  const order = bindOrder(engine, checkout, form, parts, { ...urls, step, navigate }, hooks);
  const boxText = (state: CheckoutState) => errorText(state, parts.fields, order.box());

  query?.register('checkout.errors', () => {
    const state = engine.getState().checkout;
    return state && errorTexts(state, boxText(state));
  });

  const renderErrors = () => {
    const state = engine.getState().checkout;
    if (state) renderErrorBoxes(form, order.box(), boxText(state));
  };

  const renders = [
    ...parts.renders,
    bindExpress(engine, order.pay, hooks.expressOrder?.()),
    bindReview(engine),
    parts.card?.render ?? (() => {}),
    renderErrors,
    renderSubmit,
  ];
  hooks.bound?.();
  const render = () => renders.forEach((r) => r());
  engine.subscribe(render);
  render();

  checkout.setStep(step, page);
  checkout.begin();
  void checkout.loadCountries(hooks.countries?.() ?? []);
  return checkout;
}

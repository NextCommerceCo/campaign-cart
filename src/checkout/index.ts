import { RulesApi } from './state/rules';
import { type CheckoutActions, createCheckout } from './state/checkout';
import type { Lead } from './state/contact';
import type { CheckoutState } from './state/types';
import { redirectFor } from './state/place-order';
import type { Engine } from '../engine/engine';
import { nextUrl } from '../engine/params';
import type { Query } from '../engine/query';
import { localeOf } from '../engine/format';
import { I18N_RULES, serviceTexts, textsIn, type Texts } from '../engine/texts';
import { bindAddress } from './address/country';
import { bindAddressForms } from './address/block';
import { bindAutocomplete } from './address/autocomplete';
import { bindBilling, cloneBillingRows } from './address/billing';
import { bindExpress } from './payment/express';
import { bindPaymentWidget } from './payment/widget';
import { bindFields, phoneRequired, scanFields, syncFields } from './form/fields';
import { bindLabels } from './form/labels';
import {
  announceProspect,
  legacyLead,
  clearStepGuard,
  FAILURE_URL_META,
  legacyAutocomplete,
  type LegacyCheckoutStarted,
  legacyCountries,
  legacyCheckoutEvents,
  legacyWalletChecks,
  legacyStartedEachPage,
  stepUrlOf,
  SUBMIT_ATTRS,
  SUCCESS_URL_META,
  writeStepGuard,
} from '../compat/checkout';
import { errorBox, showBox, shown } from './form/errors';
import { bindCard, bindPayment } from './payment/card';
import { bindPhones } from './address/phone';
import { bindReview } from './review';
import { errorTexts, expressText, formText, label, useTexts } from './form/texts';

const SUBMIT = ['button[type="submit"]', 'input[type="submit"]', ...SUBMIT_ATTRS.map((a) => `[${a}]`)].join(', ');

const meta = (...names: string[]) =>
  names.map((n) => document.querySelector<HTMLMetaElement>(`meta[name="${n}"]`)?.content).find(Boolean);

function failureUrl(): string {
  const url = new URL(location.href);
  url.searchParams.set('payment_failed', 'true');
  return meta(...FAILURE_URL_META) ?? url.href;
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

function leadOf(engine: Engine, form: HTMLFormElement): Lead {
  const value = form.getAttribute('data-next-lead');
  const legacy = legacyLead(engine, form);
  if (value === null) return legacy ?? 'email';
  const lead = parseLead(value);
  if (!lead) engine.log.warn(`data-next-lead="${value}" is not email, phone, email+phone or off; using email`);
  return lead ?? 'email';
}

interface BindOptions {
  navigate?: (url: string) => void;
  legacyCheckoutStarted?: LegacyCheckoutStarted;
  /** Where `checkout.errors` gets the texts the page shows. */
  query?: Query;
  /** The page's own texts by language (0.4.x `nextConfig.translations`), read before i18n-rules' and the English. */
  translations?: Readonly<Record<string, Texts>>;
}

export function bindCheckout(
  engine: Engine,
  form: HTMLFormElement,
  { navigate = (url) => location.assign(url), legacyCheckoutStarted, query, translations = {} }: BindOptions = {},
): CheckoutActions {
  const lang = localeOf(engine.getState()) || 'en';
  const own = textsIn(translations, lang);
  const send = window.fetch.bind(window);
  useTexts(own, serviceTexts(send, lang));
  const rules = new RulesApi(send, I18N_RULES, lang, own);
  const lead = leadOf(engine, form);
  const opened = legacyCheckoutStarted && legacyStartedEachPage(engine, legacyCheckoutStarted);
  const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, rules, { lead, opened }));
  engine.checkout = checkout;
  const go = form.getAttribute('data-next-go');
  const middleStep = form.hasAttribute('data-next-step');
  if (middleStep && !go) engine.log.warn('data-next-step on the checkout form needs data-next-go, its next page');
  const successUrl = () => (!middleStep && go) || meta(...SUCCESS_URL_META);
  if (!successUrl() && !middleStep) {
    engine.log.error(
      'the checkout page has no <meta name="next-success-url">: the purchase will not be tracked, and a payment gateway will send the shopper to /success',
    );
  }
  form.noValidate = true;
  cloneBillingRows(form);
  const paymentWidget = bindPaymentWidget(engine, form);
  const fields = scanFields(form);
  const autocomplete = () => legacyAutocomplete() && bindAutocomplete(fields, checkout);
  const addressForms = bindAddressForms(engine, form, fields, autocomplete);
  const labels = bindLabels(form);
  autocomplete();
  const card = bindCard(engine, checkout, form);
  const phones = bindPhones(engine, checkout, form, fields, I18N_RULES);
  const address = bindAddress(engine, form, fields);
  const stepUrl = (middleStep && go) || stepUrlOf(form);
  const page = location.pathname;
  const { step: advanced, steps } = engine.getState().checkout!;
  const step =
    Number(form.getAttribute('data-next-step-number')) || steps?.[page] || (advanced > 1 ? advanced : stepUrl ? 1 : 0);
  const submit = form.querySelector<HTMLButtonElement | HTMLInputElement>(SUBMIT);
  const wasDisabled = !!submit?.disabled;
  const showOverlay = overlay();
  let box = 'credit';

  const current = () => new URL(location.href);
  const focusFirstError = () => {
    const errors = engine.getState().checkout?.errors ?? {};
    const first = [...fields].find(([name, el]) => errors[name] && shown(el))?.[1];
    setTimeout(() => {
      first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      first?.focus({ preventScroll: true });
    }, 100);
  };

  const pay = async (expressMethod?: string): Promise<void> => {
    syncFields(fields, checkout, engine.getState().checkout);
    box = expressMethod ? 'express' : (engine.getState().checkout?.paymentMethod ?? 'credit');
    const order = await checkout.placeOrder({
      expressMethod,
      walletChecks: legacyWalletChecks(),
      successUrl: successUrl(),
      failureUrl: failureUrl(),
      pageUrl: location.href,
      tokenize: card?.tokenize,
      phoneRequired: phoneRequired(fields),
    });
    if (!order) {
      const errors = Object.keys(engine.getState().checkout?.errors ?? {});
      if (!expressMethod && box === 'card_token' && errors.some((name) => name !== 'form')) card?.check();
      return focusFirstError();
    }
    clearStepGuard();
    navigate(redirectFor(order, successUrl(), current(), engine.getState().visit.params));
  };

  const advance = () => {
    syncFields(fields, checkout, engine.getState().checkout);
    if (!checkout.nextStep(step === 1 && phoneRequired(fields))) return focusFirstError();
    writeStepGuard(engine);
    navigate(nextUrl(stepUrl!, current(), engine.getState().visit.params));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (stepUrl) advance();
    else void pay();
  });

  const boxText = (state: CheckoutState) => {
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
  };
  query?.register('checkout.errors', () => {
    const state = engine.getState().checkout;
    return state && errorTexts(state, boxText(state));
  });

  const renderErrors = () => {
    const state = engine.getState().checkout;
    if (!state) return;
    const text = boxText(state);
    const target =
      box === 'express'
        ? (document.querySelector<HTMLElement>('[data-next-component="express-error"]') ?? errorBox(document, 'credit'))
        : (errorBox(form, box) ?? errorBox(document, box));
    for (const el of document.querySelectorAll<HTMLElement>('[data-next-component$="-error"]')) {
      if (el !== target) showBox(el, undefined);
    }
    if (target) showBox(target, text || undefined);
  };

  const renderSubmit = () => {
    const busy = engine.getState().checkout?.status !== 'idle';
    showOverlay(busy);
    if (!submit) return;
    submit.disabled = busy || wasDisabled;
    submit.setAttribute('aria-busy', String(busy));
  };

  const renders = [
    addressForms,
    bindFields(engine, checkout, form, fields),
    phones,
    labels,
    address,
    bindBilling(engine, checkout, form),
    bindPayment(engine, checkout, form),
    paymentWidget,
    bindExpress(engine, pay),
    bindReview(engine),
    card?.render ?? (() => {}),
    renderErrors,
    renderSubmit,
  ];
  legacyCheckoutEvents(engine, form);
  const render = () => renders.forEach((r) => r());
  engine.subscribe(render);
  render();

  announceProspect(engine, form);
  checkout.setStep(step, page);
  checkout.begin();
  void checkout.loadCountries(legacyCountries());
  return checkout;
}

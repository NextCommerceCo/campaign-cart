import { RulesApi } from './state/rules';
import { type CheckoutActions, createCheckout, EXPRESS_METHODS, redirectFor } from './state/checkout';
import type { Engine } from '../engine/engine';
import { nextUrl } from '../engine/params';
import { bindAddress } from './address/country';
import { bindAddressForms } from './address/block';
import { bindAutocomplete } from './address/autocomplete';
import { bindBilling, cloneBillingRows } from './address/billing';
import { bindExpress } from './payment/express';
import { bindFields, phoneRequired, scanFields, syncFields } from './form/fields';
import { bindLabels } from './form/labels';
import {
  announceProspect,
  clearStepGuard,
  legacyAutocomplete,
  legacyCountries,
  stepUrlOf,
  writeStepGuard,
} from '../compat/checkout';
import { errorBox, showBox, shown } from './form/errors';
import { bindCard, bindPayment } from './payment/card';
import { bindPhones } from './address/phone';
import { bindReview } from './review';
import { expressText, formText, label } from './form/texts';

const RULES = 'https://i18n-rules.nextcommerce.com';
const SUBMIT = 'button[type="submit"], input[type="submit"], [data-next-checkout-submit], [os-checkout-submit]';

const meta = (...names: string[]) =>
  names.map((n) => document.querySelector<HTMLMetaElement>(`meta[name="${n}"]`)?.content).find(Boolean);

function failureUrl(): string {
  const url = new URL(location.href);
  url.searchParams.set('payment_failed', 'true');
  return meta('next-failure-url', 'os-failure-url') ?? url.href;
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

export function bindCheckout(
  engine: Engine,
  form: HTMLFormElement,
  navigate: (url: string) => void = (url) => location.assign(url),
): CheckoutActions {
  const rules = new RulesApi(window.fetch.bind(window), RULES, engine.getState().campaign?.language || 'en');
  const checkout = engine.attach((ctx) => createCheckout(ctx, engine.cart, rules));
  engine.checkout = checkout;
  form.noValidate = true;
  cloneBillingRows(form);
  const fields = scanFields(form);
  const autocomplete = () => legacyAutocomplete() && bindAutocomplete(fields, checkout);
  const addressForms = bindAddressForms(engine, form, fields, autocomplete);
  const labels = bindLabels(form);
  autocomplete();
  const card = bindCard(engine, checkout, form);
  const phones = bindPhones(engine, checkout, form, fields, RULES);
  const address = bindAddress(engine, form, fields);
  const stepUrl = stepUrlOf(form);
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

  const pay = async (method?: string): Promise<void> => {
    syncFields(fields, checkout, engine.getState().checkout);
    box =
      method && EXPRESS_METHODS.includes(method) ? 'express' : (engine.getState().checkout?.paymentMethod ?? 'credit');
    const successUrl = meta('next-success-url', 'next-next-url', 'os-next-page');
    const order = await checkout.placeOrder({
      method,
      successUrl,
      failureUrl: failureUrl(),
      pageUrl: location.href,
      tokenize: card?.tokenize,
      phoneRequired: phoneRequired(fields),
    });
    if (!order) {
      const errors = Object.keys(engine.getState().checkout?.errors ?? {});
      if (!method && box === 'card_token' && errors.some((name) => name !== 'form')) card?.check();
      return focusFirstError();
    }
    clearStepGuard();
    navigate(redirectFor(order, successUrl, current(), engine.getState().visit.params));
  };

  const advance = () => {
    syncFields(fields, checkout, engine.getState().checkout);
    const step = Number(form.getAttribute('data-next-step-number')) || 1;
    if (!checkout.validate('shipping', step === 1 && phoneRequired(fields))) return focusFirstError();
    checkout.setStep(step + 1);
    writeStepGuard(engine);
    navigate(nextUrl(stepUrl!, current(), engine.getState().visit.params));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (stepUrl) advance();
    else void pay();
  });

  const renderErrors = () => {
    const state = engine.getState().checkout;
    if (!state) return;
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
    const text = box === 'express' && parts.length ? expressText(parts.join(' ')) : parts.join(' ');
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
    bindExpress(engine, pay),
    bindReview(engine),
    card?.render ?? (() => {}),
    renderErrors,
    renderSubmit,
  ];
  const render = () => renders.forEach((r) => r());
  engine.subscribe(render);
  render();

  announceProspect(engine, form);
  checkout.begin();
  void checkout.loadCountries(legacyCountries());
  return checkout;
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import { ErrorDisplayManager } from '../../../utils/error-display-utils';
import {
  applyAvailablePaymentMethods,
  initializePaymentForms,
  updatePaymentFormVisibility,
  type PaymentFormDisplayContext,
} from '../payment-form-display';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** One `[data-next-payment-method]` wrapper: the radio plus the fields it reveals. */
function buildMethod(
  form: HTMLFormElement,
  method: string,
  radioValue = method
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-next-payment-method', method);
  wrapper.innerHTML = `
    <input type="radio" name="payment" value="${radioValue}">
    <div data-next-payment-form><input class="pm-field"></div>
  `;
  form.appendChild(wrapper);
  return wrapper;
}

function createCtx(methods: string[]): PaymentFormDisplayContext {
  const form = document.createElement('form');
  document.body.appendChild(form);
  methods.forEach(method => buildMethod(form, method));
  return {
    form,
    errors: new ErrorDisplayManager(),
    logger: createMockLogger() as unknown as Logger,
  };
}

function formOf(ctx: PaymentFormDisplayContext, method: string): HTMLElement {
  const wrapper = ctx.form.querySelector(
    `[data-next-payment-method="${method}"]`
  ) as HTMLElement;
  return wrapper.querySelector('[data-next-payment-form]') as HTMLElement;
}

/**
 * `requestAnimationFrame` runs its callback immediately so one call to
 * `updatePaymentFormVisibility` drives the whole animation set-up without waiting for a
 * frame. `vi.useFakeTimers()` also fakes RAF, so this must be re-applied after it.
 */
function stubSyncRaf(): void {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  stubSyncRaf();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useCheckoutStore.setState({ paymentMethod: 'credit-card' });
});

describe('initializePaymentForms', () => {
  it('opens the method the store already holds and shuts the rest', () => {
    const ctx = createCtx(['credit', 'paypal']);
    useCheckoutStore.setState({ paymentMethod: 'paypal' });

    initializePaymentForms(ctx);

    const paypal = formOf(ctx, 'paypal');
    const credit = formOf(ctx, 'credit');
    expect(paypal.getAttribute('data-next-payment-state')).toBe('expanded');
    expect(paypal.classList.contains('payment-method__form--expanded')).toBe(
      true
    );
    expect(credit.getAttribute('data-next-payment-state')).toBe('collapsed');
    expect(credit.style.height).toBe('0px');
  });

  /**
   * The store starts on `credit-card`, so a page that has not been touched yet
   * must open its card form and check its card radio. It stopped doing either in
   * 0.4.35: `credit-card` normalises to `credit_card`, which was dropped from the
   * radio table, so the store's own word for a card no longer resolved to the
   * word the `credit` wrapper resolves to. Nothing matched, every radio was
   * actively unchecked — including one the markup shipped `checked` — and the
   * card fields stayed collapsed until the shopper clicked.
   */
  it('opens the card the store starts on, and checks its radio', () => {
    const ctx = createCtx(['credit', 'ideal']);
    useCheckoutStore.setState({ paymentMethod: 'credit-card' });

    initializePaymentForms(ctx);

    expect(formOf(ctx, 'credit').getAttribute('data-next-payment-state')).toBe(
      'expanded'
    );
    expect(formOf(ctx, 'ideal').getAttribute('data-next-payment-state')).toBe(
      'collapsed'
    );

    const radios = ctx.form.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]'
    );
    expect(radios[0]?.checked).toBe(true);
    expect(radios[1]?.checked).toBe(false);
  });

  it('translates the store name to the markup spelling', () => {
    const ctx = createCtx(['credit', 'apple-pay']);
    useCheckoutStore.setState({ paymentMethod: 'apple_pay' });

    initializePaymentForms(ctx);

    expect(
      formOf(ctx, 'apple-pay').getAttribute('data-next-payment-state')
    ).toBe('expanded');
  });

  it('treats a tokenized card the same as a card', () => {
    const ctx = createCtx(['credit', 'paypal']);
    useCheckoutStore.setState({ paymentMethod: 'card_token' });

    initializePaymentForms(ctx);

    expect(formOf(ctx, 'credit').getAttribute('data-next-payment-state')).toBe(
      'expanded'
    );
  });

  it('reopens a redirect method the shopper picked before reloading', () => {
    const ctx = createCtx(['credit', 'ideal']);
    useCheckoutStore.setState({ paymentMethod: 'ideal' });

    initializePaymentForms(ctx);

    expect(formOf(ctx, 'ideal').getAttribute('data-next-payment-state')).toBe(
      'expanded'
    );
    expect(formOf(ctx, 'credit').getAttribute('data-next-payment-state')).toBe(
      'collapsed'
    );
  });

  it('reopens a method the SDK does not know by name', () => {
    // The page may offer a method this release predates. It is stored under its
    // own name, so it has to be found again under that name on the way back.
    const ctx = createCtx(['credit', 'pix']);
    useCheckoutStore.setState({ paymentMethod: 'pix' });

    initializePaymentForms(ctx);

    expect(formOf(ctx, 'pix').getAttribute('data-next-payment-state')).toBe(
      'expanded'
    );
    expect(formOf(ctx, 'credit').getAttribute('data-next-payment-state')).toBe(
      'collapsed'
    );
  });

  it('opens nothing for a wrapper that names no method at all', () => {
    const ctx = createCtx(['credit', '']);
    useCheckoutStore.setState({ paymentMethod: '' as never });

    initializePaymentForms(ctx);

    expect(formOf(ctx, '').getAttribute('data-next-payment-state')).toBe(
      'collapsed'
    );
  });

  it('checks the radio of the method it opened', () => {
    const ctx = createCtx(['credit', 'paypal']);
    useCheckoutStore.setState({ paymentMethod: 'paypal' });

    initializePaymentForms(ctx);

    const radios = ctx.form.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]'
    );
    expect(radios[0]?.checked).toBe(false);
    expect(radios[1]?.checked).toBe(true);
  });

  it('skips a wrapper with no radio or no payment form', () => {
    const ctx = createCtx(['credit']);
    const orphan = document.createElement('div');
    orphan.setAttribute('data-next-payment-method', 'klarna');
    ctx.form.appendChild(orphan);

    expect(() => initializePaymentForms(ctx)).not.toThrow();
  });

  it('does not animate — no transition is left on the forms', () => {
    const ctx = createCtx(['credit', 'paypal']);

    initializePaymentForms(ctx);

    expect(formOf(ctx, 'credit').style.transition).toBe('');
    expect(formOf(ctx, 'paypal').style.transition).toBe('');
  });
});

describe('updatePaymentFormVisibility', () => {
  it('opens the chosen method and closes the previous one', () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const ctx = createCtx(['credit', 'paypal']);
    initializePaymentForms(ctx);

    updatePaymentFormVisibility(ctx, 'paypal');
    vi.advanceTimersByTime(300);

    expect(
      formOf(ctx, 'paypal').classList.contains('payment-method__form--expanded')
    ).toBe(true);
    expect(
      formOf(ctx, 'credit').classList.contains(
        'payment-method__form--collapsed'
      )
    ).toBe(true);
    expect(formOf(ctx, 'credit').style.height).toBe('0px');
  });

  it('marks the chosen wrapper selected and unmarks the others', () => {
    const ctx = createCtx(['credit', 'paypal']);
    initializePaymentForms(ctx);

    updatePaymentFormVisibility(ctx, 'paypal');

    expect(
      ctx.form
        .querySelector('[data-next-payment-method="paypal"]')
        ?.classList.contains('next-selected')
    ).toBe(true);
    expect(
      ctx.form
        .querySelector('[data-next-payment-method="credit"]')
        ?.classList.contains('next-selected')
    ).toBe(false);
  });

  it('clears validation marks from every payment form it touches', () => {
    const ctx = createCtx(['credit', 'paypal']);
    initializePaymentForms(ctx);
    const creditField = formOf(ctx, 'credit').querySelector(
      '.pm-field'
    ) as HTMLElement;
    creditField.classList.add('has-error', 'next-error-field');

    updatePaymentFormVisibility(ctx, 'paypal');

    expect(creditField.classList.contains('has-error')).toBe(false);
    expect(creditField.classList.contains('next-error-field')).toBe(false);
  });

  /**
   * **Defect, left as found.** Each animation schedules an untracked 300 ms `setTimeout`
   * to settle its final classes. Switching method twice inside that window leaves two
   * timers pointed at the same form, and the *expand* one — registered first, so fired
   * first — is not the one that wins: it clears the inline height the collapse had just
   * pinned to `0px`. The form ends up carrying both classes with no height of its own, so
   * a deselected payment method stays open and its inputs stay in the tab order.
   *
   * Not fixed here: the fix is to cancel the pending timer before starting the opposite
   * animation, the way `checkout-form/billing-animation.ts` cancels its own — a behaviour
   * change that needs its own commit and its own E2E.
   */
  it('leaves a deselected form open when the shopper switches twice inside 300ms (known defect)', () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const ctx = createCtx(['credit', 'paypal']);
    // Start with the card form shut, so selecting it really animates open.
    useCheckoutStore.setState({ paymentMethod: 'paypal' });
    initializePaymentForms(ctx);

    updatePaymentFormVisibility(ctx, 'credit');
    updatePaymentFormVisibility(ctx, 'paypal');
    vi.advanceTimersByTime(300);

    const credit = formOf(ctx, 'credit');
    expect(credit.classList.contains('payment-method__form--collapsed')).toBe(
      true
    );
    expect(credit.classList.contains('payment-method__form--expanded')).toBe(
      true
    );
    // The collapse pinned this to '0px'; the expand timer wiped it.
    expect(credit.style.height).toBe('');
  });

  it('does not re-animate a form that is already open', () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const ctx = createCtx(['credit', 'paypal']);
    initializePaymentForms(ctx);
    updatePaymentFormVisibility(ctx, 'credit');
    vi.advanceTimersByTime(300);

    updatePaymentFormVisibility(ctx, 'credit');

    expect(
      formOf(ctx, 'credit').classList.contains(
        'payment-method__form--expanding'
      )
    ).toBe(false);
  });
});

/**
 * Which methods the campaign can actually charge.
 *
 * A radio for a method the merchant has not enabled produces an order the API
 * refuses, so the shopper meets a dead end on something the page offered. The
 * express buttons were always filtered this way; the radios were not.
 */
describe('applyAvailablePaymentMethods', () => {
  /** Whether a wrapper is hidden, by the only means that survives no template CSS. */
  function isHidden(ctx: PaymentFormDisplayContext, method: string): boolean {
    const wrapper = ctx.form.querySelector<HTMLElement>(
      `[data-next-payment-method="${method}"]`
    );
    return wrapper?.style.display === 'none';
  }

  it('hides a method the campaign does not list', () => {
    const ctx = createCtx(['credit', 'paypal', 'ideal']);

    applyAvailablePaymentMethods(ctx, ['bankcard', 'paypal']);

    expect(isHidden(ctx, 'ideal')).toBe(true);
    expect(isHidden(ctx, 'paypal')).toBe(false);
  });

  it('keeps the card whatever the campaign lists', () => {
    // Every store takes a card, so a list without `bankcard` is an incomplete
    // list rather than a store that refuses cards.
    const ctx = createCtx(['credit', 'ideal']);

    applyAvailablePaymentMethods(ctx, ['ideal']);

    expect(isHidden(ctx, 'credit')).toBe(false);
  });

  it('hides nothing when the campaign lists nothing', () => {
    // The negative control. Not knowing what a campaign supports is not the same
    // as knowing it supports nothing, and hiding every method is worse than
    // offering one that fails.
    const ctx = createCtx(['credit', 'paypal', 'ideal']);

    applyAvailablePaymentMethods(ctx, undefined);
    applyAvailablePaymentMethods(ctx, []);

    expect(isHidden(ctx, 'paypal')).toBe(false);
    expect(isHidden(ctx, 'ideal')).toBe(false);
  });

  it('adds next-hidden as well, so the state can be styled', () => {
    const ctx = createCtx(['credit', 'ideal']);

    applyAvailablePaymentMethods(ctx, ['bankcard']);

    const wrapper = ctx.form.querySelector(
      '[data-next-payment-method="ideal"]'
    );
    expect(wrapper?.classList.contains('next-hidden')).toBe(true);
  });

  it('shows a method again once the campaign offers it', () => {
    const ctx = createCtx(['credit', 'ideal']);

    applyAvailablePaymentMethods(ctx, ['bankcard']);
    applyAvailablePaymentMethods(ctx, ['bankcard', 'ideal']);

    expect(isHidden(ctx, 'ideal')).toBe(false);
    const wrapper = ctx.form.querySelector(
      '[data-next-payment-method="ideal"]'
    );
    expect(wrapper?.classList.contains('next-hidden')).toBe(false);
  });

  it('moves the shopper off a method it just hid', () => {
    const ctx = createCtx(['credit', 'ideal']);
    const ideal = ctx.form.querySelector<HTMLInputElement>(
      '[data-next-payment-method="ideal"] input'
    );
    const credit = ctx.form.querySelector<HTMLInputElement>(
      '[data-next-payment-method="credit"] input'
    );
    ideal!.checked = true;

    applyAvailablePaymentMethods(ctx, ['bankcard']);

    expect(ideal!.checked).toBe(false);
    expect(credit!.checked).toBe(true);
  });

  it('leaves a selection alone when it is still available', () => {
    const ctx = createCtx(['credit', 'ideal']);
    const ideal = ctx.form.querySelector<HTMLInputElement>(
      '[data-next-payment-method="ideal"] input'
    );
    ideal!.checked = true;

    applyAvailablePaymentMethods(ctx, ['bankcard', 'ideal']);

    expect(ideal!.checked).toBe(true);
  });

  it('leaves a wrapper naming no method alone', () => {
    const ctx = createCtx(['credit', '']);

    applyAvailablePaymentMethods(ctx, ['bankcard']);

    expect(isHidden(ctx, '')).toBe(false);
  });
});

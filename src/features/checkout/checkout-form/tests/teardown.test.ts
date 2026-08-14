import { describe, it, expect, vi, afterEach } from 'vitest';
import { CheckoutFormEnhancer } from '../checkout-form.enhancer';
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';
import { EventBus } from '@/core/events';

/**
 * What the form must stop doing once it is destroyed.
 *
 * Every case here failed before findings 117, 118 and 121 were fixed: the bus
 * handlers were registered with `this.eventBus.on` instead of `this.on`, the
 * `document`/`window` handlers with inline arrows that `removeEventListener` can
 * never match, the `begin_checkout` delay was untracked, and `UIService` was never
 * torn down. `EventBus` and `window` both live as long as the page, so each of
 * those kept a destroyed enhancer running — the two express-checkout handlers
 * writing `checkoutStore` on every restore and every window focus.
 */

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** The privates these teardown tests reach for, without a cast at each call. */
interface FormInternals {
  destroy(): void;
  bindFormElement(): void;
  listenForPaymentErrors(): void;
  listenForDebugCountryChanges(): void;
  setupBfcacheRestoreHandler(): void;
  setupWindowFocusHandler(): void;
  scheduleBeginCheckoutTracking(): void;
  initializeLocationFieldVisibility(): void;

  displayPaymentError(message: string): void;
  handleCountryChange(country: string): Promise<void>;
  handlePurchaseEvent(): Promise<void>;
  trackBeginCheckout(): void;
  showLocationFields(): void;

  logger: ReturnType<typeof createMockLogger>;
  fields: Map<string, HTMLElement>;
  changeHandler?: (event: Event) => void;
  ui?: { destroy: () => void };
}

/** Every enhancer a test made, so one that leaks cannot reach the next test. */
const created: FormInternals[] = [];

function createEnhancer(): { steps: FormInternals; form: HTMLFormElement } {
  const form = document.createElement('form');
  document.body.appendChild(form);
  const steps = new CheckoutFormEnhancer(form) as unknown as FormInternals;
  steps.logger = createMockLogger();
  steps.bindFormElement();
  created.push(steps);
  return { steps, form };
}

function setCheckoutState(state: {
  isProcessing: boolean;
  paymentMethod: CheckoutState['paymentMethod'];
}): void {
  useCheckoutStore.setState({
    isProcessing: state.isProcessing,
    paymentMethod: state.paymentMethod,
    paymentToken: 'tok_stale',
  });
}

/** Makes `pageshow` look like a back/forward restore. */
function navigationTypeIs(type: string): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
    { type },
  ] as unknown as PerformanceEntryList);
}

afterEach(() => {
  created.splice(0).forEach(steps => steps.destroy());
  vi.restoreAllMocks();
  vi.clearAllMocks();
  EventBus.getInstance().removeAllListeners('payment:error');
  EventBus.getInstance().removeAllListeners('address:autocomplete-filled');
  useCheckoutStore.getState().reset();
});

// ─── Event-bus handlers (finding 117) ─────────────────────────────────────────

describe('destroy: event-bus handlers', () => {
  it('stops displaying payment errors raised elsewhere', () => {
    const { steps } = createEnhancer();
    const display = vi
      .spyOn(steps, 'displayPaymentError')
      .mockImplementation(() => {});
    steps.listenForPaymentErrors();

    const declined = { message: 'Your card was declined.' };
    EventBus.getInstance().emit('payment:error', declined);
    expect(display).toHaveBeenCalledTimes(1);

    steps.destroy();
    EventBus.getInstance().emit('payment:error', declined);

    expect(display).toHaveBeenCalledTimes(1);
  });

  it('stops revealing location fields when autocomplete fills an address', () => {
    const { steps } = createEnhancer();
    steps.initializeLocationFieldVisibility();
    const reveal = vi
      .spyOn(steps, 'showLocationFields')
      .mockImplementation(() => {});

    EventBus.getInstance().emit('address:autocomplete-filled', {
      type: 'shipping',
      components: {},
    });
    expect(reveal).toHaveBeenCalledTimes(1);

    steps.destroy();
    EventBus.getInstance().emit('address:autocomplete-filled', {
      type: 'shipping',
      components: {},
    });

    expect(reveal).toHaveBeenCalledTimes(1);
  });
});

// ─── document / window handlers (finding 117) ─────────────────────────────────

describe('destroy: document and window handlers', () => {
  it('stops following the debug country selector', () => {
    const { steps } = createEnhancer();
    const change = vi
      .spyOn(steps, 'handleCountryChange')
      .mockResolvedValue(undefined);

    document.dispatchEvent(
      new CustomEvent('next:country-changed', { detail: { to: 'CA' } })
    );
    expect(change).not.toHaveBeenCalled();

    steps.listenForDebugCountryChanges();
    document.dispatchEvent(
      new CustomEvent('next:country-changed', { detail: { to: 'CA' } })
    );
    expect(change).toHaveBeenCalledTimes(1);

    steps.destroy();
    document.dispatchEvent(
      new CustomEvent('next:country-changed', { detail: { to: 'GB' } })
    );

    expect(change).toHaveBeenCalledTimes(1);
  });

  it('stops resetting the checkout store on a bfcache restore', () => {
    const { steps } = createEnhancer();
    vi.spyOn(steps, 'handlePurchaseEvent').mockResolvedValue(undefined);
    navigationTypeIs('back_forward');
    steps.setupBfcacheRestoreHandler();

    setCheckoutState({ isProcessing: true, paymentMethod: 'paypal' });
    window.dispatchEvent(new Event('pageshow'));
    expect(useCheckoutStore.getState().paymentMethod).toBe('card_token');

    steps.destroy();
    setCheckoutState({ isProcessing: true, paymentMethod: 'paypal' });
    window.dispatchEvent(new Event('pageshow'));

    const state = useCheckoutStore.getState();
    expect(state.paymentMethod).toBe('paypal');
    expect(state.isProcessing).toBe(true);
  });

  it('stops cancelling express checkout when the window regains focus', () => {
    const { steps } = createEnhancer();
    steps.setupWindowFocusHandler();

    setCheckoutState({ isProcessing: true, paymentMethod: 'google_pay' });
    window.dispatchEvent(new Event('focus'));
    expect(useCheckoutStore.getState().paymentMethod).toBe('card_token');

    steps.destroy();
    setCheckoutState({ isProcessing: true, paymentMethod: 'google_pay' });
    window.dispatchEvent(new Event('focus'));

    const state = useCheckoutStore.getState();
    expect(state.paymentMethod).toBe('google_pay');
    expect(state.isProcessing).toBe(true);
  });
});

// ─── Timers and services ──────────────────────────────────────────────────────

describe('destroy: pending work', () => {
  // Finding 118.
  it('cancels the begin_checkout report scheduled 500 ms out', () => {
    vi.useFakeTimers();
    const { steps } = createEnhancer();
    const track = vi
      .spyOn(steps, 'trackBeginCheckout')
      .mockImplementation(() => {});

    steps.scheduleBeginCheckoutTracking();
    steps.destroy();
    vi.advanceTimersByTime(1000);

    expect(track).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // Finding 121.
  it('tears down the UI service, which owns a 500 ms poll of its own', () => {
    const { steps } = createEnhancer();
    const ui = { destroy: vi.fn() };
    steps.ui = ui;

    steps.destroy();

    expect(ui.destroy).toHaveBeenCalledTimes(1);
  });

  // Finding 101: the field maps were cleared before `super.destroy()`, which is what
  // runs `cleanupEventListeners()` — so it iterated two empty maps and removed nothing.
  it('removes the change listener from a field it still knows about', () => {
    const { steps } = createEnhancer();
    const field = document.createElement('input');
    const changeHandler = vi.fn();
    steps.fields.set('email', field);
    steps.changeHandler = changeHandler;
    field.addEventListener('change', changeHandler);

    steps.destroy();
    field.dispatchEvent(new Event('change'));

    expect(changeHandler).not.toHaveBeenCalled();
  });
});

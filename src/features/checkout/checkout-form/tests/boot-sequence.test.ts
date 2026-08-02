import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CheckoutFormEnhancer } from '../checkout-form.enhancer';
import { scanBillingFields, setupBillingForm } from '../billing-form-setup';
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';
import { useConfigStore } from '@/state/config';
import { EventBus } from '@/core/events';

// The clone step is the only boot step whose branch lives in another module, so
// that module is the one thing stubbed here. Everything else runs for real.
vi.mock('../billing-form-setup', () => ({
  setupBillingForm: vi.fn(() => false),
  scanBillingFields: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Kept as a plain object (not typed as `Logger`) so `logger.info` stays a `Mock`
// in assertions — see the note in billing-animation.test.ts.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

type PhoneInstance = { isValidNumber: () => boolean };
type PhoneValidator = (phone: string, type?: 'shipping' | 'billing') => boolean;

/** Every private the boot steps touch, reachable without a cast at each call. */
interface BootSteps {
  initialize(): Promise<void>;
  bindFormElement(): void;
  cloneBillingFormFromShipping(): void;
  restoreBillingChoice(): void;
  setupPhoneValidation(): void;
  subscribeToStores(): void;
  setupDebugEventListeners(): void;
  listenForPaymentErrors(): void;
  listenForDebugCountryChanges(): void;
  setupBfcacheRestoreHandler(): void;
  setupWindowFocusHandler(): void;
  scheduleBeginCheckoutTracking(): void;

  displayPaymentError(message: string): void;
  handleCountryChange(country: string): Promise<void>;
  handlePurchaseEvent(): Promise<void>;
  trackBeginCheckout(): void;
  subscribe(store: unknown, listener: unknown): void;
  emit(event: string, detail: unknown): void;

  form: HTMLElement;
  logger: ReturnType<typeof createMockLogger>;
  validator: { setPhoneValidator: (fn: PhoneValidator) => void };
  phoneInputs: Map<string, PhoneInstance>;
  creditCardService?: { initialize: () => Promise<void> };
  boundHandleTestDataFilled?: EventListener;
  boundHandleKonamiActivation?: EventListener;
}

function createEnhancer(element?: HTMLElement): {
  steps: BootSteps;
  logger: ReturnType<typeof createMockLogger>;
  form: HTMLElement;
} {
  const form = element ?? document.createElement('form');
  document.body.appendChild(form);
  const logger = createMockLogger();
  const steps = new CheckoutFormEnhancer(form) as unknown as BootSteps;
  steps.logger = logger;
  return { steps, logger, form };
}

/**
 * Runs `register` with `addEventListener` stubbed, and hands back the listener it
 * tried to register. Nothing is attached to the real `window`/`document`, so one
 * test's handler can never fire during the next one.
 */
function captureListener<TResult = void>(
  target: Window | Document,
  type: string,
  register: () => void
): (event: unknown) => TResult {
  let captured: ((event: unknown) => TResult) | undefined;
  const spy = vi.spyOn(target, 'addEventListener').mockImplementation(((
    eventType: string,
    listener: (event: unknown) => TResult
  ) => {
    if (eventType === type) captured = listener;
  }) as typeof target.addEventListener);
  register();
  spy.mockRestore();
  if (!captured) throw new Error(`no "${type}" listener was registered`);
  return captured;
}

function setCheckoutState(state: {
  isProcessing: boolean;
  paymentMethod: CheckoutState['paymentMethod'];
  paymentToken?: string;
}): void {
  useCheckoutStore.setState({
    isProcessing: state.isProcessing,
    paymentMethod: state.paymentMethod,
    paymentToken: state.paymentToken ?? 'tok_stale',
  });
}

function navigationTypeIs(type: string): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
    { type },
  ] as unknown as PerformanceEntryList);
}

beforeEach(() => {
  vi.mocked(setupBillingForm).mockReturnValue(false);
  navigationTypeIs('navigate');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  EventBus.getInstance().removeAllListeners('payment:error');
  useCheckoutStore.getState().reset();
});

// ─── bindFormElement ──────────────────────────────────────────────────────────

describe('bindFormElement', () => {
  it('rejects an element that is not a form', () => {
    const { steps } = createEnhancer(document.createElement('div'));

    expect(() => steps.bindFormElement()).toThrow(
      'CheckoutFormEnhancer must be applied to a form element'
    );
  });

  it('adopts a form element and turns off native validation', () => {
    const form = document.createElement('form');
    const { steps } = createEnhancer(form);

    steps.bindFormElement();

    expect(steps.form).toBe(form);
    expect(form.noValidate).toBe(true);
  });
});

// ─── cloneBillingFormFromShipping ─────────────────────────────────────────────

describe('cloneBillingFormFromShipping', () => {
  it('re-scans the billing fields when a billing form was cloned', () => {
    const { steps } = createEnhancer();
    steps.bindFormElement();
    vi.mocked(setupBillingForm).mockReturnValue(true);

    steps.cloneBillingFormFromShipping();

    expect(scanBillingFields).toHaveBeenCalledTimes(1);
  });

  it('does not re-scan when the page already had a billing form', () => {
    const { steps } = createEnhancer();
    steps.bindFormElement();
    vi.mocked(setupBillingForm).mockReturnValue(false);

    steps.cloneBillingFormFromShipping();

    expect(scanBillingFields).not.toHaveBeenCalled();
  });
});

// ─── setupPhoneValidation ─────────────────────────────────────────────────────

describe('setupPhoneValidation', () => {
  function installValidator(steps: BootSteps): PhoneValidator {
    let validate: PhoneValidator | undefined;
    steps.validator = {
      setPhoneValidator: (fn: PhoneValidator) => {
        validate = fn;
      },
    };
    steps.setupPhoneValidation();
    if (!validate) throw new Error('no phone validator was installed');
    return validate;
  }

  it('asks the intl-tel-input instance for the requested form', () => {
    const { steps } = createEnhancer();
    steps.phoneInputs.set('shipping', { isValidNumber: () => true });
    steps.phoneInputs.set('billing', { isValidNumber: () => false });

    const validate = installValidator(steps);

    expect(validate('+15551234567')).toBe(true);
    expect(validate('+15551234567', 'billing')).toBe(false);
  });

  it('falls back to a character check when no instance exists', () => {
    const { steps } = createEnhancer();

    const validate = installValidator(steps);

    expect(validate('+1 (555) 123-4567')).toBe(true);
    expect(validate('not-a-number')).toBe(false);
  });
});

// ─── subscribeToStores / setupDebugEventListeners ─────────────────────────────

describe('subscribeToStores', () => {
  it('subscribes to the checkout, cart and config stores', () => {
    const { steps } = createEnhancer();
    const subscribe = vi.spyOn(steps, 'subscribe').mockImplementation(() => {});

    steps.subscribeToStores();

    expect(subscribe).toHaveBeenCalledTimes(3);
  });
});

describe('setupDebugEventListeners', () => {
  it('keeps the bound handlers so cleanup can remove them again', () => {
    const { steps } = createEnhancer();
    const registered: string[] = [];
    const spy = vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string
    ) => {
      registered.push(type);
    }) as typeof document.addEventListener);

    steps.setupDebugEventListeners();
    spy.mockRestore();

    expect(registered).toEqual([
      'checkout:test-data-filled',
      'next:test-mode-activated',
    ]);
    expect(typeof steps.boundHandleTestDataFilled).toBe('function');
    expect(typeof steps.boundHandleKonamiActivation).toBe('function');
  });
});

// ─── listenForPaymentErrors ───────────────────────────────────────────────────

describe('listenForPaymentErrors', () => {
  it('displays a payment error that carries a message', () => {
    const { steps } = createEnhancer();
    const display = vi
      .spyOn(steps, 'displayPaymentError')
      .mockImplementation(() => {});
    steps.listenForPaymentErrors();

    // `order-manager` emits `{ message, code, details }` here — not the
    // `{ errors }` the EventMap declares. See the note in the test below.
    EventBus.getInstance().emit('payment:error', {
      message: 'Your card was declined.',
    } as unknown as { errors: string[] });

    expect(display).toHaveBeenCalledWith('Your card was declined.');
  });

  // The declared `payment:error` payload is `{ errors: string[] }`, which this
  // step never displays: only the off-contract `{ message }` shape that
  // `order-manager` emits gets through.
  it('ignores a payment error with no message', () => {
    const { steps } = createEnhancer();
    const display = vi
      .spyOn(steps, 'displayPaymentError')
      .mockImplementation(() => {});
    steps.listenForPaymentErrors();

    EventBus.getInstance().emit('payment:error', {
      errors: ['Your card was declined.'],
    });

    expect(display).not.toHaveBeenCalled();
  });
});

// ─── listenForDebugCountryChanges ─────────────────────────────────────────────

describe('listenForDebugCountryChanges', () => {
  it('applies the country the debug selector switched to', async () => {
    const { steps } = createEnhancer();
    const change = vi
      .spyOn(steps, 'handleCountryChange')
      .mockResolvedValue(undefined);
    const listener = captureListener<Promise<void>>(
      document,
      'next:country-changed',
      () => steps.listenForDebugCountryChanges()
    );

    await listener({ detail: { to: 'CA' } });

    expect(change).toHaveBeenCalledWith('CA');
  });

  it('ignores an event with no target country', async () => {
    const { steps } = createEnhancer();
    const change = vi
      .spyOn(steps, 'handleCountryChange')
      .mockResolvedValue(undefined);
    const listener = captureListener<Promise<void>>(
      document,
      'next:country-changed',
      () => steps.listenForDebugCountryChanges()
    );

    await listener({ detail: {} });

    expect(change).not.toHaveBeenCalled();
  });
});

// ─── setupBfcacheRestoreHandler ───────────────────────────────────────────────

describe('setupBfcacheRestoreHandler', () => {
  function pageshow(steps: BootSteps): (event: unknown) => void {
    return captureListener(window, 'pageshow', () =>
      steps.setupBfcacheRestoreHandler()
    );
  }

  function spreedlyKeyIs(key: string | undefined): void {
    useConfigStore.setState({ spreedlyEnvironmentKey: key });
  }

  it('does nothing on a fresh navigation', () => {
    const { steps, logger } = createEnhancer();
    const purchase = vi
      .spyOn(steps, 'handlePurchaseEvent')
      .mockResolvedValue(undefined);
    setCheckoutState({ isProcessing: true, paymentMethod: 'paypal' });

    pageshow(steps)({ persisted: false });

    expect(logger.info).not.toHaveBeenCalled();
    expect(purchase).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().isProcessing).toBe(true);
  });

  it('restores state when the navigation type says back/forward', () => {
    const { steps } = createEnhancer();
    vi.spyOn(steps, 'handlePurchaseEvent').mockResolvedValue(undefined);
    navigationTypeIs('back_forward');
    setCheckoutState({ isProcessing: true, paymentMethod: 'credit-card' });

    pageshow(steps)({ persisted: false });

    expect(useCheckoutStore.getState().isProcessing).toBe(false);
  });

  it('clears the express payment method and its stale token', () => {
    const { steps, logger } = createEnhancer();
    const purchase = vi
      .spyOn(steps, 'handlePurchaseEvent')
      .mockResolvedValue(undefined);
    setCheckoutState({ isProcessing: true, paymentMethod: 'apple_pay' });

    pageshow(steps)({ persisted: true });

    const state = useCheckoutStore.getState();
    expect(state.isProcessing).toBe(false);
    expect(state.paymentMethod).toBe('credit-card');
    expect(state.paymentToken).toBe('');
    expect(purchase).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Page restored from bfcache, resetting express checkout state'
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Resetting processing state after bfcache restore'
    );
  });

  it('leaves a card payment method alone', () => {
    const { steps } = createEnhancer();
    vi.spyOn(steps, 'handlePurchaseEvent').mockResolvedValue(undefined);
    setCheckoutState({
      isProcessing: false,
      paymentMethod: 'credit-card',
      paymentToken: 'tok_live',
    });

    pageshow(steps)({ persisted: true });

    expect(useCheckoutStore.getState().paymentToken).toBe('tok_live');
  });

  it('re-initializes the credit card service only when Spreedly is configured', () => {
    const { steps } = createEnhancer();
    vi.spyOn(steps, 'handlePurchaseEvent').mockResolvedValue(undefined);
    steps.creditCardService = {
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    const restore = pageshow(steps);

    spreedlyKeyIs(undefined);
    restore({ persisted: true });
    expect(steps.creditCardService.initialize).not.toHaveBeenCalled();

    spreedlyKeyIs('env_key');
    restore({ persisted: true });
    expect(steps.creditCardService.initialize).toHaveBeenCalledTimes(1);
    spreedlyKeyIs(undefined);
  });

  /**
   * `handleConfigUpdate` creates the credit-card service when the key arrives *after*
   * boot. The handler used to close over the config snapshot `initialize` captured, so
   * in exactly that case it saw a truthy `creditCardService` and no key, and skipped
   * re-initializing the hosted fields it had just checked for. Finding 119.
   */
  it('reads the Spreedly key live, not from the boot-time snapshot', () => {
    spreedlyKeyIs(undefined);
    const { steps } = createEnhancer();
    vi.spyOn(steps, 'handlePurchaseEvent').mockResolvedValue(undefined);
    steps.creditCardService = {
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    // Registered while the key is still missing; it arrives only afterwards.
    const restore = pageshow(steps);
    spreedlyKeyIs('env_key');
    restore({ persisted: true });

    expect(steps.creditCardService.initialize).toHaveBeenCalledTimes(1);
    spreedlyKeyIs(undefined);
  });

  it('logs a failed credit card re-initialization instead of throwing', async () => {
    const { steps, logger } = createEnhancer();
    vi.spyOn(steps, 'handlePurchaseEvent').mockResolvedValue(undefined);
    const failure = new Error('Spreedly unavailable');
    steps.creditCardService = {
      initialize: vi.fn().mockRejectedValue(failure),
    };
    spreedlyKeyIs('env_key');

    pageshow(steps)({ persisted: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to re-initialize credit card service:',
      failure
    );
    spreedlyKeyIs(undefined);
  });
});

// ─── setupWindowFocusHandler ──────────────────────────────────────────────────

describe('setupWindowFocusHandler', () => {
  function focus(steps: BootSteps): (event: unknown) => void {
    return captureListener(window, 'focus', () =>
      steps.setupWindowFocusHandler()
    );
  }

  it('does nothing when no checkout is in flight', () => {
    const { steps, logger } = createEnhancer();
    setCheckoutState({
      isProcessing: false,
      paymentMethod: 'paypal',
      paymentToken: 'tok_live',
    });

    focus(steps)(new Event('focus'));

    expect(logger.info).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().paymentMethod).toBe('paypal');
  });

  it('cancels a stuck express payment when the window regains focus', () => {
    const { steps } = createEnhancer();
    setCheckoutState({ isProcessing: true, paymentMethod: 'google_pay' });

    focus(steps)(new Event('focus'));

    const state = useCheckoutStore.getState();
    expect(state.isProcessing).toBe(false);
    expect(state.paymentMethod).toBe('credit-card');
    expect(state.paymentToken).toBe('');
  });

  it('clears processing but keeps a card payment method and its token', () => {
    const { steps } = createEnhancer();
    setCheckoutState({
      isProcessing: true,
      paymentMethod: 'credit-card',
      paymentToken: 'tok_live',
    });

    focus(steps)(new Event('focus'));

    const state = useCheckoutStore.getState();
    expect(state.isProcessing).toBe(false);
    expect(state.paymentToken).toBe('tok_live');
  });
});

// ─── scheduleBeginCheckoutTracking ────────────────────────────────────────────

describe('scheduleBeginCheckoutTracking', () => {
  it('tracks begin_checkout once, after the analytics providers have registered', () => {
    vi.useFakeTimers();
    const { steps } = createEnhancer();
    const track = vi
      .spyOn(steps, 'trackBeginCheckout')
      .mockImplementation(() => {});

    steps.scheduleBeginCheckoutTracking();

    vi.advanceTimersByTime(499);
    expect(track).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(track).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(track).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

// ─── The sequence itself ──────────────────────────────────────────────────────

/**
 * The boot order is the contract this refactor exists to make visible, so it is
 * asserted directly: every step is replaced by a recorder and the recorded order
 * must match, exactly and in full.
 */
describe('initialize', () => {
  const STEPS_IN_ORDER = [
    'bindFormElement',
    'detectMultiStepCheckout',
    'initializeApiDependencies',
    'refreshAttribution',
    'initializeOrderProcessors',
    'initializeValidator',
    'scanAllFields',
    'cloneBillingFormFromShipping',
    'restoreBillingChoice',
    'initializeUIService',
    'initializeCreditCard',
    'initializeAddressManagement',
    'initializePhoneInputs',
    'setupPhoneValidation',
    'setupEventHandlers',
    'subscribeToStores',
    'setupDebugEventListeners',
    'populateFormData',
    'initializeLocationFieldVisibility',
    'initializeProspectCart',
    'listenForPaymentErrors',
    'listenForDebugCountryChanges',
    'setupBfcacheRestoreHandler',
    'setupWindowFocusHandler',
    'handlePurchaseEvent',
    'scheduleBeginCheckoutTracking',
  ];

  function recordSteps(steps: BootSteps): string[] {
    const order: string[] = [];
    const bag = steps as unknown as Record<string, () => void>;
    for (const name of STEPS_IN_ORDER) {
      vi.spyOn(bag, name).mockImplementation(() => {
        order.push(name);
      });
    }
    return order;
  }

  it('runs every step in order when Spreedly is configured', async () => {
    useConfigStore.setState({ spreedlyEnvironmentKey: 'env_key' });
    const { steps } = createEnhancer();
    const order = recordSteps(steps);

    await steps.initialize();

    expect(order).toEqual(STEPS_IN_ORDER);
    useConfigStore.setState({ spreedlyEnvironmentKey: undefined });
  });

  it('skips the credit card step when Spreedly is not configured', async () => {
    useConfigStore.setState({ spreedlyEnvironmentKey: undefined });
    const { steps } = createEnhancer();
    const order = recordSteps(steps);

    await steps.initialize();

    expect(order).toEqual(
      STEPS_IN_ORDER.filter(name => name !== 'initializeCreditCard')
    );
  });

  it('announces itself once the sequence has finished', async () => {
    const { steps, logger, form } = createEnhancer();
    recordSteps(steps);
    steps.form = form;
    const emit = vi.spyOn(steps, 'emit').mockImplementation(() => {});

    await steps.initialize();

    expect(logger.debug).toHaveBeenCalledWith(
      'CheckoutFormEnhancer initialized'
    );
    expect(emit).toHaveBeenCalledWith('checkout:form-initialized', { form });
  });
});

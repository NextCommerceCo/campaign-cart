import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupTriggers,
  setupFormStartTrigger,
  setupEmailEntryTrigger,
  setupPhoneEntryTrigger,
} from '../triggers';
import type { TriggerContext } from '../prospect-cart.types';
import type { Logger } from '@/core/logger';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function buildContainer(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

function makeContext(
  element: HTMLElement,
  overrides: Partial<TriggerContext> = {}
): {
  context: TriggerContext;
  logger: ReturnType<typeof createMockLogger>;
  checkAndCreateCart: ReturnType<typeof vi.fn>;
  createProspectCart: ReturnType<typeof vi.fn>;
} {
  const logger = createMockLogger();
  const checkAndCreateCart = vi.fn();
  const createProspectCart = vi.fn().mockResolvedValue(undefined);
  const context: TriggerContext = {
    element,
    emailField: element.querySelector('[data-next-checkout-field="email"]') as
      | HTMLInputElement
      | undefined,
    phoneField: element.querySelector('[data-next-checkout-field="phone"]') as
      | HTMLInputElement
      | undefined,
    logger: logger as unknown as Logger,
    phoneBlurTimeoutRef: { value: undefined },
    hasTriggeredRef: { value: false },
    signal: new AbortController().signal,
    isValidPhone: () => true,
    checkAndCreateCart,
    createProspectCart,
    ...overrides,
  };
  return { context, logger, checkAndCreateCart, createProspectCart };
}

describe('setupTriggers', () => {
  it('does nothing when autoCreate is false', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="email" />'
    );
    const { context, checkAndCreateCart } = makeContext(container);
    setupTriggers({ autoCreate: false, triggerOn: 'emailEntry' }, context);

    (context.emailField as HTMLInputElement).dispatchEvent(new Event('change'));
    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });

  it('wires only the phone trigger for phoneEntry', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="phone" type="tel" />'
    );
    const { context, logger } = makeContext(container, {
      phoneField: container.querySelector('input') as HTMLInputElement,
    });
    setupTriggers({ autoCreate: true, triggerOn: 'phoneEntry' }, context);
    expect(logger.debug).toHaveBeenCalledWith(
      'Setting up phone entry trigger on field:',
      context.phoneField
    );
  });

  it('is a no-op for manual — no listeners wired', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="email" />'
    );
    const { context, checkAndCreateCart } = makeContext(container);
    setupTriggers({ autoCreate: true, triggerOn: 'manual' }, context);

    (context.emailField as HTMLInputElement).dispatchEvent(new Event('change'));
    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });
});

describe('setupFormStartTrigger', () => {
  /**
   * DEFECT: formStart calls `createProspectCart` directly and sets
   * `hasTriggeredRef.value = true` on the very first focus/input in ANY field —
   * it never goes through `checkAndCreateCart`'s email/phone/name validation.
   * A shopper who tabs into a field and leaves without typing anything still
   * gets a prospect cart created (with whatever blank values are on the form
   * at that instant).
   */
  it('creates the cart directly on the first interaction, bypassing field validation', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="email" />'
    );
    const { context, createProspectCart, checkAndCreateCart } =
      makeContext(container);

    setupFormStartTrigger(context);
    const input = container.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    expect(createProspectCart).toHaveBeenCalledTimes(1);
    expect(checkAndCreateCart).not.toHaveBeenCalled();
    expect(context.hasTriggeredRef.value).toBe(true);
  });

  it('only fires once across multiple fields once hasTriggeredRef is set', () => {
    const container = buildContainer(`
      <input data-next-checkout-field="email" />
      <input data-next-checkout-field="phone" />
    `);
    const { context, createProspectCart } = makeContext(container);

    setupFormStartTrigger(context);
    const [email, phone] = Array.from(container.querySelectorAll('input'));
    email.dispatchEvent(new Event('focus'));
    phone.dispatchEvent(new Event('focus'));

    expect(createProspectCart).toHaveBeenCalledTimes(1);
  });
});

describe('setupEmailEntryTrigger', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('warns and does nothing when there is no email field', () => {
    const container = buildContainer('<div></div>');
    const { context, logger, checkAndCreateCart } = makeContext(container, {
      emailField: undefined,
    });
    setupEmailEntryTrigger(context);
    expect(logger.warn).toHaveBeenCalledWith(
      'Cannot setup email entry trigger - email field not found'
    );
    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });

  it('debounces blur by 300ms before calling checkAndCreateCart for a complete-looking email', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="email" />'
    );
    const { context, checkAndCreateCart } = makeContext(container, {
      emailField: container.querySelector('input') as HTMLInputElement,
    });
    setupEmailEntryTrigger(context);

    const email = context.emailField as HTMLInputElement;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('blur'));

    expect(checkAndCreateCart).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(checkAndCreateCart).toHaveBeenCalledTimes(1);
  });

  /**
   * Pins finding 139's fix: every listener this module registers is tied to
   * `context.signal`, so aborting it (what `ProspectCartEnhancer.cleanupEventListeners`
   * does on destroy) removes the listener rather than leaving it to outlive whatever
   * created the context.
   */
  it('stops reacting to blur once context.signal aborts', () => {
    const controller = new AbortController();
    const container = buildContainer(
      '<input data-next-checkout-field="email" />'
    );
    const { context, checkAndCreateCart } = makeContext(container, {
      emailField: container.querySelector('input') as HTMLInputElement,
      signal: controller.signal,
    });
    setupEmailEntryTrigger(context);

    controller.abort();

    const email = context.emailField as HTMLInputElement;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(300);

    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });

  it('does not debounce a blur for an email missing a TLD', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="email" />'
    );
    const { context, checkAndCreateCart } = makeContext(container, {
      emailField: container.querySelector('input') as HTMLInputElement,
    });
    setupEmailEntryTrigger(context);

    const email = context.emailField as HTMLInputElement;
    email.value = 'user@localhost';
    email.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(300);
    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });
});

describe('setupPhoneEntryTrigger', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('warns and does nothing when there is no phone field', () => {
    const container = buildContainer('<div></div>');
    const { context, logger, checkAndCreateCart } = makeContext(container, {
      phoneField: undefined,
    });
    setupPhoneEntryTrigger(context);
    expect(logger.warn).toHaveBeenCalledWith(
      'Cannot setup phone entry trigger - phone field not found'
    );
    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });

  it('debounces a valid phone blur through the shared phoneBlurTimeoutRef', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="phone" type="tel" />'
    );
    const { context, checkAndCreateCart } = makeContext(container, {
      phoneField: container.querySelector('input') as HTMLInputElement,
      isValidPhone: () => true,
    });
    setupPhoneEntryTrigger(context);

    const phone = context.phoneField as HTMLInputElement;
    phone.value = '+15551234567';
    phone.dispatchEvent(new Event('blur'));

    expect(context.phoneBlurTimeoutRef.value).not.toBeUndefined();
    vi.advanceTimersByTime(300);
    expect(checkAndCreateCart).toHaveBeenCalledTimes(1);
  });

  it('does not schedule a check when the phone fails validation', () => {
    const container = buildContainer(
      '<input data-next-checkout-field="phone" type="tel" />'
    );
    const { context, checkAndCreateCart } = makeContext(container, {
      phoneField: container.querySelector('input') as HTMLInputElement,
      isValidPhone: () => false,
    });
    setupPhoneEntryTrigger(context);

    const phone = context.phoneField as HTMLInputElement;
    phone.value = '555';
    phone.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(300);
    expect(checkAndCreateCart).not.toHaveBeenCalled();
  });
});

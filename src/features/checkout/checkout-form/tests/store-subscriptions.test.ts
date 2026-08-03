import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from '@/core/logger';
import type { CartState } from '@/types/global';
import type { CheckoutValidator } from '../../validation/checkout-validator';
import type { CreditCardService } from '../../services/credit-card-service';
import {
  handleCartUpdate,
  handleCheckoutUpdate,
  handleConfigUpdate,
  type CheckoutUpdateContext,
  type ConfigUpdateContext,
} from '../store-subscriptions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCheckoutCtx(options: { withSubmitButton?: boolean } = {}): {
  ctx: CheckoutUpdateContext;
  setError: ReturnType<typeof vi.fn>;
  showLocationFields: ReturnType<typeof vi.fn>;
  submitButton: HTMLButtonElement | undefined;
} {
  const setError = vi.fn();
  const showLocationFields = vi.fn();
  const submitButton =
    options.withSubmitButton === false
      ? undefined
      : document.createElement('button');

  return {
    ctx: {
      validator: { setError } as unknown as CheckoutValidator,
      submitButton,
      showLocationFields,
    },
    setError,
    showLocationFields,
    submitButton,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── The checkout store ───────────────────────────────────────────────────────

describe('handleCheckoutUpdate', () => {
  it('puts errors written by anything else onto the fields', () => {
    const { ctx, setError } = createCheckoutCtx();

    handleCheckoutUpdate(ctx, {
      errors: { email: 'Enter a valid email', phone: 'Enter a phone number' },
    });

    expect(setError).toHaveBeenCalledWith('email', 'Enter a valid email');
    expect(setError).toHaveBeenCalledWith('phone', 'Enter a phone number');
  });

  /**
   * An empty error map is not "every field is correct" — it is usually a field the
   * shopper has not reached yet. Clearing here would tick every box on the form.
   */
  it('does not clear anything when the error map is empty', () => {
    const { ctx, setError } = createCheckoutCtx();

    handleCheckoutUpdate(ctx, { errors: {} });

    expect(setError).not.toHaveBeenCalled();
  });

  it('reveals the collapsed address rows once a street address exists', () => {
    const { ctx, showLocationFields } = createCheckoutCtx();

    handleCheckoutUpdate(ctx, { formData: { address1: '12 Cedar Road' } });

    expect(showLocationFields).toHaveBeenCalledTimes(1);
  });

  it('leaves the address rows alone for a whitespace-only address', () => {
    const { ctx, showLocationFields } = createCheckoutCtx();

    handleCheckoutUpdate(ctx, { formData: { address1: '   ' } });

    expect(showLocationFields).not.toHaveBeenCalled();
  });

  it('disables the submit button while an order is being placed', () => {
    const { ctx, submitButton } = createCheckoutCtx();

    handleCheckoutUpdate(ctx, { isProcessing: true });

    expect(submitButton?.disabled).toBe(true);
    expect(submitButton?.getAttribute('aria-busy')).toBe('true');
  });

  it('re-enables the submit button once processing ends', () => {
    const { ctx, submitButton } = createCheckoutCtx();

    handleCheckoutUpdate(ctx, { isProcessing: true });
    handleCheckoutUpdate(ctx, { isProcessing: false });

    expect(submitButton?.disabled).toBe(false);
    expect(submitButton?.getAttribute('aria-busy')).toBe('false');
  });

  it('survives a form whose submit button has not been scanned yet', () => {
    const { ctx } = createCheckoutCtx({ withSubmitButton: false });

    expect(() => handleCheckoutUpdate(ctx, { isProcessing: true })).not.toThrow();
  });

  /**
   * DEFECT (left as found): the "not processing" arm *enables* the submit button
   * rather than leaving it as it found it, so any `disabled` the page author set —
   * a pay button held shut until terms are accepted, for instance — is undone by the
   * first checkout-store change, which on a normal page is the shopper typing their
   * first character. The shopper can then submit a checkout the author meant to block.
   */
  it('DEFECT: re-enables a submit button the page deliberately disabled', () => {
    const { ctx, submitButton } = createCheckoutCtx();
    submitButton!.disabled = true;

    handleCheckoutUpdate(ctx, { isProcessing: false });

    expect(submitButton?.disabled).toBe(false);
  });
});

// ─── The cart store ───────────────────────────────────────────────────────────

describe('handleCartUpdate', () => {
  it('notes a cart the shopper cannot check out with', () => {
    const logger = createMockLogger();

    handleCartUpdate({ logger: logger as unknown as Logger }, {
      isEmpty: true,
    } as CartState);

    expect(logger.warn).toHaveBeenCalledWith('Cart is empty');
  });

  it('says nothing about a cart with items in it', () => {
    const logger = createMockLogger();

    handleCartUpdate({ logger: logger as unknown as Logger }, {
      isEmpty: false,
    } as CartState);

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// ─── The config store ─────────────────────────────────────────────────────────

describe('handleConfigUpdate', () => {
  function createConfigCtx(options: { alreadyBuilt?: boolean } = {}): {
    ctx: ConfigUpdateContext;
    initializeCreditCard: ReturnType<typeof vi.fn>;
    logger: ReturnType<typeof createMockLogger>;
  } {
    const logger = createMockLogger();
    const initializeCreditCard = vi.fn(async () => {});
    return {
      ctx: {
        logger: logger as unknown as Logger,
        creditCardService: options.alreadyBuilt
          ? ({} as CreditCardService)
          : undefined,
        initializeCreditCard,
      },
      initializeCreditCard,
      logger,
    };
  }

  it('builds the card fields when the Spreedly key arrives after boot', async () => {
    const { ctx, initializeCreditCard } = createConfigCtx();

    await handleConfigUpdate(ctx, {
      spreedlyEnvironmentKey: 'env_live',
      debug: true,
    });

    expect(initializeCreditCard).toHaveBeenCalledWith('env_live', true);
  });

  it('defaults debug to false when the config does not say', async () => {
    const { ctx, initializeCreditCard } = createConfigCtx();

    await handleConfigUpdate(ctx, { spreedlyEnvironmentKey: 'env_live' });

    expect(initializeCreditCard).toHaveBeenCalledWith('env_live', false);
  });

  it('does not build the card fields twice', async () => {
    const { ctx, initializeCreditCard } = createConfigCtx({
      alreadyBuilt: true,
    });

    await handleConfigUpdate(ctx, { spreedlyEnvironmentKey: 'env_live' });

    expect(initializeCreditCard).not.toHaveBeenCalled();
  });

  it('does nothing on a config with no Spreedly key', async () => {
    const { ctx, initializeCreditCard } = createConfigCtx();

    await handleConfigUpdate(ctx, { spreedlyEnvironmentKey: '' });

    expect(initializeCreditCard).not.toHaveBeenCalled();
  });

  it('logs a card set-up failure rather than leaving an unhandled rejection', async () => {
    const { ctx, initializeCreditCard, logger } = createConfigCtx();
    const failure = new Error('Spreedly script blocked');
    initializeCreditCard.mockRejectedValue(failure);

    await expect(
      handleConfigUpdate(ctx, { spreedlyEnvironmentKey: 'env_live' })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error handling config update:',
      failure
    );
  });
});

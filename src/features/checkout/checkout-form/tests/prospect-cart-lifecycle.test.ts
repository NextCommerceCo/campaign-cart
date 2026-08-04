import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from '@/core/logger';
import {
  initializeProspectCart,
  type ProspectCartLifecycleContext,
} from '../prospect-cart-lifecycle';

// Declared via `vi.hoisted` so the hoisted `vi.mock` factory and the tests share one
// spy — the pattern `contact-persistence.test.ts` uses.
const { initializeMock, constructedWith } = vi.hoisted(() => ({
  initializeMock: vi.fn(async () => {}),
  constructedWith: [] as HTMLElement[],
}));

vi.mock('../../prospect-cart/prospect-cart.enhancer', () => ({
  ProspectCartEnhancer: class {
    public constructor(element: HTMLElement) {
      constructedWith.push(element);
    }
    public initialize = initializeMock;
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCtx(): {
  ctx: ProspectCartLifecycleContext;
  form: HTMLFormElement;
  logger: ReturnType<typeof createMockLogger>;
  abort: AbortController;
} {
  const form = document.createElement('form');
  document.body.appendChild(form);
  const logger = createMockLogger();
  // The real form registers every inline-arrow listener on one abort signal, so
  // `destroy()` can drop them all. Mirrored here so the teardown case is testable.
  const abort = new AbortController();

  return {
    ctx: {
      form,
      logger: logger as unknown as Logger,
      listen: (target, type, handler) =>
        target.addEventListener(type, handler as EventListener, {
          signal: abort.signal,
        }),
    },
    form,
    logger,
    abort,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  constructedWith.length = 0;
  initializeMock.mockReset();
  initializeMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Starting it ──────────────────────────────────────────────────────────────

describe('initializeProspectCart', () => {
  it('binds the prospect cart to the form and starts it', async () => {
    const { ctx, form, logger } = createCtx();

    const enhancer = await initializeProspectCart(ctx);

    expect(enhancer).toBeDefined();
    expect(constructedWith).toEqual([form]);
    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('ProspectCartEnhancer initialized');
  });

  it('logs the cart the prospect enhancer reports creating', async () => {
    const { ctx, form, logger } = createCtx();
    await initializeProspectCart(ctx);

    form.dispatchEvent(
      new CustomEvent('next:prospect-cart-created', {
        detail: { id: 'cart_1' },
      })
    );

    expect(logger.info).toHaveBeenCalledWith('Prospect cart created', {
      id: 'cart_1',
    });
  });

  it('logs an abandoned prospect cart', async () => {
    const { ctx, form, logger } = createCtx();
    await initializeProspectCart(ctx);

    form.dispatchEvent(
      new CustomEvent('next:prospect-cart-abandoned', {
        detail: { id: 'cart_1' },
      })
    );

    expect(logger.info).toHaveBeenCalledWith('Prospect cart abandoned', {
      id: 'cart_1',
    });
  });

  it('registers its listeners on the form lifetime, not for good', async () => {
    const { ctx, form, logger, abort } = createCtx();
    await initializeProspectCart(ctx);

    abort.abort();
    form.dispatchEvent(
      new CustomEvent('next:prospect-cart-created', { detail: {} })
    );

    expect(logger.info).not.toHaveBeenCalled();
  });
});

// ─── Failing without taking the checkout with it ──────────────────────────────

describe('initializeProspectCart when the prospect cart cannot start', () => {
  it('warns and leaves the checkout working', async () => {
    const { ctx, logger } = createCtx();
    const failure = new Error('no email field');
    initializeMock.mockRejectedValue(failure);

    await expect(initializeProspectCart(ctx)).resolves.toBeDefined();

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to initialize ProspectCartEnhancer:',
      failure
    );
  });

  /**
   * The half-started instance still has to come back, because the form's `destroy()`
   * is what tears it down. Returning `undefined` on failure would leak whatever
   * listeners it managed to register before it threw.
   */
  it('still hands back the instance so destroy() can reach it', async () => {
    const { ctx } = createCtx();
    initializeMock.mockRejectedValue(new Error('no email field'));

    const enhancer = await initializeProspectCart(ctx);

    expect(enhancer).toBeDefined();
  });

  it('does not register the event logging when start-up failed', async () => {
    const { ctx, form, logger } = createCtx();
    initializeMock.mockRejectedValue(new Error('no email field'));
    await initializeProspectCart(ctx);

    form.dispatchEvent(
      new CustomEvent('next:prospect-cart-created', { detail: {} })
    );

    expect(logger.info).not.toHaveBeenCalled();
  });
});

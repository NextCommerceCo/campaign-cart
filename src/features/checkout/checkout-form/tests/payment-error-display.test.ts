import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from '@/core/logger';
import {
  displayPaymentError,
  listenForPaymentErrors,
  type PaymentErrorDisplayContext,
  type PaymentErrorListenerContext,
} from '../payment-error-display';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** The markup an author gives the SDK to write a decline into. */
function createErrorContainer(): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-next-component', 'credit-error');
  const text = document.createElement('span');
  text.setAttribute('data-next-component', 'credit-error-text');
  container.appendChild(text);
  document.body.appendChild(container);
  return container;
}

function createDisplayCtx(): {
  ctx: PaymentErrorDisplayContext;
  logger: ReturnType<typeof createMockLogger>;
  emit: ReturnType<typeof vi.fn>;
  announcing: { value: boolean };
} {
  const logger = createMockLogger();
  const emit = vi.fn();
  const announcing = { value: false };
  return {
    ctx: {
      logger: logger as unknown as Logger,
      paymentMethod: () => 'credit-card',
      announcingPaymentError: announcing,
      emit,
    },
    logger,
    emit,
    announcing,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─── Showing the message ──────────────────────────────────────────────────────

describe('displayPaymentError', () => {
  it('writes the message into the container and forces it visible', () => {
    const container = createErrorContainer();
    const { ctx } = createDisplayCtx();

    displayPaymentError(ctx, 'Your card was declined.');
    // Nothing happens until the 100 ms settle delay.
    expect(container.textContent).toBe('');

    vi.advanceTimersByTime(100);

    expect(container.textContent).toBe('Your card was declined.');
    expect(container.style.display).toBe('flex');
    expect(container.style.visibility).toBe('visible');
    expect(container.style.opacity).toBe('1');
    expect(container.classList.contains('visible')).toBe(true);
    expect(container.classList.contains('hidden')).toBe(false);
  });

  it('hides the message again after ten seconds', () => {
    const container = createErrorContainer();
    const { ctx } = createDisplayCtx();

    displayPaymentError(ctx, 'Your card was declined.');
    vi.advanceTimersByTime(100);
    expect(container.style.display).toBe('flex');

    vi.advanceTimersByTime(10000);

    expect(container.style.display).toBe('none');
    expect(container.classList.contains('visible')).toBe(false);
  });

  it('reports a page with no error container instead of failing silently', () => {
    const { ctx, logger } = createDisplayCtx();

    displayPaymentError(ctx, 'Your card was declined.');
    vi.advanceTimersByTime(100);

    expect(logger.error).toHaveBeenCalledWith(
      '[Payment Error] Could not find error container element'
    );
  });

  it('tells the rest of the page, synchronously, before the message is drawn', () => {
    createErrorContainer();
    const { ctx, emit } = createDisplayCtx();

    displayPaymentError(ctx, 'Your card was declined.');

    expect(emit).toHaveBeenCalledWith({ message: 'Your card was declined.' });
  });

  it('leaves the announcing flag down once the emit returns', () => {
    const { ctx, announcing } = createDisplayCtx();

    displayPaymentError(ctx, 'Your card was declined.');

    expect(announcing.value).toBe(false);
  });

  it('leaves the announcing flag down even if a listener throws', () => {
    const { ctx, announcing } = createDisplayCtx();
    (ctx.emit as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('a listener blew up');
    });

    expect(() => displayPaymentError(ctx, 'declined')).toThrow();
    // Without the `finally`, one throwing listener would wedge the flag up and
    // every later decline would be silently swallowed by the guard.
    expect(announcing.value).toBe(false);
  });
});

// ─── The loop that must stay shut (finding 150) ───────────────────────────────

describe('listenForPaymentErrors', () => {
  /**
   * Wires the two halves the way the form does — one shared `announcingPaymentError`
   * ref, and an `emit` that really delivers back to the listener. That is the live
   * express-decline shape: the display announces the error it is displaying.
   */
  function wireBothHalves(): {
    raise: (message: string) => void;
    displayed: string[];
    announcing: { value: boolean };
  } {
    const logger = createMockLogger();
    const announcing = { value: false };
    const displayed: string[] = [];
    let deliver: (data: { message: string }) => void = () => {};

    const displayCtx: PaymentErrorDisplayContext = {
      logger: logger as unknown as Logger,
      paymentMethod: () => 'credit-card',
      announcingPaymentError: announcing,
      emit: detail => deliver(detail),
    };

    const display = (message: string): void => {
      displayed.push(message);
      displayPaymentError(displayCtx, message);
    };

    const listenerCtx: PaymentErrorListenerContext = {
      announcingPaymentError: announcing,
      on: handler => {
        deliver = handler;
      },
      displayPaymentError: display,
    };
    listenForPaymentErrors(listenerCtx);

    return { raise: message => deliver({ message }), displayed, announcing };
  }

  it('shows an error raised elsewhere exactly once', () => {
    createErrorContainer();
    const { raise, displayed } = wireBothHalves();

    raise('Your card was declined.');

    // Two would mean the echo was displayed as well; unbounded would mean the
    // recursion of finding 150 is back.
    expect(displayed).toEqual(['Your card was declined.']);
  });

  it('shows a second, later error — the guard is not a one-shot', () => {
    createErrorContainer();
    const { raise, displayed } = wireBothHalves();

    raise('Your card was declined.');
    vi.advanceTimersByTime(10100);
    raise('Insufficient funds.');

    expect(displayed).toEqual([
      'Your card was declined.',
      'Insufficient funds.',
    ]);
  });

  it('ignores a payment error that carries no message', () => {
    const { raise, displayed } = wireBothHalves();

    raise('');

    expect(displayed).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  expandBillingForm,
  collapseBillingForm,
  type BillingAnimationContext,
} from '../billing-animation';
import type { Logger } from '@/core/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Kept as a plain object (not typed as `Logger`) so `mockLogger.warn` stays a
// `Mock` in assertions — going through `ctx.logger.warn` instead would carry
// `Logger`'s method signature and trip `@typescript-eslint/unbound-method`.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCtx(
  logger: ReturnType<typeof createMockLogger>
): BillingAnimationContext {
  return {
    inProgress: { value: false },
    timeouts: new Set(),
    listenerAbort: { value: null },
    logger: logger as unknown as Logger,
  };
}

// `requestAnimationFrame` is stubbed to run its callback synchronously. The
// module nests it three deep (double RAF, then a third inside); running each
// immediately drives the whole chain to completion within a single call to
// `expandBillingForm` / `collapseBillingForm`, so assertions don't need to wait
// for a real frame.
//
// `vi.useFakeTimers()` auto-detects and fakes `requestAnimationFrame` too (it
// exists on `global` under happy-dom), so tests that need fake timers for the
// `setTimeout` fallback must re-apply this stub *after* calling
// `vi.useFakeTimers()` — otherwise it silently reverts to sinon's fake RAF,
// which needs manual frame ticking rather than running synchronously.
function stubSyncRaf(): void {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  });
}

beforeEach(() => {
  stubSyncRaf();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─── expandBillingForm / collapseBillingForm — classes ────────────────────────

describe('expandBillingForm', () => {
  it('adds billing-form-expanded and removes billing-form-collapsed', () => {
    const ctx = createCtx(createMockLogger());
    const section = document.createElement('div');
    section.classList.add('billing-form-collapsed');

    expandBillingForm(ctx, section);

    expect(section.classList.contains('billing-form-expanded')).toBe(true);
    expect(section.classList.contains('billing-form-collapsed')).toBe(false);
  });
});

describe('collapseBillingForm', () => {
  it('adds billing-form-collapsed and removes billing-form-expanded', () => {
    const ctx = createCtx(createMockLogger());
    const section = document.createElement('div');
    section.classList.add('billing-form-expanded');

    collapseBillingForm(ctx, section);

    expect(section.classList.contains('billing-form-collapsed')).toBe(true);
    expect(section.classList.contains('billing-form-expanded')).toBe(false);
  });
});

// ─── inProgress ref ────────────────────────────────────────────────────────────

describe('inProgress ref', () => {
  it('is set true once the animation starts and false once transitionend settles it', () => {
    const ctx = createCtx(createMockLogger());
    const section = document.createElement('div');

    expandBillingForm(ctx, section);
    expect(ctx.inProgress.value).toBe(true);

    section.dispatchEvent(new Event('transitionend'));
    expect(ctx.inProgress.value).toBe(false);
  });
});

// ─── End states differ ────────────────────────────────────────────────────────

describe('end state on transitionend', () => {
  it('expand settles on height: auto, overflow: visible', () => {
    const ctx = createCtx(createMockLogger());
    const section = document.createElement('div');

    expandBillingForm(ctx, section);
    section.dispatchEvent(new Event('transitionend'));

    expect(section.style.height).toBe('auto');
    expect(section.style.overflow).toBe('visible');
  });

  it('collapse settles on height: 0px, overflow: hidden', () => {
    const ctx = createCtx(createMockLogger());
    const section = document.createElement('div');

    collapseBillingForm(ctx, section);
    section.dispatchEvent(new Event('transitionend'));

    expect(section.style.height).toBe('0px');
    expect(section.style.overflow).toBe('hidden');
  });
});

// ─── Fallback ─────────────────────────────────────────────────────────────────

describe('fallback', () => {
  it('force-completes the animation when transitionend never arrives', () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const mockLogger = createMockLogger();
    const ctx = createCtx(mockLogger);
    const section = document.createElement('div');

    expandBillingForm(ctx, section);
    vi.advanceTimersByTime(351);

    expect(section.style.height).toBe('auto');
    expect(section.style.overflow).toBe('visible');
    expect(ctx.inProgress.value).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[Billing] Expand fallback triggered - forcing completion'
    );
  });

  it('does not act if the shopper toggled away before the fallback fires', () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const mockLogger = createMockLogger();
    const ctx = createCtx(mockLogger);
    const section = document.createElement('div');

    expandBillingForm(ctx, section);
    // Shopper toggled back to collapsed by other means before the fallback
    // timer elapsed — the expected class ('billing-form-expanded') is gone.
    section.classList.remove('billing-form-expanded');
    section.classList.add('billing-form-collapsed');

    vi.advanceTimersByTime(351);

    expect(mockLogger.warn).not.toHaveBeenCalled();
    // Expand's settle() (overflow: visible) was never applied — the guard
    // blocked it, so the section is left exactly as the shopper's own toggle
    // left it, not force-settled into expand's end state.
    expect(section.style.overflow).toBe('hidden');
  });
});

// ─── Double-toggle ────────────────────────────────────────────────────────────

describe('starting a second animation', () => {
  it("clears the first animation's pending fallback timer", () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const mockLogger = createMockLogger();
    const ctx = createCtx(mockLogger);
    const section = document.createElement('div');

    expandBillingForm(ctx, section);
    expect(ctx.timeouts.size).toBe(1);
    const firstTimeout = Array.from(ctx.timeouts)[0];

    collapseBillingForm(ctx, section);
    expect(ctx.timeouts.size).toBe(1);
    expect(Array.from(ctx.timeouts)[0]).not.toBe(firstTimeout);

    // Only the collapse fallback should be able to fire — the expand one was
    // cleared, so a fast double-toggle cannot leave two fallbacks armed.
    vi.advanceTimersByTime(351);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[Billing] Collapse fallback triggered - forcing completion'
    );
  });
});

// ─── Listener lifecycle ───────────────────────────────────────────────────────
//
// These two lock in the fix for a defect found while writing the tests above:
// nothing used to remove the `transitionend` listener except the listener itself,
// on its own natural firing. So the fallback path and a fast re-toggle both left
// stale listeners attached to the section.

describe('transitionend listener lifecycle', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let section: HTMLElement;

  beforeEach(() => {
    logger = createMockLogger();
    section = document.createElement('div');
    document.body.appendChild(section);
    stubSyncRaf();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('a late transitionend after the fallback already settled does not re-run the handler', () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const ctx = createCtx(logger);

    expandBillingForm(ctx, section);
    // No transitionend — let the fallback force-complete it.
    vi.advanceTimersByTime(400);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const completeLogsAfterFallback = logger.info.mock.calls.length;

    // A browser can still deliver the transition event afterwards. It must find
    // nothing attached, or it re-settles a finished animation and logs a second
    // "Expand complete" for it.
    section.dispatchEvent(new Event('transitionend'));

    expect(logger.info.mock.calls.length).toBe(completeLogsAfterFallback);
  });

  it('a fast expand→collapse leaves only the second animation listening', () => {
    const ctx = createCtx(logger);

    expandBillingForm(ctx, section);
    // Toggled again before the first transition finished.
    collapseBillingForm(ctx, section);

    section.dispatchEvent(new Event('transitionend'));

    // One settle, not two: the expand handler must be gone. If it survived, it
    // would also run and log "Expand complete" for an animation the shopper
    // abandoned, on a section that is now collapsed.
    const messages = logger.info.mock.calls.map(call => String(call[0]));
    expect(messages).toEqual(['[Billing] Collapse complete']);
    expect(section.style.height).toBe('0px');
    expect(section.style.overflow).toBe('hidden');
  });
});

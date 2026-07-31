import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TooltipEnhancer } from '../tooltip.enhancer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// `requestAnimationFrame` is stubbed to run its callback synchronously — `show()`
// awaits one rAF before positioning. `vi.useFakeTimers()` also fakes rAF (it
// exists on `global` under happy-dom), so any test combining fake timers with
// `show()` must re-apply this stub *after* `vi.useFakeTimers()`. See
// `.claude/rules/testing.md` and the worked example in
// `src/features/checkout/checkout-form/tests/billing-animation.test.ts`.
function stubSyncRaf(): void {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  });
}

function buildElement(content = 'Hello tooltip'): HTMLElement {
  const el = document.createElement('button');
  el.setAttribute('data-next-tooltip', content);
  document.body.appendChild(el);
  return el;
}

function queryTooltip(): HTMLElement | null {
  return document.querySelector('.next-tooltip');
}

/** Flushes the microtask hops inside `show()`/`positionTooltip()` (Floating UI's
 * `computePosition` resolves over a couple of promise ticks) without letting
 * real time pass, so it composes with fake timers. */
async function flushMicrotasks(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

// `tooltip`/`arrow`/`isVisible`/`handleTouchStart` are all private on
// `TooltipEnhancer` — this is the one narrow, typed window the tests use to
// read/drive them, so assertions get real types instead of scattering
// `as any` (and the lint noise that comes with it) through every test.
interface TooltipInternals {
  isVisible: boolean;
  tooltip: HTMLElement | null;
  arrow: HTMLElement | null;
  handleTouchStart: () => void;
}

function internals(enhancer: TooltipEnhancer): TooltipInternals {
  return enhancer as unknown as TooltipInternals;
}

beforeEach(() => {
  stubSyncRaf();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

// ─── Normal paths ─────────────────────────────────────────────────────────────

describe('show on hover', () => {
  it('does not show before the configured delay elapses', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement();
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();

    el.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(499);
    await flushMicrotasks();

    expect(queryTooltip()).toBeNull();
  });

  it('shows the tooltip once the default 500ms delay elapses, reading content from the attribute', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement('Ships within 2 days');
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();

    el.dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(500);

    const tooltip = queryTooltip();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.classList.contains('next-tooltip--visible')).toBe(true);
    expect(tooltip?.querySelector('.next-tooltip__content')?.textContent).toBe(
      'Ships within 2 days'
    );
    expect(el.getAttribute('aria-describedby')).toBe(tooltip?.id);
  });

  it('honors a custom data-next-tooltip-delay', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement();
    el.setAttribute('data-next-tooltip-delay', '50');
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();

    el.dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(50);

    expect(queryTooltip()).not.toBeNull();
  });
});

describe('hide', () => {
  async function showViaHover(el: HTMLElement) {
    el.dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(500);
  }

  it('removes aria-describedby immediately and removes the node from the DOM after the fade', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement();
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();
    await showViaHover(el);
    expect(queryTooltip()).not.toBeNull();

    el.dispatchEvent(new Event('mouseleave'));
    // scheduleHide waits 150ms before hide() actually runs.
    await vi.advanceTimersByTimeAsync(150);

    // hide() has run: aria cleaned up synchronously, fade class removed.
    expect(el.getAttribute('aria-describedby')).toBeNull();
    expect(internals(enhancer).isVisible).toBe(false);
    expect(queryTooltip()?.classList.contains('next-tooltip--visible')).toBe(
      false
    );
    // Node itself is still present until the 200ms removal timer fires.
    expect(queryTooltip()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(200);
    expect(queryTooltip()).toBeNull();
  });

  it('Escape hides a visible tooltip', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement();
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();
    await showViaHover(el);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(internals(enhancer).isVisible).toBe(false);
    expect(el.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('destroy', () => {
  it('removes the tooltip node and stops responding to further hover events', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement();
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();

    el.dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(500);
    expect(queryTooltip()).not.toBeNull();

    enhancer.destroy();

    // No lingering 200ms fade node — destroy() finalizes any pending dismissal
    // synchronously rather than leaving it to the timer.
    expect(queryTooltip()).toBeNull();
    expect(el.getAttribute('aria-describedby')).toBeNull();

    // Listeners were torn down: a further hover does nothing, even after
    // advancing well past the show delay.
    el.dispatchEvent(new Event('mouseenter'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(queryTooltip()).toBeNull();
  });

  it('is safe to call when no tooltip was ever shown', async () => {
    const el = buildElement();
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();

    expect(() => enhancer.destroy()).not.toThrow();
  });
});

// ─── Regression — finding 96: rapid re-tap (touch) permanently kills the tooltip ──
//
// `handleTouchStart` toggles show/hide with no delay, unlike the hover path
// (500ms show delay, 150ms hide delay), which never lands inside the 200ms
// removal window. On touch, tap-hide-tap inside that window used to leave
// `isVisible === true` with `tooltip === null` — unrecoverable, since both
// `show()` and `hide()` early-return without ever repairing that state.

describe('regression: rapid double-tap on touch (finding 96)', () => {
  it('does not strand isVisible=true / tooltip=null when the pending dismissal fires after a re-tap remounts', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement();
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();
    const state = internals(enhancer);
    const touchStart = state.handleTouchStart;

    // Tap 1: show.
    touchStart();
    await flushMicrotasks();
    expect(state.isVisible).toBe(true);
    const firstTooltip = state.tooltip;
    expect(firstTooltip).not.toBeNull();

    // Tap 2: hide — schedules the 200ms removal of `firstTooltip`.
    touchStart();
    await flushMicrotasks();
    expect(state.isVisible).toBe(false);

    // Tap 3, still inside the 200ms removal window: show() mounts a *new*
    // tooltip while the old one's removal timer is still pending.
    vi.advanceTimersByTime(100);
    touchStart();
    await flushMicrotasks();
    expect(state.isVisible).toBe(true);
    const secondTooltip = state.tooltip;
    expect(secondTooltip).not.toBeNull();
    expect(secondTooltip).not.toBe(firstTooltip);

    // Let the rest of the original 200ms window (and then some) elapse — this
    // is when the untracked timer used to fire and null out whatever tooltip
    // was live at the time, regardless of which element it was scheduled for.
    await vi.advanceTimersByTimeAsync(200);

    // The state must stay consistent: still showing, still holding a real
    // tooltip element that is actually in the document.
    expect(state.isVisible).toBe(true);
    expect(state.tooltip).not.toBeNull();
    expect(document.body.contains(secondTooltip)).toBe(true);
    expect(secondTooltip?.classList.contains('next-tooltip--visible')).toBe(
      true
    );

    // And the tooltip must still be dismissible — the bug made hide() a
    // permanent no-op once this state was reached (`!this.tooltip` guard).
    touchStart();
    await flushMicrotasks();
    expect(state.isVisible).toBe(false);
  });

  it('a later, legitimate hide of the re-tapped tooltip still removes it (no double-removal)', async () => {
    vi.useFakeTimers();
    stubSyncRaf();
    const el = buildElement();
    const enhancer = new TooltipEnhancer(el);
    await enhancer.initialize();
    const state = internals(enhancer);
    const touchStart = state.handleTouchStart;

    touchStart(); // show A
    await flushMicrotasks();
    touchStart(); // hide A (schedules removal of A)
    await flushMicrotasks();

    vi.advanceTimersByTime(100);
    touchStart(); // show B while A's removal is still pending
    await flushMicrotasks();

    touchStart(); // hide B
    await flushMicrotasks();
    expect(state.isVisible).toBe(false);

    // Advance well past both A's original window and B's own 200ms fade.
    await vi.advanceTimersByTimeAsync(400);

    expect(queryTooltip()).toBeNull();
    expect(state.tooltip).toBeNull();
    expect(state.arrow).toBeNull();
  });
});

/**
 * Unit tests for the upsell interaction layer, focused on the quantity: one
 * number in `state.quantity`, one writer (`setQuantity`), and a selector-keyed
 * projection built on read (`quantitySnapshot`).
 *
 * `upsell.handlers` is mocked out — this file is about what the interaction
 * layer writes to state and to the DOM, not about submitting an order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  adjustQuantity,
  onQuantityChanged,
  quantityKey,
  quantitySnapshot,
  scanUpsellElements,
  setQuantity,
} from '../upsell.interaction-handlers';
import type { Mock } from 'vitest';
import type { Logger } from '@/core/logger';
import type { UpsellInteractionContext, UpsellState } from '../upsell.types';

vi.mock('../upsell.handlers', () => ({ handleActionClick: vi.fn() }));

function makeState(overrides: Partial<UpsellState> = {}): UpsellState {
  return {
    packageId: 10,
    quantity: 1,
    selectorId: undefined,
    selectedPackageId: undefined,
    options: new Map(),
    currentQuantitySelectorId: undefined,
    actionButtons: [],
    scanTeardowns: [],
    ...overrides,
  };
}

const QUANTITY_HTML = `
  <span data-next-upsell-quantity="display">1</span>
  <button data-next-upsell-quantity="decrease">-</button>
  <button data-next-upsell-quantity="increase">+</button>
  <button data-next-upsell-quantity-toggle="1">1x</button>
  <button data-next-upsell-quantity-toggle="3">3x</button>
  <button data-next-upsell-action="add">Add</button>`;

/** Only the four methods the interaction layer calls. */
function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
}

type TestCtx = UpsellInteractionContext & {
  emit: Mock<(event: string, detail: unknown) => void>;
};

function makeCtx(
  state: UpsellState = makeState(),
  html = QUANTITY_HTML
): TestCtx {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.appendChild(element);
  return {
    element,
    state,
    logger: makeLogger(),
    emit: vi.fn(),
  };
}

function displayText(ctx: UpsellInteractionContext): string | null {
  return (
    ctx.element.querySelector('[data-next-upsell-quantity="display"]')
      ?.textContent ?? null
  );
}

function click(ctx: UpsellInteractionContext, selector: string): void {
  const el = ctx.element.querySelector(selector);
  if (!el) throw new Error(`no element for ${selector}`);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─── The projection ───────────────────────────────────────────────────────────

describe('quantityKey / quantitySnapshot', () => {
  it('keys the quantity by the container selector', () => {
    const state = makeState({ selectorId: 's1', quantity: 4 });

    expect(quantityKey(state)).toBe('s1');
    expect(quantitySnapshot(state)).toEqual(new Map([['s1', 4]]));
  });

  it('prefers the selector a quantity control named', () => {
    const state = makeState({
      selectorId: 's1',
      currentQuantitySelectorId: 'qty-group',
      quantity: 2,
    });

    expect(quantityKey(state)).toBe('qty-group');
    expect(quantitySnapshot(state)).toEqual(new Map([['qty-group', 2]]));
  });

  it('is empty in direct mode, where there is no selector to key by', () => {
    expect(quantityKey(makeState())).toBeUndefined();
    expect(quantitySnapshot(makeState({ quantity: 5 })).size).toBe(0);
  });

  it('always reports the current quantity, never a stale copy', () => {
    const state = makeState({ selectorId: 's1' });
    const ctx = makeCtx(state);

    setQuantity(ctx, 6);

    expect(quantitySnapshot(state).get('s1')).toBe(6);
  });
});

// ─── The single writer ────────────────────────────────────────────────────────

describe('setQuantity', () => {
  it('writes the quantity, the display and the toggles together', () => {
    const ctx = makeCtx(makeState({ selectorId: 's1' }));

    setQuantity(ctx, 3);

    expect(ctx.state.quantity).toBe(3);
    expect(displayText(ctx)).toBe('3');
    const toggles = ctx.element.querySelectorAll(
      '[data-next-upsell-quantity-toggle]'
    );
    expect(toggles[0]?.classList.contains('next-selected')).toBe(false);
    expect(toggles[1]?.classList.contains('next-selected')).toBe(true);
  });

  it('clamps to 1', () => {
    const ctx = makeCtx();
    setQuantity(ctx, 0);
    expect(ctx.state.quantity).toBe(1);
  });

  it('clamps to 10', () => {
    const ctx = makeCtx();
    setQuantity(ctx, 25);
    expect(ctx.state.quantity).toBe(10);
  });

  it('announces the change with the selector it belongs to', () => {
    const ctx = makeCtx(makeState({ selectorId: 's1' }));

    setQuantity(ctx, 2);

    expect(ctx.emit).toHaveBeenCalledWith('upsell:quantity-changed', {
      selectorId: 's1',
      quantity: 2,
      packageId: 10,
    });
  });

  it('announces the change without a selector in direct mode', () => {
    const ctx = makeCtx();

    setQuantity(ctx, 2);

    expect(ctx.emit).toHaveBeenCalledWith('upsell:quantity-changed', {
      quantity: 2,
      packageId: 10,
    });
  });

  it('records the selector a quantity control named', () => {
    const ctx = makeCtx(makeState({ selectorId: 's1' }));

    setQuantity(ctx, 2, 'qty-group');

    expect(ctx.state.currentQuantitySelectorId).toBe('qty-group');
  });
});

describe('adjustQuantity', () => {
  it('steps up from the current quantity in selector mode', () => {
    const ctx = makeCtx(makeState({ selectorId: 's1', quantity: 3 }));

    adjustQuantity(1, 's1', ctx);

    expect(ctx.state.quantity).toBe(4);
    expect(displayText(ctx)).toBe('4');
  });

  it('steps up from the current quantity in direct mode', () => {
    const ctx = makeCtx(makeState({ quantity: 3 }));

    adjustQuantity(1, undefined, ctx);

    expect(ctx.state.quantity).toBe(4);
    expect(displayText(ctx)).toBe('4');
  });

  it('will not step below 1', () => {
    const ctx = makeCtx(makeState({ quantity: 1 }));

    adjustQuantity(-1, undefined, ctx);

    expect(ctx.state.quantity).toBe(1);
  });
});

// ─── Re-scanning ──────────────────────────────────────────────────────────────

describe('scanUpsellElements', () => {
  it('paints the current quantity onto the widgets', () => {
    const ctx = makeCtx(makeState({ selectorId: 's1', quantity: 3 }));

    scanUpsellElements(ctx);

    expect(displayText(ctx)).toBe('3');
  });

  it('replaces the action buttons instead of appending them', () => {
    const ctx = makeCtx();

    scanUpsellElements(ctx);
    scanUpsellElements(ctx);

    expect(ctx.state.actionButtons).toHaveLength(1);
  });

  it('keeps one quantity step per press after a re-scan', () => {
    const ctx = makeCtx();

    scanUpsellElements(ctx);
    scanUpsellElements(ctx);
    click(ctx, '[data-next-upsell-quantity="increase"]');

    expect(ctx.state.quantity).toBe(2);
  });

  it('keeps one toggle write per press after a re-scan', () => {
    const ctx = makeCtx();

    scanUpsellElements(ctx);
    scanUpsellElements(ctx);
    click(ctx, '[data-next-upsell-quantity-toggle="3"]');

    expect(ctx.state.quantity).toBe(3);
    expect(ctx.emit).toHaveBeenCalledTimes(1);
  });

  it('leaves a teardown for every listener it attached', () => {
    const ctx = makeCtx();

    scanUpsellElements(ctx);
    ctx.state.scanTeardowns.forEach(off => off());
    click(ctx, '[data-next-upsell-quantity="increase"]');

    expect(ctx.state.quantity).toBe(1);
  });
});

// ─── Cross-container sync ─────────────────────────────────────────────────────

describe('onQuantityChanged', () => {
  it('adopts a quantity announced for the same selector', () => {
    const ctx = makeCtx(makeState({ selectorId: 's1' }));

    onQuantityChanged({ selectorId: 's1', quantity: 4, packageId: 10 }, ctx);

    expect(ctx.state.quantity).toBe(4);
    expect(displayText(ctx)).toBe('4');
  });

  it('ignores a quantity announced for another selector', () => {
    const ctx = makeCtx(makeState({ selectorId: 's1', quantity: 2 }));

    onQuantityChanged({ selectorId: 's2', quantity: 9, packageId: 10 }, ctx);

    expect(ctx.state.quantity).toBe(2);
  });

  it('adopts a quantity announced for the same package in direct mode', () => {
    const ctx = makeCtx(makeState({ packageId: 10 }));

    onQuantityChanged({ quantity: 4, packageId: 10 }, ctx);

    expect(ctx.state.quantity).toBe(4);
    expect(displayText(ctx)).toBe('4');
  });

  it('ignores a quantity announced for another package in direct mode', () => {
    const ctx = makeCtx(makeState({ packageId: 10, quantity: 2 }));

    onQuantityChanged({ quantity: 9, packageId: 99 }, ctx);

    expect(ctx.state.quantity).toBe(2);
  });
});

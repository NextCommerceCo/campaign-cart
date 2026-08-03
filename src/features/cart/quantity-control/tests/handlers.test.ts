import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleClick,
  handleQuantityChange,
  handleNumberInput,
} from '../quantity-control.handlers';
import type { HandlerContext } from '../quantity-control.types';
import { useCartStore } from '@/state/cart';

vi.mock('@/state/cart', () => {
  const getState = vi.fn();
  // cartOperations delegate to the store methods on getState(), so a single
  // mocked state object drives both getItemQuantity and the mutations.
  const op = (m: string) => (...args: any[]) => getState()?.[m]?.(...args);
  return {
    useCartStore: { getState },
    cartOperations: {
      addItem: op('addItem'),
      removeItem: op('removeItem'),
      updateQuantity: op('updateQuantity'),
    },
  };
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockCartState(overrides: Record<string, any> = {}) {
  const state = {
    getItemQuantity: vi.fn().mockReturnValue(2),
    updateQuantity: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  (useCartStore.getState as any).mockReturnValue(state);
  return state;
}

function makeContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return {
    packageId: 42,
    action: 'increase',
    constraints: { min: 1, max: 5, step: 1 },
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any,
    setProcessing: vi.fn(),
    emitQuantityChanged: vi.fn(),
    ...overrides,
  };
}

function clickEvent(el: HTMLElement): Event {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: el,
  } as unknown as Event;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── handleClick / performQuantityUpdate ──────────────────────────────────────

describe('handleClick', () => {
  it('increases quantity by step and emits the change', async () => {
    const state = mockCartState({ getItemQuantity: vi.fn().mockReturnValue(2) });
    const ctx = makeContext({ action: 'increase' });
    await handleClick(clickEvent(document.createElement('button')), ctx);

    expect(state.updateQuantity).toHaveBeenCalledWith(42, 3);
    expect(ctx.emitQuantityChanged).toHaveBeenCalledWith(2, 3);
    expect(ctx.setProcessing).toHaveBeenNthCalledWith(1, true);
    expect(ctx.setProcessing).toHaveBeenLastCalledWith(false);
  });

  it('clamps increase at max', async () => {
    const state = mockCartState({ getItemQuantity: vi.fn().mockReturnValue(5) });
    const ctx = makeContext({ action: 'increase' });
    await handleClick(clickEvent(document.createElement('button')), ctx);
    // already at max → no change, no cart write, no emit
    expect(state.updateQuantity).not.toHaveBeenCalled();
    expect(ctx.emitQuantityChanged).not.toHaveBeenCalled();
  });

  it('removes the item when decrease reaches zero', async () => {
    const state = mockCartState({ getItemQuantity: vi.fn().mockReturnValue(1) });
    const ctx = makeContext({
      action: 'decrease',
      constraints: { min: 0, max: 5, step: 1 },
    });
    await handleClick(clickEvent(document.createElement('button')), ctx);
    expect(state.removeItem).toHaveBeenCalledWith(42);
    expect(ctx.emitQuantityChanged).toHaveBeenCalledWith(1, 0);
  });

  it('ignores clicks on a disabled element', async () => {
    const state = mockCartState();
    const ctx = makeContext();
    const el = document.createElement('button');
    el.classList.add('disabled');
    await handleClick(clickEvent(el), ctx);
    expect(state.updateQuantity).not.toHaveBeenCalled();
    expect(ctx.setProcessing).not.toHaveBeenCalled();
  });
});

// ─── handleQuantityChange ─────────────────────────────────────────────────────

describe('handleQuantityChange', () => {
  function changeEvent(value: string) {
    const input = document.createElement('input');
    input.value = value;
    return { event: { target: input } as unknown as Event, input };
  }

  it('updates quantity for a valid value and emits the change', async () => {
    const state = mockCartState({ getItemQuantity: vi.fn().mockReturnValue(1) });
    const ctx = makeContext({ action: 'set' });
    const { event } = changeEvent('4');
    await handleQuantityChange(event, ctx);
    expect(state.updateQuantity).toHaveBeenCalledWith(42, 4);
    expect(ctx.emitQuantityChanged).toHaveBeenCalledWith(1, 4);
  });

  it('removes the item when the value is zero', async () => {
    const state = mockCartState({ getItemQuantity: vi.fn().mockReturnValue(2) });
    const ctx = makeContext({ action: 'set', constraints: { min: 0, max: 5, step: 1 } });
    const { event } = changeEvent('0');
    await handleQuantityChange(event, ctx);
    expect(state.removeItem).toHaveBeenCalledWith(42);
  });

  it('resets to min and does nothing for a below-min value', async () => {
    const state = mockCartState();
    const ctx = makeContext({ action: 'set' });
    const { event, input } = changeEvent('0');
    await handleQuantityChange(event, ctx);
    expect(input.value).toBe('1');
    expect(state.updateQuantity).not.toHaveBeenCalled();
  });

  it('clamps an above-max value to max and does nothing', async () => {
    const state = mockCartState();
    const ctx = makeContext({ action: 'set' });
    const { event, input } = changeEvent('99');
    await handleQuantityChange(event, ctx);
    expect(input.value).toBe('5');
    expect(state.updateQuantity).not.toHaveBeenCalled();
  });

  it('restores the current quantity and rethrows when the update fails', async () => {
    const state = mockCartState({
      getItemQuantity: vi.fn().mockReturnValue(2),
      updateQuantity: vi.fn().mockRejectedValue(new Error('network')),
    });
    const ctx = makeContext({ action: 'set' });
    const { event, input } = changeEvent('4');
    await expect(handleQuantityChange(event, ctx)).rejects.toThrow('network');
    expect(input.value).toBe('2');
    expect(ctx.setProcessing).toHaveBeenLastCalledWith(false);
    void state;
  });
});

// ─── handleNumberInput ────────────────────────────────────────────────────────

describe('handleNumberInput', () => {
  const constraints = { min: 1, max: 5, step: 1 };

  it('clamps a below-min value up to min', () => {
    const input = document.createElement('input');
    input.value = '0';
    handleNumberInput({ target: input } as unknown as Event, constraints);
    expect(input.value).toBe('1');
  });

  it('clamps an above-max value down to max', () => {
    const input = document.createElement('input');
    input.value = '9';
    handleNumberInput({ target: input } as unknown as Event, constraints);
    expect(input.value).toBe('5');
  });

  it('leaves an in-range value unchanged', () => {
    const input = document.createElement('input');
    input.value = '3';
    handleNumberInput({ target: input } as unknown as Event, constraints);
    expect(input.value).toBe('3');
  });
});

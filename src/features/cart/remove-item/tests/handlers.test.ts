import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleClick } from '../remove-item.handlers';
import type { HandlerContext } from '../remove-item.types';
import { useCartStore } from '@/state/cart';

vi.mock('@/state/cart', () => {
  const getState = vi.fn();
  const op = (m: string) => (...args: any[]) => getState()?.[m]?.(...args);
  return {
    useCartStore: { getState },
    cartOperations: { removeItem: op('removeItem') },
  };
});

function mockCartState(quantity: number) {
  const state = {
    getItemQuantity: vi.fn().mockReturnValue(quantity),
    removeItem: vi.fn().mockResolvedValue(undefined),
  };
  (useCartStore.getState as any).mockReturnValue(state);
  return state;
}

function makeContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return {
    packageId: 42,
    confirmRemoval: false,
    confirmMessage: 'Remove this item?',
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any,
    setProcessing: vi.fn(),
    emitRemoved: vi.fn(),
    renderFeedback: vi.fn(),
    ...overrides,
  };
}

function clickEvent(el: HTMLElement): Event {
  return { preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: el } as unknown as Event;
}

beforeEach(() => vi.clearAllMocks());

describe('handleClick', () => {
  it('removes an item that is in the cart and reports it', async () => {
    const state = mockCartState(2);
    const ctx = makeContext();
    await handleClick(clickEvent(document.createElement('button')), ctx);
    expect(state.removeItem).toHaveBeenCalledWith(42);
    expect(ctx.emitRemoved).toHaveBeenCalledWith(42);
    expect(ctx.renderFeedback).toHaveBeenCalled();
    expect(ctx.setProcessing).toHaveBeenNthCalledWith(1, true);
    expect(ctx.setProcessing).toHaveBeenLastCalledWith(false);
  });

  it('does nothing when the item is not in the cart', async () => {
    const state = mockCartState(0);
    const ctx = makeContext();
    await handleClick(clickEvent(document.createElement('button')), ctx);
    expect(state.removeItem).not.toHaveBeenCalled();
    expect(ctx.emitRemoved).not.toHaveBeenCalled();
    expect(ctx.renderFeedback).not.toHaveBeenCalled();
  });

  it('ignores clicks on a disabled element', async () => {
    const state = mockCartState(2);
    const ctx = makeContext();
    const el = document.createElement('button');
    el.setAttribute('disabled', '');
    await handleClick(clickEvent(el), ctx);
    expect(state.removeItem).not.toHaveBeenCalled();
    expect(ctx.setProcessing).not.toHaveBeenCalled();
  });

  describe('confirmation', () => {
    let confirmSpy: any;
    beforeEach(() => {
      confirmSpy = vi.fn();
      vi.stubGlobal('confirm', confirmSpy);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('removes when the user confirms', async () => {
      confirmSpy.mockReturnValue(true);
      const state = mockCartState(1);
      const ctx = makeContext({ confirmRemoval: true });
      await handleClick(clickEvent(document.createElement('button')), ctx);
      expect(confirmSpy).toHaveBeenCalledWith('Remove this item?');
      expect(state.removeItem).toHaveBeenCalledWith(42);
    });

    it('aborts when the user cancels', async () => {
      confirmSpy.mockReturnValue(false);
      const state = mockCartState(1);
      const ctx = makeContext({ confirmRemoval: true });
      await handleClick(clickEvent(document.createElement('button')), ctx);
      expect(state.removeItem).not.toHaveBeenCalled();
      expect(ctx.setProcessing).not.toHaveBeenCalled();
    });
  });
});

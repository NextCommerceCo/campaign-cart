import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CouponEnhancer } from '../coupon.enhancer';
import { cartOperations, useCartStore } from '@/state/cart';

/**
 * Teardown proof for the four listeners this enhancer puts on author-supplied DOM
 * (finding 169 in `docs/code-findings.md`). All four used to be inline arrows, which
 * `removeEventListener` can never be handed back, so they outlived `destroy()`.
 *
 * The visible symptom is the **remove** button on a rendered coupon card:
 * `removeCoupon()` does not guard on the enhancer's element refs, so a destroyed
 * coupon field went on removing coupons from a live cart. The apply/input/keypress
 * three were inert after `destroy()` for a different reason — `destroy()` nulls
 * `this.input`/`this.button` and every one of those paths starts with a null check —
 * but they stayed attached to the page, which is why re-enhancing the same field
 * stacked another generation on top.
 */

function mount(): {
  element: HTMLElement;
  input: HTMLInputElement;
  button: HTMLButtonElement;
} {
  const element = document.createElement('div');
  element.setAttribute('data-next-coupon', '');
  element.innerHTML = `
    <input type="text" data-next-coupon="input">
    <button data-next-coupon="apply">Apply</button>
    <div data-next-coupon="display">
      <div pb-checkout="coupon-card">
        <span pb-checkout="coupon-title"></span>
        <button pb-checkout="coupon-remove">x</button>
      </div>
    </div>
  `;
  document.body.appendChild(element);
  return {
    element,
    input: element.querySelector('input') as HTMLInputElement,
    button: element.querySelector('button') as HTMLButtonElement,
  };
}

describe('CouponEnhancer teardown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useCartStore.setState({ vouchers: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('stops removing coupons once destroyed', async () => {
    const removeSpy = vi
      .spyOn(cartOperations, 'removeCoupon')
      .mockResolvedValue(undefined);
    vi.spyOn(useCartStore.getState(), 'getCoupons').mockReturnValue(['SAVE10']);

    const { element } = mount();
    const enhancer = new CouponEnhancer(element);
    await enhancer.initialize();

    const removeBtn = element.querySelector<HTMLElement>(
      '[pb-checkout="coupon-card"]:not([data-template]) [pb-checkout="coupon-remove"]'
    );
    expect(removeBtn, 'a coupon card should have been rendered').not.toBeNull();

    enhancer.destroy();
    removeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('drops the input, keypress and apply listeners on destroy', async () => {
    const { element, input, button } = mount();

    // Records the options every registration was made with, so the assertion is about
    // the listener's removability rather than about a side effect the null-out already
    // suppresses.
    const optionsFor = new Map<string, AddEventListenerOptions>();
    for (const [target, types] of [
      [input, ['input', 'keypress']],
      [button, ['click']],
    ] as const) {
      const original = target.addEventListener.bind(target);
      vi.spyOn(target, 'addEventListener').mockImplementation(
        (
          type: string,
          handler: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions
        ) => {
          if ((types as readonly string[]).includes(type)) {
            optionsFor.set(type, (options ?? {}) as AddEventListenerOptions);
          }
          original(type, handler, options);
        }
      );
    }

    const enhancer = new CouponEnhancer(element);
    await enhancer.initialize();
    enhancer.destroy();

    for (const type of ['input', 'keypress', 'click']) {
      expect(
        optionsFor.get(type)?.signal?.aborted,
        `the ${type} listener must be registered with an abort signal that destroy() fires`
      ).toBe(true);
    }
  });
});

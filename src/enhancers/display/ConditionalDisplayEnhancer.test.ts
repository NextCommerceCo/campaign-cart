import { describe, expect, it, beforeEach } from 'vitest';
import { ConditionalDisplayEnhancer } from './ConditionalDisplayEnhancer';
import { useCartStore } from '@/stores/cartStore';

describe('ConditionalDisplayEnhancer coupon conditions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useCartStore.setState({ vouchers: [] });
  });

  it('shows elements when cart.hasCoupon matches the active coupon code', async () => {
    useCartStore.setState({ vouchers: ['FREESHIP'] });
    const element = document.createElement('div');
    element.setAttribute('data-next-show', 'cart.hasCoupon("FREESHIP")');
    document.body.appendChild(element);

    const enhancer = new ConditionalDisplayEnhancer(element);
    await enhancer.initialize();

    expect(element.style.display).toBe('');
    expect(element.classList.contains('next-visible')).toBe(true);
  });

  it('hides elements when cart.hasCoupon targets a different coupon code', async () => {
    useCartStore.setState({ vouchers: ['SAVE10'] });
    const element = document.createElement('div');
    element.setAttribute('data-next-show', 'cart.hasCoupon("FREESHIP")');
    document.body.appendChild(element);

    const enhancer = new ConditionalDisplayEnhancer(element);
    await enhancer.initialize();

    expect(element.style.display).toBe('none');
    expect(element.classList.contains('next-hidden')).toBe(true);
  });
});

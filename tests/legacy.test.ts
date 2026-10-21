import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../src/core';
import { fakeApi } from './fixtures/api';
import { campaign } from './fixtures/campaign';
import { flush } from './fixtures/engine';

const config = { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: '', debug: false, reset: false };

beforeEach(() => {
  vi.stubGlobal('fetch', fakeApi().fetch);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  sessionStorage.clear();
  localStorage.clear();
});

describe('getCartData (0.4.x shape)', () => {
  it('lists lines with packageId the way the variant picker reads them', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    await next.addItem({ packageId: 2, quantity: 1 });
    const data = next.getCartData();
    expect(data.cartLines).toEqual([
      {
        packageId: 2,
        quantity: 1,
        name: 'Earbuds ×2',
        image: 'https://cdn.test/2.png',
        price: '89.00',
        total: '89.00',
      },
    ]);
    expect(data.items).toBe(data.cartLines);
    expect(data.cartTotals.total).toBe('89.00');
  });
});

describe('shipping methods (shop-three-step page script)', () => {
  it('lists, sets and reads the shipping method', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    expect(next.getShippingMethods()).toEqual(campaign.shipping_methods);
    await next.setShippingMethod(1);
    expect(next.getState().cart.shippingId).toBe(1);
    expect(next.getSelectedShippingMethod()).toEqual(campaign.shipping_methods[0]);
  });
});

describe('exitIntent', () => {
  const leave = () => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null }));

  it('shows an image popup on exit, runs the action on click, and only once per session', async () => {
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const action = vi.fn(() => next.applyCoupon('EXIT10'));
    const shown = vi.fn();
    next.on('exit-intent:shown' as never, shown);
    await next.exitIntent({ image: 'https://cdn.test/exit.png', action, showCloseButton: true });

    leave();
    expect(shown).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.exit-intent-overlay')).not.toBeNull();
    expect(document.querySelector('.exit-intent-close')).not.toBeNull();

    document.querySelector<HTMLElement>('.exit-intent-popup img')!.click();
    await flush();
    expect(action).toHaveBeenCalledTimes(1);
    expect(next.getState().cart.coupons).toEqual(['EXIT10']);
    expect(document.querySelector('.exit-intent-popup')).toBeNull();

    leave();
    expect(shown).toHaveBeenCalledTimes(1);
  });

  it('runs template buttons and closes on Escape', async () => {
    document.body.innerHTML = `<template data-template="exit-intent">
      <div class="exit-intent-popup__dialog"><button data-exit-intent-action="apply-coupon" data-coupon-code="EXIT10">Apply</button></div></template>`;
    const next = boot(config, Promise.resolve(campaign));
    await flush();
    const actions = vi.fn();
    next.on('exit-intent:action' as never, actions);
    await next.exitIntent({ template: 'exit-intent', maxTriggers: 2 });

    leave();
    document.querySelector<HTMLElement>('[data-exit-intent-action]')!.click();
    await flush();
    expect(next.getState().cart.coupons).toEqual(['EXIT10']);
    expect(actions).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'apply-coupon', couponCode: 'EXIT10' }),
      expect.anything(),
    );

    leave();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
  });

  it('stays off on touch devices by default', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const next = boot(config, Promise.resolve(campaign));
    await next.exitIntent({ image: 'https://cdn.test/exit.png' });
    leave();
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
  });
});

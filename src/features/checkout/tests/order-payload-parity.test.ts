/**
 * One order payload, not two.
 *
 * The normal checkout submit (`CheckoutFormEnhancer.createOrder`) and the
 * express/`OrderManager` path (`OrderBuilder.buildOrder`) must assemble the
 * *same* `CreateOrder` from the same stores. They used to be two hand-written
 * copies that disagreed about `shipping_method` and about Klarna, so these tests
 * pin the payload the live submit path actually sends to the API.
 *
 * The enhancer is exercised through its prototype rather than a real DOM boot:
 * `createOrder` reads only the stores, the injected api client and the logger,
 * which is exactly the surface under test here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { CheckoutFormEnhancer } from '@/features/checkout/checkout-form/checkout-form.enhancer';
import { OrderBuilder } from '@/features/checkout/builders/order-builder';
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';
import { useCartStore } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';
import { useAttributionStore } from '@/state/attribution';
import type { CreateOrder } from '@/types/api';
import type { CartItem, ShippingMethod } from '@/types/global';
import type { Campaign } from '@/types/campaign';

// ─── Harness ──────────────────────────────────────────────────────────────────

/** The slice of the enhancer these tests drive. */
interface OrderPaths {
  apiClient: { createOrder: (data: CreateOrder) => Promise<unknown> };
  logger: Record<
    'debug' | 'info' | 'warn' | 'error',
    (...args: unknown[]) => void
  >;
  createOrder(): Promise<unknown>;
  createTestOrder(): Promise<unknown>;
}

interface SubmitHarness {
  enhancer: OrderPaths;
  submitted: () => CreateOrder;
}

/**
 * A `CheckoutFormEnhancer` with just enough wired up to run the order methods
 * the live submit path calls.
 */
function makeSubmitHarness(): SubmitHarness {
  const createOrderSpy = vi.fn((_data: CreateOrder) =>
    Promise.resolve({
      ref_id: 'ref_123',
      number: 'N-1',
      total_incl_tax: '10.00',
    })
  );

  const enhancer = Object.create(CheckoutFormEnhancer.prototype) as OrderPaths;
  enhancer.apiClient = { createOrder: createOrderSpy };
  enhancer.logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    enhancer,
    submitted: () => {
      const call = createOrderSpy.mock.calls[0];
      if (!call) throw new Error('the API was never called');
      return call[0];
    },
  };
}

/** Run the live submit path and return the payload it handed to the API. */
async function buildViaSubmitPath(): Promise<CreateOrder> {
  const { enhancer, submitted } = makeSubmitHarness();
  await enhancer.createOrder();
  return submitted();
}

/** Run the express/`OrderManager` path over the same store state. */
function buildViaOrderBuilder(): CreateOrder {
  const checkout = useCheckoutStore.getState();
  const cart = useCartStore.getState();
  return new OrderBuilder().buildOrder(
    checkout.formData,
    cart.items,
    checkout.paymentMethod,
    checkout.paymentToken,
    checkout.billingAddress,
    checkout.sameAsShipping,
    undefined,
    checkout.vouchers
  );
}

const formData = {
  email: 'buyer@example.com',
  fname: 'Test',
  lname: 'User',
  address1: '123 Main St',
  address2: 'Apt 4',
  city: 'Springfield',
  province: 'AZ',
  postal: '85281',
  country: 'US',
  phone: '+14807581224',
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
//
// Both builders read only `packageId`/`quantity`/`is_upsell`/`properties` off a
// cart line, only `id` off a shipping method, and only `shipping_methods` off
// the campaign — but the stores are typed with the full `CartItem`, `Campaign`
// and `ShippingMethod`, so the fixtures are built complete rather than cast.

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    packageId: 42,
    quantity: 1,
    price: 10,
    image: undefined,
    title: 'Test Package',
    sku: undefined,
    is_upsell: false,
    ...overrides,
  };
}

function cartShippingMethod(overrides: Partial<ShippingMethod> = {}): ShippingMethod {
  return {
    id: 1,
    name: 'Standard',
    code: 'standard',
    originalPrice: new Decimal(0),
    price: new Decimal(0),
    discountAmount: new Decimal(0),
    discountPercentage: new Decimal(0),
    hasDiscounts: false,
    ...overrides,
  };
}

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    currency: 'USD',
    language: 'en',
    name: 'Test Campaign',
    packages: [],
    payment_env_key: 'test_env_key',
    shipping_methods: [],
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useAttributionStore.getState().reset();

  useConfigStore.setState(state => ({ ...state, selectedCurrency: 'USD' }));

  // The campaign offers a first shipping method that is deliberately NOT id 1.
  useCampaignStore.setState(state => ({
    ...state,
    currency: 'USD',
    data: campaign({
      shipping_methods: [
        { ref_id: 7, code: 'standard', price: '0.00' },
        { ref_id: 9, code: 'express', price: '9.99' },
      ],
    }),
  }));

  // Neither store holds a shipping method — the fallback is what is under test.
  useCartStore.setState(state => ({
    ...state,
    items: [cartItem({ packageId: 42, quantity: 2, is_upsell: false })],
    shippingMethod: undefined,
  }));

  useCheckoutStore.setState(state => ({
    ...state,
    formData,
    paymentMethod: 'credit-card',
    paymentToken: 'tok_live_123',
    sameAsShipping: true,
    billingAddress: undefined,
    shippingMethod: undefined,
    vouchers: [],
  }));
});

afterEach(() => {
  document.head.innerHTML = '';
});

// ─── shipping_method parity ───────────────────────────────────────────────────

describe('shipping_method — both paths resolve it the same way', () => {
  it('falls back to the campaign first shipping method, not hardcoded 1', async () => {
    const submitted = await buildViaSubmitPath();

    expect(submitted.shipping_method).toBe(7);
  });

  it('agrees with the express/OrderManager path on the same stores', async () => {
    const submitted = await buildViaSubmitPath();

    expect(submitted.shipping_method).toBe(
      buildViaOrderBuilder().shipping_method
    );
  });

  it('prefers the cart store over the checkout store on both paths', async () => {
    useCartStore.setState(state => ({
      ...state,
      shippingMethod: cartShippingMethod({ id: 3, name: 'Cart', code: 'cart' }),
    }));
    useCheckoutStore.setState(state => ({
      ...state,
      shippingMethod: { id: 5, name: 'Checkout', price: 0, code: 'checkout' },
    }));

    const submitted = await buildViaSubmitPath();

    expect(submitted.shipping_method).toBe(3);
    expect(submitted.shipping_method).toBe(
      buildViaOrderBuilder().shipping_method
    );
  });

  it('still falls back to 1 when the campaign lists no shipping methods', async () => {
    useCampaignStore.setState(state => ({
      ...state,
      data: campaign({ shipping_methods: [] }),
    }));

    const submitted = await buildViaSubmitPath();

    expect(submitted.shipping_method).toBe(1);
  });
});

// ─── payment_detail parity ────────────────────────────────────────────────────

const paymentCases: Array<[CheckoutState['paymentMethod'], string]> = [
  ['credit-card', 'card_token'],
  ['card_token', 'card_token'],
  ['paypal', 'paypal'],
  ['apple_pay', 'apple_pay'],
  ['google_pay', 'google_pay'],
  ['klarna', 'klarna'],
];

describe('payment_detail — unchanged for every payment method', () => {
  it.each(paymentCases)(
    'maps %s to %s on the submit path',
    async (selected, expected) => {
      useCheckoutStore.setState(state => ({
        ...state,
        paymentMethod: selected,
      }));

      const submitted = await buildViaSubmitPath();

      expect(submitted.payment_detail.payment_method).toBe(expected);
    }
  );

  it.each(paymentCases)(
    'maps %s to %s identically on the OrderBuilder path',
    (selected, expected) => {
      useCheckoutStore.setState(state => ({
        ...state,
        paymentMethod: selected,
      }));

      expect(buildViaOrderBuilder().payment_detail.payment_method).toBe(
        expected
      );
    }
  );

  it('carries the card token through on both paths', async () => {
    const submitted = await buildViaSubmitPath();

    expect(submitted.payment_detail.card_token).toBe('tok_live_123');
    expect(buildViaOrderBuilder().payment_detail.card_token).toBe(
      'tok_live_123'
    );
  });
});

// ─── whole-payload parity ─────────────────────────────────────────────────────

describe('the rest of the payload', () => {
  it('is identical between the submit path and the OrderBuilder path', async () => {
    const submitted = await buildViaSubmitPath();

    expect(submitted).toEqual(buildViaOrderBuilder());
  });

  it('is identical with a separate billing address', async () => {
    useCheckoutStore.setState(state => ({
      ...state,
      sameAsShipping: false,
      billingAddress: {
        first_name: 'Bill',
        last_name: 'Payer',
        address1: '9 Billing Way',
        address2: 'Suite 2',
        city: 'Tempe',
        province: 'AZ',
        postal: '85282',
        country: 'US',
        phone: '+14805551212',
      },
    }));

    const submitted = await buildViaSubmitPath();

    expect(submitted).toEqual(buildViaOrderBuilder());
  });

  it('is identical with vouchers and line properties', async () => {
    useCartStore.setState(state => ({
      ...state,
      items: [
        cartItem({
          packageId: 42,
          quantity: 1,
          is_upsell: false,
          properties: { c: 'red' },
        }),
      ],
    }));
    useCheckoutStore.setState(state => ({ ...state, vouchers: ['SAVE10'] }));

    const submitted = await buildViaSubmitPath();

    expect(submitted).toEqual(buildViaOrderBuilder());
  });
});

// ─── the test order (konami-code debug path) ──────────────────────────────────

describe('the test order', () => {
  it('is built by the same OrderBuilder, so it resolves shipping the same way', async () => {
    const { enhancer, submitted } = makeSubmitHarness();

    await enhancer.createTestOrder();
    const payload = submitted();

    expect(payload.shipping_method).toBe(7);
    expect(payload.payment_detail).toEqual({
      payment_method: 'card_token',
      card_token: 'test_card',
    });

    const { attribution } = payload;
    if (!attribution) throw new Error('expected attribution to be set on the test order');
    expect(attribution.utm_source).toBe('konami_code');
    expect(attribution.metadata?.test_order).toBe(true);
  });
});

// ─── success_url / payment_failed_url ─────────────────────────────────────────

describe('success_url and payment_failed_url', () => {
  it('keeps an absolute meta URL as-is', async () => {
    document.head.innerHTML =
      '<meta name="next-success-url" content="https://shop.example.com/thanks">';

    const submitted = await buildViaSubmitPath();

    expect(submitted.success_url).toBe('https://shop.example.com/thanks');
  });

  it('makes a root-relative meta URL absolute', async () => {
    document.head.innerHTML =
      '<meta name="next-success-url" content="/thanks">';

    const submitted = await buildViaSubmitPath();

    expect(submitted.success_url).toBe(window.location.origin + '/thanks');
  });

  it('makes a slash-less relative meta URL absolute too', async () => {
    document.head.innerHTML = '<meta name="next-success-url" content="thanks">';

    const submitted = await buildViaSubmitPath();

    expect(submitted.success_url).toBe(window.location.origin + '/thanks');
    expect(submitted.success_url).toBe(buildViaOrderBuilder().success_url);
  });
});

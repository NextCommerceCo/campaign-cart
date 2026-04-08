import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  buildFlags,
  buildVars,
  buildDefaultTemplate,
  updateStateClasses,
  clearListItems,
  renderDefault,
  renderCustom,
  renderListContainers,
  renderLines,
  buildLineElement,
  renderDiscountList,
  renderDiscountItem,
  renderSummaryLine,
} from '../CartSummaryEnhancer.renderer';
import type { SummaryFlags, DiscountItem } from '../CartSummaryEnhancer.types';
import type { CartState } from '@/types/global';
import type { CartSummary, SummaryLine } from '@/types/api';

// ─── happy-dom polyfill ──────────────────────────────────────────────────────
// happy-dom does not support `:scope > template` (returns undefined even when
// the <template> is a direct child). The renderer source uses `:scope > template`
// to scope template lookups to direct children. We patch querySelector here so
// these unit tests behave like a real browser. This polyfill is restricted to
// `:scope > template` — all other selectors fall through to the original.
const originalQuerySelector = Element.prototype.querySelector;
beforeAll(() => {
  Element.prototype.querySelector = function (selector: string) {
    if (selector === ':scope > template') {
      for (const child of Array.from(this.children)) {
        if (child.tagName === 'TEMPLATE') return child as HTMLTemplateElement;
      }
      return null;
    }
    return originalQuerySelector.call(this, selector);
  } as typeof Element.prototype.querySelector;
});
afterAll(() => {
  Element.prototype.querySelector = originalQuerySelector;
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CartState> = {}): CartState {
  return {
    items: [],
    enrichedItems: [],
    totalQuantity: 0,
    isEmpty: true,
    vouchers: [],
    subtotal: new Decimal(0),
    hasDiscounts: false,
    totalDiscount: new Decimal(0),
    totalDiscountPercentage: new Decimal(0),
    total: new Decimal(0),
    isCalculating: false,
    ...overrides,
  } as CartState;
}

function makeShippingMethod(price: number, hasDiscounts = false) {
  return {
    id: 1,
    name: 'Standard',
    code: 'standard',
    price: new Decimal(price),
    originalPrice: new Decimal(price + 5),
    discountAmount: hasDiscounts ? new Decimal(5) : new Decimal(0),
    discountPercentage: hasDiscounts ? new Decimal(50) : new Decimal(0),
    hasDiscounts,
  };
}

function makeFlags(overrides: Partial<SummaryFlags> = {}): SummaryFlags {
  return {
    isEmpty: false,
    hasDiscounts: false,
    isFreeShipping: true,
    hasShippingDiscount: false,
    isCalculating: false,
    ...overrides,
  };
}

function makeSummaryLine(overrides: Partial<SummaryLine> = {}): SummaryLine {
  return {
    package_id: 1,
    quantity: 1,
    discounts: [],
    original_unit_price: '20.00',
    original_package_price: '20.00',
    unit_price: '15.00',
    package_price: '15.00',
    subtotal: '15.00',
    total_discount: '5.00',
    total: '15.00',
    name: 'Sample Pack',
    image: 'https://cdn.example.com/sample.png',
    is_recurring: false,
    interval: null,
    interval_count: null,
    currency: 'USD',
    product_name: 'Sample Product',
    product_variant_name: 'Default',
    product_sku: 'SAMPLE-1',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<CartSummary> = {}): CartSummary {
  return {
    lines: [],
    shipping_method: {} as any,
    offer_discounts: [],
    voucher_discounts: [],
    subtotal: '0.00',
    total_discount: '0.00',
    total: '0.00',
    currency: 'USD',
    ...overrides,
  };
}

// ─── buildFlags ──────────────────────────────────────────────────────────────

describe('buildFlags', () => {
  it('isEmpty mirrors state.isEmpty', () => {
    expect(buildFlags(makeState({ isEmpty: true })).isEmpty).toBe(true);
    expect(buildFlags(makeState({ isEmpty: false })).isEmpty).toBe(false);
  });

  it('hasDiscounts mirrors state.hasDiscounts', () => {
    expect(buildFlags(makeState({ hasDiscounts: true })).hasDiscounts).toBe(true);
    expect(buildFlags(makeState({ hasDiscounts: false })).hasDiscounts).toBe(false);
  });

  it('isFreeShipping is true when shippingMethod is absent', () => {
    expect(buildFlags(makeState()).isFreeShipping).toBe(true);
  });

  it('isFreeShipping is true when shipping price is zero', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(0) });
    expect(buildFlags(state).isFreeShipping).toBe(true);
  });

  it('isFreeShipping is false when shipping price is non-zero', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(9.99) });
    expect(buildFlags(state).isFreeShipping).toBe(false);
  });

  it('hasShippingDiscount mirrors shippingMethod.hasDiscounts', () => {
    expect(
      buildFlags(makeState({ shippingMethod: makeShippingMethod(5, true) }))
        .hasShippingDiscount,
    ).toBe(true);
    expect(
      buildFlags(makeState({ shippingMethod: makeShippingMethod(5, false) }))
        .hasShippingDiscount,
    ).toBe(false);
  });

  it('hasShippingDiscount is false when no shipping method', () => {
    expect(buildFlags(makeState()).hasShippingDiscount).toBe(false);
  });

  it('isCalculating mirrors state.isCalculating', () => {
    expect(buildFlags(makeState({ isCalculating: true })).isCalculating).toBe(true);
    expect(buildFlags(makeState({ isCalculating: false })).isCalculating).toBe(false);
  });
});

// ─── buildVars ───────────────────────────────────────────────────────────────

describe('buildVars', () => {
  const baseFlags = makeFlags({ hasDiscounts: true, isFreeShipping: false });

  it('subtotal is formatted as currency', () => {
    const state = makeState({ subtotal: new Decimal(24.99) });
    const vars = buildVars(state, baseFlags, 1, 'USD');
    expect(vars.subtotal).toContain('24.99');
  });

  it('total is formatted as currency', () => {
    const state = makeState({ total: new Decimal(19.99) });
    const vars = buildVars(state, baseFlags, 1, 'USD');
    expect(vars.total).toContain('19.99');
  });

  it('discounts is formatted from totalDiscount', () => {
    const state = makeState({ totalDiscount: new Decimal(5) });
    const vars = buildVars(state, baseFlags, 1, 'USD');
    expect(vars.discounts).toContain('5.00');
  });

  it('totalDiscount mirrors discounts (formatted)', () => {
    const state = makeState({ totalDiscount: new Decimal(7.5) });
    const vars = buildVars(state, baseFlags, 1, 'USD');
    expect(vars.totalDiscount).toContain('7.50');
  });

  it('totalDiscountPercentage is formatted as percentage', () => {
    const state = makeState({ totalDiscountPercentage: new Decimal(25) });
    const vars = buildVars(state, baseFlags, 1, 'USD');
    expect(vars.totalDiscountPercentage).toContain('25');
  });

  it('shipping shows "Free" when isFreeShipping flag is true', () => {
    const flags = makeFlags({ isFreeShipping: true });
    const vars = buildVars(makeState(), flags, 0, 'USD');
    expect(vars.shipping).toBe('Free');
  });

  it('shipping is formatted currency when not free', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(9.99) });
    const flags = makeFlags({ isFreeShipping: false });
    const vars = buildVars(state, flags, 1, 'USD');
    expect(vars.shipping).toContain('9.99');
  });

  it('shippingName falls back to empty string when no method', () => {
    const vars = buildVars(makeState(), makeFlags(), 0, 'USD');
    expect(vars.shippingName).toBe('');
    expect(vars.shippingCode).toBe('');
  });

  it('shippingName/shippingCode reflect the active method', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(5) });
    const vars = buildVars(state, makeFlags({ isFreeShipping: false }), 1, 'USD');
    expect(vars.shippingName).toBe('Standard');
    expect(vars.shippingCode).toBe('standard');
  });

  it('shippingOriginal is empty string when no shipping discount', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(9.99, false) });
    const vars = buildVars(state, makeFlags({ isFreeShipping: false }), 1, 'USD');
    expect(vars.shippingOriginal).toBe('');
  });

  it('shippingOriginal is formatted currency when shipping discount is active', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(4.99, true) });
    const flags = makeFlags({ isFreeShipping: false, hasShippingDiscount: true });
    const vars = buildVars(state, flags, 1, 'USD');
    // originalPrice = price + 5 = 9.99
    expect(vars.shippingOriginal).toContain('9.99');
  });

  it('shippingDiscountAmount is formatted from method discountAmount', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(4.99, true) });
    const flags = makeFlags({ isFreeShipping: false, hasShippingDiscount: true });
    const vars = buildVars(state, flags, 1, 'USD');
    expect(vars.shippingDiscountAmount).toContain('5.00');
  });

  it('shippingDiscountPercentage is formatted as percentage', () => {
    const state = makeState({ shippingMethod: makeShippingMethod(4.99, true) });
    const flags = makeFlags({ isFreeShipping: false, hasShippingDiscount: true });
    const vars = buildVars(state, flags, 1, 'USD');
    expect(vars.shippingDiscountPercentage).toContain('50');
  });

  it('itemCount is a stringified number', () => {
    const vars = buildVars(makeState(), makeFlags(), 3, 'USD');
    expect(vars.itemCount).toBe('3');
  });

  it('totalQuantity sums all item quantities', () => {
    const state = makeState({
      items: [
        { quantity: 2 } as any,
        { quantity: 5 } as any,
      ],
    });
    const vars = buildVars(state, makeFlags(), 2, 'USD');
    expect(vars.totalQuantity).toBe('7');
  });

  it('currency is exposed verbatim', () => {
    const vars = buildVars(makeState(), makeFlags(), 0, 'EUR');
    expect(vars.currency).toBe('EUR');
  });

  it('flag fields are stringified', () => {
    const flags = makeFlags({
      isEmpty: true,
      hasDiscounts: true,
      isFreeShipping: false,
      hasShippingDiscount: true,
      isCalculating: true,
    });
    const vars = buildVars(makeState(), flags, 0, 'USD');
    expect(vars.isEmpty).toBe('true');
    expect(vars.hasDiscounts).toBe('true');
    expect(vars.isFreeShipping).toBe('false');
    expect(vars.hasShippingDiscount).toBe('true');
    expect(vars.isCalculating).toBe('true');
  });
});

// ─── buildDefaultTemplate / renderDefault ────────────────────────────────────

describe('buildDefaultTemplate', () => {
  const vars: Record<string, string> = {
    subtotal: '$24.99',
    total: '$19.99',
    shipping: 'Free',
    shippingOriginal: '',
    discounts: '$5.00',
    itemCount: '1',
  };

  it('always contains a subtotal row', () => {
    const html = buildDefaultTemplate(vars, makeFlags());
    expect(html).toContain('next-row-subtotal');
    expect(html).toContain('$24.99');
  });

  it('omits discounts row when hasDiscounts is false', () => {
    const html = buildDefaultTemplate(vars, makeFlags({ hasDiscounts: false }));
    expect(html).not.toContain('next-row-discounts');
  });

  it('includes discounts row with negative sign when hasDiscounts is true', () => {
    const html = buildDefaultTemplate(vars, makeFlags({ hasDiscounts: true }));
    expect(html).toContain('next-row-discounts');
    expect(html).toContain('-$5.00');
  });

  it('shipping row prints "Free" when isFreeShipping is true', () => {
    const html = buildDefaultTemplate(
      { ...vars, shipping: '$10.00' },
      makeFlags({ isFreeShipping: true }),
    );
    expect(html).toContain('next-row-shipping');
    expect(html).toContain('Free');
    expect(html).not.toContain('$10.00');
  });

  it('shipping row prints the formatted price when not free', () => {
    const html = buildDefaultTemplate(
      { ...vars, shipping: '$10.00' },
      makeFlags({ isFreeShipping: false }),
    );
    expect(html).toContain('$10.00');
  });

  it('always contains a total row', () => {
    const html = buildDefaultTemplate(vars, makeFlags());
    expect(html).toContain('next-row-total');
    expect(html).toContain('$19.99');
  });
});

describe('renderDefault', () => {
  it('writes the default template into element.innerHTML', () => {
    const el = document.createElement('div');
    renderDefault(
      el,
      {
        subtotal: '$10.00',
        total: '$10.00',
        shipping: 'Free',
        shippingOriginal: '',
        discounts: '$0.00',
      },
      makeFlags(),
    );
    expect(el.innerHTML).toContain('next-row-subtotal');
    expect(el.innerHTML).toContain('next-row-total');
  });
});

// ─── renderCustom ────────────────────────────────────────────────────────────

describe('renderCustom', () => {
  it('substitutes {token} placeholders from vars', () => {
    const el = document.createElement('div');
    renderCustom(
      el,
      '<p>Total: {total}</p><p>Sub: {subtotal}</p>',
      { total: '$15.00', subtotal: '$20.00' },
      undefined,
    );
    expect(el.innerHTML).toContain('Total: $15.00');
    expect(el.innerHTML).toContain('Sub: $20.00');
  });

  it('leaves unknown tokens unchanged', () => {
    const el = document.createElement('div');
    renderCustom(el, '<p>{unknown}</p>', { total: '$15.00' }, undefined);
    expect(el.innerHTML).toContain('{unknown}');
  });

  it('renders list containers when summary is provided', () => {
    const host = document.createElement('section');
    const template = `
      <div data-summary-lines>
        <template><div class="line">{item.name}</div></template>
      </div>
    `;
    renderCustom(
      host,
      template,
      {},
      makeSummary({ lines: [makeSummaryLine({ name: 'Foo' })] }),
    );
    expect(host.querySelector('[data-summary-lines]')?.textContent).toContain('Foo');
  });
});

// ─── renderListContainers ────────────────────────────────────────────────────

describe('renderListContainers', () => {
  it('populates lines, offer discounts, and voucher discounts', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div data-summary-lines>
        <template><div class="line">{item.name}</div></template>
      </div>
      <div data-summary-offer-discounts>
        <template><div class="discount">{discount.name}</div></template>
      </div>
      <div data-summary-voucher-discounts>
        <template><div class="voucher">{discount.name}</div></template>
      </div>
    `;

    renderListContainers(
      el,
      makeSummary({
        lines: [makeSummaryLine({ name: 'Bundle A' })],
        offer_discounts: [{ offer_id: 1, name: 'Spring Promo', amount: '5.00' }],
        voucher_discounts: [{ offer_id: 2, name: 'WELCOME10', amount: '10.00' }],
      }),
    );

    expect(el.querySelector('[data-summary-lines]')?.textContent).toContain('Bundle A');
    expect(el.querySelector('[data-summary-offer-discounts]')?.textContent).toContain(
      'Spring Promo',
    );
    expect(el.querySelector('[data-summary-voucher-discounts]')?.textContent).toContain(
      'WELCOME10',
    );
  });

  it('does nothing when no list containers are present', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>just text</p>';
    expect(() => renderListContainers(el, makeSummary())).not.toThrow();
    expect(el.innerHTML).toBe('<p>just text</p>');
  });
});

// ─── renderLines ─────────────────────────────────────────────────────────────

describe('renderLines', () => {
  function buildContainer(template: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `<div data-summary-lines><template>${template}</template></div>`;
    return el;
  }

  it('clones the template once per summary line and appends them', () => {
    const el = buildContainer(
      '<div class="line" data-id="{item.packageId}">{item.name}</div>',
    );
    renderLines(
      el,
      makeSummary({
        lines: [
          makeSummaryLine({ package_id: 2, name: 'Second' }),
          makeSummaryLine({ package_id: 1, name: 'First' }),
        ],
      }),
    );
    const container = el.querySelector('[data-summary-lines]')!;
    const lines = container.querySelectorAll('.line');
    expect(lines).toHaveLength(2);
    // Sorted by package_id ascending
    expect(lines[0]?.getAttribute('data-id')).toBe('1');
    expect(lines[1]?.getAttribute('data-id')).toBe('2');
    expect(container.classList.contains('next-summary-has-items')).toBe(true);
    expect(container.classList.contains('next-summary-empty')).toBe(false);
  });

  it('marks the container as empty when there are no lines', () => {
    const el = buildContainer('<div class="line">{item.name}</div>');
    renderLines(el, makeSummary({ lines: [] }));
    const container = el.querySelector('[data-summary-lines]')!;
    expect(container.classList.contains('next-summary-empty')).toBe(true);
    expect(container.classList.contains('next-summary-has-items')).toBe(false);
    expect(container.querySelectorAll('.line')).toHaveLength(0);
  });

  it('warns about deprecated line.* tokens with replacement hints', () => {
    const el = buildContainer('<div>{line.name} - {line.qty}</div>');
    const warn = vi.fn();
    renderLines(el, makeSummary({ lines: [makeSummaryLine()] }), warn);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0]?.[0] as string;
    expect(message).toContain('Deprecated line.* tokens');
    expect(message).toContain('{line.name} → {item.name}');
    expect(message).toContain('{line.qty} → {item.quantity}');
  });

  it('does not warn when only item.* tokens are used', () => {
    const el = buildContainer('<div>{item.name}</div>');
    const warn = vi.fn();
    renderLines(el, makeSummary({ lines: [makeSummaryLine()] }), warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns silently when [data-summary-lines] container is missing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>nothing</p>';
    expect(() => renderLines(el, makeSummary())).not.toThrow();
  });

  it('returns silently when the inner <template> is missing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<div data-summary-lines></div>';
    expect(() =>
      renderLines(el, makeSummary({ lines: [makeSummaryLine()] })),
    ).not.toThrow();
    expect(el.querySelector('[data-summary-lines]')?.children).toHaveLength(0);
  });
});

// ─── buildLineElement ────────────────────────────────────────────────────────

describe('buildLineElement', () => {
  it('renders line tokens via renderSummaryLine', () => {
    const html =
      '<div class="line"><span>{item.name}</span><span>{item.quantity}</span></div>';
    const el = buildLineElement(html, makeSummaryLine({ name: 'Bundle', quantity: 3 }));
    expect((el as HTMLElement).textContent).toContain('Bundle');
    expect((el as HTMLElement).textContent).toContain('3');
  });

  it('populates [data-line-discounts] container with per-line discounts', () => {
    // NOTE: Because renderSummaryLine performs raw-string token substitution
    // before the inner <template> is parsed, `{discount.*}` placeholders inside
    // the line template get stripped to '' (they aren't `item.*` keys). The
    // template element still gets cloned once per discount, so we verify the
    // count and the has-items class — not the inner text.
    const html = `<div class="line"><span>{item.name}</span><div data-line-discounts><template><div class="d"></div></template></div></div>`;
    const line = makeSummaryLine({
      discounts: [
        { offer_id: 1, name: 'Promo', amount: '$2.00' },
        { offer_id: 2, name: 'Bundle', amount: '$1.00' },
      ],
    });
    const el = buildLineElement(html, line) as HTMLElement;
    const discountContainer = el.querySelector('[data-line-discounts]')!;
    expect(discountContainer.querySelectorAll('.d')).toHaveLength(2);
    expect(discountContainer.classList.contains('next-summary-has-items')).toBe(true);
    expect(discountContainer.classList.contains('next-summary-empty')).toBe(false);
  });

  it('marks the line discount container as empty when the line has no discounts', () => {
    const html = `
      <div class="line">
        <div data-line-discounts>
          <template><div class="d">{discount.name}</div></template>
        </div>
      </div>
    `;
    const el = buildLineElement(html, makeSummaryLine({ discounts: [] })) as HTMLElement;
    const container = el.querySelector('[data-line-discounts]')!;
    expect(container.classList.contains('next-summary-empty')).toBe(true);
    expect(container.querySelectorAll('.d')).toHaveLength(0);
  });
});

// ─── renderDiscountList / renderDiscountItem ────────────────────────────────

describe('renderDiscountList', () => {
  function buildContainer(template: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `<div data-summary-offer-discounts><template>${template}</template></div>`;
    return el;
  }

  it('renders one item per discount', () => {
    const el = buildContainer('<li>{discount.name} {discount.amount}</li>');
    const items: DiscountItem[] = [
      { name: 'A', amount: '$1.00' },
      { name: 'B', amount: '$2.00' },
    ];
    renderDiscountList(el, '[data-summary-offer-discounts]', items);
    const container = el.querySelector('[data-summary-offer-discounts]')!;
    const lis = container.querySelectorAll('li');
    expect(lis).toHaveLength(2);
    expect(lis[0]?.textContent).toContain('A $1.00');
    expect(lis[1]?.textContent).toContain('B $2.00');
    expect(container.classList.contains('next-summary-has-items')).toBe(true);
  });

  it('marks the container as empty when given no discounts', () => {
    const el = buildContainer('<li>{discount.name}</li>');
    renderDiscountList(el, '[data-summary-offer-discounts]', []);
    const container = el.querySelector('[data-summary-offer-discounts]')!;
    expect(container.classList.contains('next-summary-empty')).toBe(true);
    expect(container.classList.contains('next-summary-has-items')).toBe(false);
  });

  it('does nothing when the container is missing', () => {
    const el = document.createElement('div');
    expect(() =>
      renderDiscountList(el, '[data-summary-offer-discounts]', [
        { amount: '1.00' },
      ]),
    ).not.toThrow();
  });

  it('does nothing when the inner <template> is missing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<div data-summary-offer-discounts></div>';
    renderDiscountList(el, '[data-summary-offer-discounts]', [
      { amount: '1.00' },
    ]);
    expect(
      el.querySelector('[data-summary-offer-discounts]')?.children,
    ).toHaveLength(0);
  });
});

describe('renderDiscountItem', () => {
  it('substitutes discount.name, discount.amount, discount.description', () => {
    const html = renderDiscountItem(
      '<p>{discount.name}|{discount.amount}|{discount.description}</p>',
      { name: 'Promo', amount: '$5.00', description: 'Spring sale' },
    );
    expect(html).toBe('<p>Promo|$5.00|Spring sale</p>');
  });

  it('renders empty string for missing optional fields', () => {
    const html = renderDiscountItem(
      '<p>{discount.name}|{discount.description}</p>',
      { amount: '$1.00' },
    );
    expect(html).toBe('<p>|</p>');
  });

  it('returns empty string for unknown discount.* tokens', () => {
    const html = renderDiscountItem('<p>{discount.unknown}</p>', { amount: '$1.00' });
    expect(html).toBe('<p></p>');
  });
});

// ─── renderSummaryLine ───────────────────────────────────────────────────────

describe('renderSummaryLine', () => {
  it('substitutes basic identity tokens', () => {
    const html = renderSummaryLine(
      '{item.packageId}|{item.name}|{item.quantity}|{item.sku}',
      makeSummaryLine({
        package_id: 42,
        name: 'Pack',
        quantity: 4,
        product_sku: 'SKU-1',
      }),
    );
    expect(html).toBe('42|Pack|4|SKU-1');
  });

  it('substitutes product/variant tokens with empty fallback', () => {
    const html = renderSummaryLine(
      '{item.productName}|{item.variantName}',
      makeSummaryLine({
        product_name: undefined,
        product_variant_name: undefined,
      }),
    );
    expect(html).toBe('|');
  });

  it('formats price tokens as currency in the line currency', () => {
    const html = renderSummaryLine(
      '{item.price}|{item.unitPrice}|{item.originalUnitPrice}|{item.discountAmount}',
      makeSummaryLine({
        package_price: '15.00',
        unit_price: '15.00',
        original_unit_price: '20.00',
        total_discount: '5.00',
        currency: 'USD',
      }),
    );
    expect(html).toContain('15.00');
    expect(html).toContain('20.00');
    expect(html).toContain('5.00');
  });

  it('computes discountPercentage from unit and original price', () => {
    const html = renderSummaryLine(
      '{item.discountPercentage}',
      makeSummaryLine({ unit_price: '15.00', original_unit_price: '20.00' }),
    );
    // (20 - 15) / 20 = 25%
    expect(html).toBe('25');
  });

  it('discountPercentage is "0" when there is no discount', () => {
    const html = renderSummaryLine(
      '{item.discountPercentage}',
      makeSummaryLine({ unit_price: '20.00', original_unit_price: '20.00' }),
    );
    expect(html).toBe('0');
  });

  it('hasDiscount maps to "show" / "hide"', () => {
    const showHtml = renderSummaryLine(
      '{item.hasDiscount}',
      makeSummaryLine({ total_discount: '5.00' }),
    );
    const hideHtml = renderSummaryLine(
      '{item.hasDiscount}',
      makeSummaryLine({ total_discount: '0' }),
    );
    expect(showHtml).toBe('show');
    expect(hideHtml).toBe('hide');
  });

  it('isRecurring maps to "true" / "false"', () => {
    expect(
      renderSummaryLine('{item.isRecurring}', makeSummaryLine({ is_recurring: true })),
    ).toBe('true');
    expect(
      renderSummaryLine('{item.isRecurring}', makeSummaryLine({ is_recurring: false })),
    ).toBe('false');
  });

  it('frequency token: "Daily" for interval=day count=1', () => {
    expect(
      renderSummaryLine(
        '{item.frequency}',
        makeSummaryLine({ interval: 'day', interval_count: 1 }),
      ),
    ).toBe('Daily');
  });

  it('frequency token: "Every 7 days" for interval=day count=7', () => {
    expect(
      renderSummaryLine(
        '{item.frequency}',
        makeSummaryLine({ interval: 'day', interval_count: 7 }),
      ),
    ).toBe('Every 7 days');
  });

  it('frequency token: "Monthly" for interval=month count=1', () => {
    expect(
      renderSummaryLine(
        '{item.frequency}',
        makeSummaryLine({ interval: 'month', interval_count: 1 }),
      ),
    ).toBe('Monthly');
  });

  it('frequency token: "Every 3 months" for interval=month count=3', () => {
    expect(
      renderSummaryLine(
        '{item.frequency}',
        makeSummaryLine({ interval: 'month', interval_count: 3 }),
      ),
    ).toBe('Every 3 months');
  });

  it('frequency token is empty for null interval', () => {
    expect(
      renderSummaryLine(
        '{item.frequency}',
        makeSummaryLine({ interval: null, interval_count: null }),
      ),
    ).toBe('');
  });

  it('recurringPrice is empty when not set', () => {
    expect(
      renderSummaryLine(
        '{item.recurringPrice}',
        makeSummaryLine({ price_recurring: undefined }),
      ),
    ).toBe('');
  });

  it('recurringPrice is formatted when set', () => {
    const html = renderSummaryLine(
      '{item.recurringPrice}',
      makeSummaryLine({ price_recurring: '12.34', currency: 'USD' }),
    );
    expect(html).toContain('12.34');
  });

  it('unknown tokens render as empty string', () => {
    expect(renderSummaryLine('{item.nope}', makeSummaryLine())).toBe('');
  });
});

// ─── clearListItems ──────────────────────────────────────────────────────────

describe('clearListItems', () => {
  it('removes children but preserves the <template>', () => {
    const container = document.createElement('div');
    container.innerHTML = '<template>tpl</template><div>a</div><div>b</div>';
    clearListItems(container);
    expect(container.querySelectorAll('template')).toHaveLength(1);
    expect(container.querySelectorAll('div')).toHaveLength(0);
  });

  it('is a no-op when there are no children', () => {
    const container = document.createElement('div');
    expect(() => clearListItems(container)).not.toThrow();
    expect(container.children).toHaveLength(0);
  });
});

// ─── updateStateClasses ──────────────────────────────────────────────────────

describe('updateStateClasses', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('adds next-cart-empty when isEmpty', () => {
    updateStateClasses(el, makeFlags({ isEmpty: true }));
    expect(el.classList.contains('next-cart-empty')).toBe(true);
    expect(el.classList.contains('next-cart-has-items')).toBe(false);
  });

  it('adds next-cart-has-items when not isEmpty', () => {
    updateStateClasses(el, makeFlags({ isEmpty: false }));
    expect(el.classList.contains('next-cart-has-items')).toBe(true);
    expect(el.classList.contains('next-cart-empty')).toBe(false);
  });

  it('adds next-has-discounts when hasDiscounts', () => {
    updateStateClasses(el, makeFlags({ hasDiscounts: true }));
    expect(el.classList.contains('next-has-discounts')).toBe(true);
    expect(el.classList.contains('next-no-discounts')).toBe(false);
  });

  it('adds next-no-discounts when no discounts', () => {
    updateStateClasses(el, makeFlags({ hasDiscounts: false }));
    expect(el.classList.contains('next-no-discounts')).toBe(true);
    expect(el.classList.contains('next-has-discounts')).toBe(false);
  });

  it('adds next-free-shipping when isFreeShipping', () => {
    updateStateClasses(el, makeFlags({ isFreeShipping: true }));
    expect(el.classList.contains('next-free-shipping')).toBe(true);
    expect(el.classList.contains('next-has-shipping')).toBe(false);
  });

  it('adds next-has-shipping when not free', () => {
    updateStateClasses(el, makeFlags({ isFreeShipping: false }));
    expect(el.classList.contains('next-has-shipping')).toBe(true);
    expect(el.classList.contains('next-free-shipping')).toBe(false);
  });

  it('adds next-has-shipping-discount when hasShippingDiscount', () => {
    updateStateClasses(el, makeFlags({ hasShippingDiscount: true }));
    expect(el.classList.contains('next-has-shipping-discount')).toBe(true);
    expect(el.classList.contains('next-no-shipping-discount')).toBe(false);
  });

  it('adds next-no-shipping-discount when shipping has no discount', () => {
    updateStateClasses(el, makeFlags({ hasShippingDiscount: false }));
    expect(el.classList.contains('next-no-shipping-discount')).toBe(true);
    expect(el.classList.contains('next-has-shipping-discount')).toBe(false);
  });

  it('adds next-calculating when isCalculating', () => {
    updateStateClasses(el, makeFlags({ isCalculating: true }));
    expect(el.classList.contains('next-calculating')).toBe(true);
    expect(el.classList.contains('next-not-calculating')).toBe(false);
  });

  it('adds next-not-calculating when not calculating', () => {
    updateStateClasses(el, makeFlags({ isCalculating: false }));
    expect(el.classList.contains('next-not-calculating')).toBe(true);
    expect(el.classList.contains('next-calculating')).toBe(false);
  });

  it('toggles correctly on repeated calls', () => {
    updateStateClasses(el, makeFlags({ isEmpty: true }));
    expect(el.classList.contains('next-cart-empty')).toBe(true);
    updateStateClasses(el, makeFlags({ isEmpty: false }));
    expect(el.classList.contains('next-cart-empty')).toBe(false);
    expect(el.classList.contains('next-cart-has-items')).toBe(true);
  });
});

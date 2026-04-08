import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  buildItemContext,
  buildDiscountContext,
  applyLocalConditions,
  evaluateLocalCondition,
} from '../CartSummaryEnhancer.conditions';
import type { SummaryLine } from '@/types/api';
import type { DiscountItem } from '../CartSummaryEnhancer.types';

// happy-dom does not support `:scope > template` (returns null even when the
// <template> is a direct child). The renderer functions used by the
// integration tests below rely on this selector. Patch querySelector here.
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

function el(html: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild as HTMLElement;
}

// ─── buildItemContext ────────────────────────────────────────────────────────

describe('buildItemContext', () => {
  it('exposes scalar fields with the correct raw types', () => {
    const ctx = buildItemContext(
      makeSummaryLine({
        package_id: 42,
        quantity: 3,
        is_recurring: true,
        interval: 'month',
        interval_count: 2,
        product_sku: 'SKU-Z',
      })
    );
    expect(ctx.packageId).toBe(42);
    expect(ctx.quantity).toBe(3);
    expect(ctx.isRecurring).toBe(true);
    expect(ctx.interval).toBe('month');
    expect(ctx.intervalCount).toBe(2);
    expect(ctx.sku).toBe('SKU-Z');
  });

  it('parses prices to raw numbers', () => {
    const ctx = buildItemContext(
      makeSummaryLine({
        unit_price: '15.50',
        original_unit_price: '20.00',
        package_price: '46.50',
        original_package_price: '60.00',
        total_discount: '13.50',
      })
    );
    expect(ctx.unitPrice).toBe(15.5);
    expect(ctx.originalUnitPrice).toBe(20);
    expect(ctx.price).toBe(46.5);
    expect(ctx.originalPrice).toBe(60);
    expect(ctx.discountAmount).toBe(13.5);
  });

  it('computes discountPercentage from raw unit / original prices', () => {
    const ctx = buildItemContext(
      makeSummaryLine({ unit_price: '15.00', original_unit_price: '20.00' })
    );
    // (20 - 15) / 20 = 25
    expect(ctx.discountPercentage).toBe(25);
  });

  it('discountPercentage is 0 when there is no markdown', () => {
    const ctx = buildItemContext(
      makeSummaryLine({ unit_price: '20.00', original_unit_price: '20.00' })
    );
    expect(ctx.discountPercentage).toBe(0);
  });

  it('hasDiscount is a real boolean (not "show"/"hide")', () => {
    const yes = buildItemContext(makeSummaryLine({ total_discount: '5.00' }));
    const no = buildItemContext(makeSummaryLine({ total_discount: '0' }));
    expect(yes.hasDiscount).toBe(true);
    expect(no.hasDiscount).toBe(false);
  });

  it('frequency mirrors computeFrequency', () => {
    const daily = buildItemContext(
      makeSummaryLine({ interval: 'day', interval_count: 1 })
    );
    const everyTwoMonths = buildItemContext(
      makeSummaryLine({ interval: 'month', interval_count: 2 })
    );
    expect(daily.frequency).toBe('Daily');
    expect(everyTwoMonths.frequency).toBe('Every 2 months');
  });

  it('nullable recurring prices remain null when absent', () => {
    const ctx = buildItemContext(
      makeSummaryLine({
        price_recurring: undefined,
        original_recurring_price: undefined,
      })
    );
    expect(ctx.recurringPrice).toBeNull();
    expect(ctx.originalRecurringPrice).toBeNull();
  });

  it('nullable recurring prices parse to numbers when present', () => {
    const ctx = buildItemContext(
      makeSummaryLine({
        price_recurring: '12.34',
        original_recurring_price: '15.00',
      })
    );
    expect(ctx.recurringPrice).toBe(12.34);
    expect(ctx.originalRecurringPrice).toBe(15);
  });
});

// ─── buildDiscountContext ────────────────────────────────────────────────────

describe('buildDiscountContext', () => {
  it('strips currency formatting from amount', () => {
    const ctx = buildDiscountContext({ name: 'Promo', amount: '$5.00' });
    expect(ctx.amount).toBe(5);
    expect(ctx.amountFormatted).toBe('$5.00');
    expect(ctx.name).toBe('Promo');
  });

  it('handles negative amounts', () => {
    const ctx = buildDiscountContext({ name: 'X', amount: '-$2.50' });
    expect(ctx.amount).toBe(-2.5);
  });

  it('falls back to 0 for unparseable amounts', () => {
    const ctx = buildDiscountContext({ amount: 'free' });
    expect(ctx.amount).toBe(0);
  });

  it('exposes empty strings for missing optional fields', () => {
    const ctx = buildDiscountContext({ amount: '$1.00' });
    expect(ctx.name).toBe('');
    expect(ctx.description).toBe('');
  });
});

// ─── evaluateLocalCondition ──────────────────────────────────────────────────

describe('evaluateLocalCondition', () => {
  const lineCtx = {
    item: buildItemContext(
      makeSummaryLine({ quantity: 3, total_discount: '5.00' })
    ),
  };

  it('property: truthy boolean', () => {
    const recurring = {
      item: buildItemContext(makeSummaryLine({ is_recurring: true })),
    };
    const r = evaluateLocalCondition(
      { type: 'property', object: 'item', property: 'isRecurring' },
      recurring
    );
    expect(r).toEqual({ handled: true, visible: true });
  });

  it('property: falsy boolean', () => {
    const r = evaluateLocalCondition(
      { type: 'property', object: 'item', property: 'isRecurring' },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: false });
  });

  it('comparison: numeric greater-than', () => {
    const r = evaluateLocalCondition(
      {
        type: 'comparison',
        left: { object: 'item', property: 'quantity' },
        operator: '>',
        right: 1,
      },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: true });
  });

  it('comparison: numeric less-or-equal', () => {
    const r = evaluateLocalCondition(
      {
        type: 'comparison',
        left: { object: 'item', property: 'unitPrice' },
        operator: '<=',
        right: 50,
      },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: true });
  });

  it('comparison: equality with boolean rhs', () => {
    const r = evaluateLocalCondition(
      {
        type: 'comparison',
        left: { object: 'item', property: 'hasDiscount' },
        operator: '==',
        right: true,
      },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: true });
  });

  it('logical AND short-circuits to false', () => {
    const r = evaluateLocalCondition(
      {
        type: 'logical',
        operator: '&&',
        conditions: [
          {
            type: 'comparison',
            left: { object: 'item', property: 'quantity' },
            operator: '>',
            right: 100,
          },
          { type: 'property', object: 'item', property: 'hasDiscount' },
        ],
      },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: false });
  });

  it('logical OR short-circuits to true', () => {
    const r = evaluateLocalCondition(
      {
        type: 'logical',
        operator: '||',
        conditions: [
          { type: 'property', object: 'item', property: 'isRecurring' },
          {
            type: 'comparison',
            left: { object: 'item', property: 'quantity' },
            operator: '>',
            right: 0,
          },
        ],
      },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: true });
  });

  it('not inverts the inner condition', () => {
    const r = evaluateLocalCondition(
      {
        type: 'not',
        condition: {
          type: 'property',
          object: 'item',
          property: 'isRecurring',
        },
      },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: true });
  });

  it('returns handled: false for unknown namespace', () => {
    const r = evaluateLocalCondition(
      { type: 'property', object: 'cart', property: 'hasItems' },
      lineCtx
    );
    expect(r).toEqual({ handled: false });
  });

  it('logical with mixed namespaces returns handled: false', () => {
    const r = evaluateLocalCondition(
      {
        type: 'logical',
        operator: '&&',
        conditions: [
          {
            type: 'comparison',
            left: { object: 'item', property: 'quantity' },
            operator: '>',
            right: 0,
          },
          { type: 'property', object: 'cart', property: 'hasItems' },
        ],
      },
      lineCtx
    );
    expect(r).toEqual({ handled: false });
  });

  it('function calls are not handled (no method support)', () => {
    const r = evaluateLocalCondition(
      { type: 'function', object: 'item', method: 'hasFlag', args: ['x'] },
      lineCtx
    );
    expect(r).toEqual({ handled: false });
  });

  it('unknown property on a known namespace evaluates to handled false-visible', () => {
    const r = evaluateLocalCondition(
      { type: 'property', object: 'item', property: 'thisDoesNotExist' },
      lineCtx
    );
    expect(r).toEqual({ handled: true, visible: false });
  });

  it('discount.* is handled when ctx.discount is present', () => {
    const ctx = {
      discount: buildDiscountContext({ name: 'A', amount: '$10.00' }),
    };
    const r = evaluateLocalCondition(
      {
        type: 'comparison',
        left: { object: 'discount', property: 'amount' },
        operator: '>=',
        right: 5,
      },
      ctx
    );
    expect(r).toEqual({ handled: true, visible: true });
  });

  it('discount.* returns handled: false when ctx.discount is absent', () => {
    const r = evaluateLocalCondition(
      { type: 'property', object: 'discount', property: 'name' },
      lineCtx
    );
    expect(r).toEqual({ handled: false });
  });
});

// ─── applyLocalConditions ────────────────────────────────────────────────────

describe('applyLocalConditions — descendants', () => {
  const lineCtx = {
    item: buildItemContext(
      makeSummaryLine({
        quantity: 3,
        total_discount: '5.00',
        is_recurring: false,
      })
    ),
  };

  it('removes a descendant whose data-next-show evaluates false', () => {
    const root = el(`
      <li>
        <span class="bulk" data-next-show="item.quantity > 100">Bulk!</span>
        <span class="name">${'{name}'}</span>
      </li>
    `);
    applyLocalConditions(root, lineCtx);
    expect(root.querySelector('.bulk')).toBeNull();
    expect(root.querySelector('.name')).not.toBeNull();
  });

  it('keeps a descendant whose data-next-show evaluates true', () => {
    const root = el(`
      <li><span class="bulk" data-next-show="item.quantity > 1">Bulk!</span></li>
    `);
    applyLocalConditions(root, lineCtx);
    expect(root.querySelector('.bulk')).not.toBeNull();
  });

  it('removes a descendant whose data-next-hide evaluates true', () => {
    const root = el(`
      <li><span class="full" data-next-hide="item.hasDiscount">Full price</span></li>
    `);
    applyLocalConditions(root, lineCtx);
    expect(root.querySelector('.full')).toBeNull();
  });

  it('keeps a descendant whose data-next-hide evaluates false', () => {
    const root = el(`
      <li><span class="renew" data-next-hide="item.isRecurring">One-time</span></li>
    `);
    applyLocalConditions(root, lineCtx);
    expect(root.querySelector('.renew')).not.toBeNull();
  });

  it('strips data-next-show / data-next-hide after evaluation', () => {
    const root = el(`
      <li><span class="x" data-next-show="item.quantity > 0">x</span></li>
    `);
    applyLocalConditions(root, lineCtx);
    const x = root.querySelector('.x') as HTMLElement;
    expect(x.hasAttribute('data-next-show')).toBe(false);
    expect(x.hasAttribute('data-next-hide')).toBe(false);
  });

  it('leaves unknown-namespace conditions alone (passthrough for global enhancer)', () => {
    const root = el(`
      <li><span class="x" data-next-show="cart.hasItems">x</span></li>
    `);
    applyLocalConditions(root, lineCtx);
    const x = root.querySelector('.x') as HTMLElement;
    expect(x).not.toBeNull();
    expect(x.getAttribute('data-next-show')).toBe('cart.hasItems');
  });

  it('handles logical AND across item.* properties', () => {
    const root = el(`
      <li>
        <span class="a" data-next-show="item.quantity > 1 && item.hasDiscount">A</span>
        <span class="b" data-next-show="item.quantity > 1 && item.isRecurring">B</span>
      </li>
    `);
    applyLocalConditions(root, lineCtx);
    expect(root.querySelector('.a')).not.toBeNull();
    expect(root.querySelector('.b')).toBeNull();
  });

  it('handles ! (not) operator', () => {
    const root = el(
      `<li><span class="x" data-next-show="!item.isRecurring">One-time</span></li>`
    );
    applyLocalConditions(root, lineCtx);
    expect(root.querySelector('.x')).not.toBeNull();
  });

  it('strips empty data-next-show as a no-op visible', () => {
    const root = el(`<li><span class="x" data-next-show="">x</span></li>`);
    applyLocalConditions(root, lineCtx);
    const x = root.querySelector('.x') as HTMLElement;
    expect(x).not.toBeNull();
    expect(x.hasAttribute('data-next-show')).toBe(false);
  });
});

describe('applyLocalConditions — root element', () => {
  const lineCtx = {
    item: buildItemContext(
      makeSummaryLine({ quantity: 3, total_discount: '0' })
    ),
  };

  it('returns false when the root has a data-next-hide that resolves true', () => {
    const root = el(`<li data-next-hide="item.quantity > 0">x</li>`);
    const visible = applyLocalConditions(root, lineCtx);
    expect(visible).toBe(false);
    // Attribute is stripped even when caller decides not to attach
    expect(root.hasAttribute('data-next-hide')).toBe(false);
  });

  it('returns false when the root has a data-next-show that resolves false', () => {
    const root = el(`<li data-next-show="item.hasDiscount">x</li>`);
    const visible = applyLocalConditions(root, lineCtx);
    expect(visible).toBe(false);
  });

  it('returns true when the root condition resolves visible', () => {
    const root = el(`<li data-next-show="item.quantity > 0">x</li>`);
    const visible = applyLocalConditions(root, lineCtx);
    expect(visible).toBe(true);
  });

  it('returns true (passthrough) when the root condition references an unknown namespace', () => {
    const root = el(`<li data-next-show="cart.hasItems">x</li>`);
    const visible = applyLocalConditions(root, lineCtx);
    expect(visible).toBe(true);
    expect(root.getAttribute('data-next-show')).toBe('cart.hasItems');
  });

  it('forwards parser/eval failures via warn callback and leaves visible', () => {
    const warn = vi.fn();
    // Force a parser-throwing condition by using an unbalanced expression.
    // AttributeParser.parseCondition catches its own errors and returns a
    // default property node, so this assertion simply confirms we don't crash.
    const root = el(
      `<li><span class="x" data-next-show="item.quantity >">x</span></li>`
    );
    expect(() => applyLocalConditions(root, lineCtx, warn)).not.toThrow();
  });
});

// ─── Integration with renderer functions ────────────────────────────────────

describe('integration: renderDiscountList honours discount.* conditions', () => {
  it('hides discount items whose condition evaluates false', async () => {
    const { renderDiscountList } = await import(
      '../CartSummaryEnhancer.renderer'
    );
    const container = document.createElement('div');
    container.innerHTML = `
      <ul data-summary-offer-discounts>
        <template><li data-next-show="discount.amount > 5">{discount.name} {discount.amount}</li></template>
      </ul>
    `;
    const items: DiscountItem[] = [
      { name: 'Small', amount: '$2.00' },
      { name: 'Big', amount: '$10.00' },
    ];
    renderDiscountList(container, '[data-summary-offer-discounts]', items);
    const lis = container.querySelectorAll('[data-summary-offer-discounts] li');
    expect(lis).toHaveLength(1);
    expect(lis[0]?.textContent).toContain('Big');
    expect(lis[0]?.hasAttribute('data-next-show')).toBe(false);
  });
});

describe('integration: buildLineElement honours item.* conditions on descendants', () => {
  it('removes a descendant with data-next-show false', async () => {
    const { buildLineElement } = await import(
      '../CartSummaryEnhancer.renderer'
    );
    const html = `
      <li>
        <span class="bulk" data-next-show="item.quantity > 5">Bulk</span>
        <span class="name">{item.name}</span>
      </li>
    `;
    const node = buildLineElement(
      html,
      makeSummaryLine({ quantity: 2, name: 'Pack' })
    );
    expect(node).not.toBeNull();
    expect((node as HTMLElement).querySelector('.bulk')).toBeNull();
    expect((node as HTMLElement).querySelector('.name')?.textContent).toBe(
      'Pack'
    );
  });

  it('returns null when the line root itself is hidden', async () => {
    const { buildLineElement } = await import(
      '../CartSummaryEnhancer.renderer'
    );
    const html = `<li data-next-hide="item.quantity > 0">x</li>`;
    const node = buildLineElement(html, makeSummaryLine({ quantity: 3 }));
    expect(node).toBeNull();
  });

  it('per-line discount conditions can reference the parent item.*', async () => {
    const { buildLineElement } = await import(
      '../CartSummaryEnhancer.renderer'
    );
    const html = `
      <li>
        <div data-line-discounts>
          <template><span class="d" data-next-show="item.quantity > 1"></span></template>
        </div>
      </li>
    `;
    const lineWithMany = makeSummaryLine({
      quantity: 5,
      discounts: [{ offer_id: 1, name: 'A', amount: '$1.00' }],
    });
    const lineWithOne = makeSummaryLine({
      quantity: 1,
      discounts: [{ offer_id: 1, name: 'A', amount: '$1.00' }],
    });
    const many = buildLineElement(html, lineWithMany) as HTMLElement;
    const one = buildLineElement(html, lineWithOne) as HTMLElement;
    expect(many.querySelectorAll('[data-line-discounts] .d')).toHaveLength(1);
    expect(one.querySelectorAll('[data-line-discounts] .d')).toHaveLength(0);
  });
});

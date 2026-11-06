import { describe, expect, it } from 'vitest';
import { eventDetail } from '../../src/debug/event-detail';
import { nodes } from '../../src/debug/view';

const money = (v: number) => `$${v.toFixed(2)}`;
const detail = (name: string, data: Record<string, unknown>) => {
  const { sections = [], fields = {} } = eventDetail(name, data, money, (id) => `Package ${id}`);
  const text = (children: Parameters<typeof nodes>[0]) => {
    const root = document.createElement('div');
    root.append(...nodes(children));
    return root;
  };
  return {
    headings: sections.map(([heading]) => heading),
    section: (heading: string) => text(sections.find(([h]) => h === heading)![1]),
    fields,
  };
};

const LINE = { package_id: 1, product_title: 'Drone Hawk', quantity: 3, price: 44, original_price: 149.99, total: 132 };
const ADDRESS = {
  first_name: 'Ada',
  last_name: 'Lee',
  line1: '1 Main St',
  city: 'Austin',
  state: 'TX',
  postcode: '73301',
  country: 'US',
};

describe('an event in its modal', () => {
  it('shows a priced selector once: its lines and options, then only the fields no section shows', () => {
    const d = detail('selector.priced', {
      selector_id: 'main',
      type: 'bundle',
      option_id: 'bundle-3x',
      lines: [LINE],
      currency: 'USD',
      price: 44,
      original_price: 149.99,
      subtotal: 449.97,
      total_discount: 317.97,
      total: 132,
      quantity: 3,
      in_cart: true,
      options: [
        { option_id: 'bundle-1x', quantity: 1, selected: false, total: 59, original_total: 149.99, lines: [] },
        { option_id: 'bundle-3x', quantity: 3, selected: true, total: 132, lines: [] },
      ],
    });
    expect(d.headings).toEqual(['What it carried', 'Options']);
    expect(
      [...d.section('Options').querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.textContent)),
    ).toEqual([
      ['Option', 'Qty', 'Total', ''],
      ['bundle-1x', '1', '$149.99$59.00', ''],
      ['bundle-3x', '3', '$132.00', 'Selected'],
    ]);
    expect(d.fields).toEqual({ 'Selector id': 'main', Type: 'bundle', 'Option id': 'bundle-3x', 'In cart': 'Yes' });
  });

  it('shows a refused checkout with what went wrong, who, where and its cart', () => {
    const d = detail('checkout.failed', {
      id: 'c1',
      step: 2,
      cart: { lines: [LINE], total: 141.99, shipping_method: { name: 'Express', price: 9.99 }, currency: 'USD' },
      user: {
        first_name: 'Ada',
        last_name: 'Lee',
        email: 'ada@example.com',
        accepts_marketing: false,
        language: 'en',
        user_agent: 'x',
      },
      shipping_address: ADDRESS,
      billing_same_as_shipping: true,
      payment_method: 'card_token',
      error: { code: 'rejected', message: 'Card declined', status: 422 },
    });
    expect(d.headings).toEqual([
      'What went wrong',
      'What it carried',
      'Customer',
      'Shipping address',
      'Billing address',
    ]);
    expect(d.section('What went wrong').textContent).toBe('CoderejectedMessageCard declinedStatus422');
    expect(d.section('Customer').textContent).toBe(
      'First nameAdaLast nameLeeEmailada@example.comAccepts marketingNoLanguageen',
    );
    expect(d.section('Shipping address').textContent).toBe('Ada Lee1 Main StAustin TX 73301US');
    expect(d.section('Billing address').textContent).toBe('Same as shipping');
    expect(d.fields).toEqual({ Id: 'c1', Step: '2', 'Payment method': 'card_token' });
  });

  it('shows an address event as its address, and a stopped submit by field', () => {
    const address = detail('address.entered', { ...ADDRESS, type: 'billing' });
    expect(address.headings).toEqual(['Billing address']);
    expect(address.fields).toEqual({});
    const invalid = detail('checkout.invalid', {
      id: 'c1',
      cart: { lines: [] },
      errors: { email: { code: 'blank', message: 'Enter an email' } },
    });
    expect(invalid.headings).toEqual(['What stopped it']);
    expect(invalid.section('What stopped it').textContent).toBe('EmailEnter an email');
  });

  it('keeps the price of an event that is not a cart, and words the error code of a field', () => {
    expect(detail('shipping.selected', { id: 1, code: 'standard', name: 'Standard', price: 0 }).fields).toEqual({
      Id: '1',
      Code: 'standard',
      Name: 'Standard',
      Price: '$0.00',
    });
    const invalid = detail('checkout.invalid', {
      id: 'c1',
      cart: { lines: [] },
      errors: { line1: { code: 'blank' }, state: { code: 'not_selected' } },
      billing_same_as_shipping: true,
    });
    expect(invalid.section('What stopped it').textContent).toBe('AddressMissingStateNot chosen');
    expect(invalid.headings).toEqual(['What stopped it']);
  });

  it('names the packages a cart change moved, and the discounts a coupon gave', () => {
    const added = detail('cart.added', {
      lines: [LINE],
      total: 132,
      quantity: 3,
      coupons: [],
      changes: [{ package_id: 1, from: 0, to: 3 }],
    });
    expect(added.headings).toEqual(['Changed', 'What it carried']);
    expect(added.section('Changed').textContent).toBe('Package 1 0 → 3');
    const coupon = detail('coupon.applied', {
      code: 'SAVE10',
      amount: 10,
      discounts: [{ name: 'Save 10', amount: 10, code: 'SAVE10' }],
    });
    expect(coupon.section('Discounts').textContent).toBe('Save 10 (SAVE10) · −$10.00');
    expect(coupon.fields).toEqual({ Code: 'SAVE10', Amount: '$10.00' });
  });
});

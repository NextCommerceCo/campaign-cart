import { describe, expect, it } from 'vitest';
import { carried, detailModal } from '../../../src/debug/ui/stream';
import { nodes } from '../../../src/debug/ui/view';

const money = (v: number) => `$${v.toFixed(2)}`;

describe('what an event carried', () => {
  it('lists each line at its price and total, then totals that add up to what the shopper pays', () => {
    const root = document.createElement('div');
    root.append(
      ...nodes(
        carried(
          {
            lines: [
              {
                package_id: 1,
                product_title: 'Drone Hawk',
                quantity: 3,
                price: 44,
                original_price: 129.99,
                total: 132,
              },
              {
                package_id: 4,
                product_title: 'Shipping Insurance',
                variant_title: 'Shipping Insurance - Full',
                quantity: 1,
                price: 5,
              },
              {
                package_id: 5,
                product_title: 'Drone Hawk',
                variant_title: 'Drone Hawk',
                quantity: 1,
                price: 0,
                total: 0,
              },
            ],
            subtotal: 389.97,
            total_discount: 252.97,
            discount_percentage: 64.87,
            coupons: ['SAVE10'],
            shipping_method: { name: 'Express', price: 9.99 },
            total: 146.99,
          },
          money,
        ),
      ),
    );
    expect(
      [...root.querySelectorAll('.sitems tr')].map((tr) => [...tr.children].map((c) => c.textContent).join(' | ')),
    ).toEqual([
      'Item | Qty | Each | Total',
      'Drone Hawk | 3 | $129.99$44.00 | $132.00',
      'Shipping InsuranceFull | 1 | $5.00 | $5.00',
      'Drone Hawk | 1 | $0.00 | $0.00',
    ]);
    expect([...root.querySelectorAll('.stotals > *')].map((c) => c.textContent)).toEqual([
      'Subtotal',
      '$389.97',
      'Discount',
      '−$252.97 (64.87%)',
      'Coupons',
      'SAVE10',
      'Shipping',
      'Express · $9.99',
      'Total',
      '$146.99',
    ]);
  });

  it('calls shipping that costs nothing free, and leaves out what is not there', () => {
    const root = document.createElement('div');
    root.append(...nodes(carried({ shipping_method: { code: 'standard', price: 0 }, total: 49 }, money)));
    expect(root.querySelector('.sitems')).toBeNull();
    expect(root.querySelector('.stotals')!.textContent).toBe('Shippingstandard · FreeTotal$49.00');
  });

  it('keeps the payloads in a footer of their own, under the details', () => {
    const detail = detailModal(new Set());
    document.body.append(detail.dialog);
    detail.show({
      title: 'selector.priced',
      subtitle: '',
      fields: { Type: 'toggle' },
      payloads: [['Event', { a: 1 }]],
    });
    const body = detail.dialog.querySelector('.smbody')!;
    expect([...body.children].map((c) => c.className)).toEqual(['shead', 'sfields', 'spay']);
    expect(body.querySelector('.spay > .btn')!.textContent).toBe('Show payload');
    expect(detail.dialog.tabIndex).toBe(-1);
    detail.dialog.remove();
  });
});

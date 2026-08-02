/**
 * Covers the two branchy parts of the debug overlay: the mini-cart renderer
 * (`updateMiniCart` and the helpers it delegates to) and the click router
 * (`handleContainerClick`). Both are dev-only, but both carry real rules —
 * which price is shown when a line is discounted, which discounts count as
 * cart-level, and which localStorage key a click writes.
 *
 * Not covered here, deliberately: `bindResizeHandle` (drag maths needs real
 * layout, and happy-dom does none — that belongs in E2E) and the panel
 * plumbing in `createOverlay`/`updateContent`, which is DOM wiring rather
 * than logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DebugOverlay } from '../debug-overlay';
import { useCartStore } from '@/state/cart';

/** The cart store holds Decimal-like money; the overlay only ever calls `.toNumber()`. */
const money = (n: number): unknown => ({ toNumber: () => n });

function setCart(over: Record<string, unknown>): void {
  useCartStore.setState({
    items: [],
    totalQuantity: 0,
    totalDiscount: money(0),
    total: money(0),
    shippingMethod: null,
    offerDiscounts: undefined,
    voucherDiscounts: undefined,
    ...over,
  } as never);
}

const PLAIN = {
  id: '1',
  packageId: 11,
  title: 'Plain product',
  price: 20,
  quantity: 2,
  package_price: '20.00',
  original_package_price: '20.00',
  is_upsell: false,
};

const DISCOUNTED = {
  id: '2',
  packageId: 22,
  title: 'Discounted product',
  price: 30,
  quantity: 3,
  package_price: '24.00',
  original_package_price: '30.00',
  is_upsell: true,
  discounts: [{ offer_id: 7, description: 'Bundle offer', amount: '18.00' }],
  properties: { engraving: '<b>Bond</b>' },
};

/** Gives the singleton a shadow root holding an open mini-cart, and renders it. */
function renderMiniCart(): string {
  const overlay = DebugOverlay.getInstance() as unknown as Record<
    string,
    unknown
  >;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<div id="debug-mini-cart-display" class="show"></div>';
  overlay.shadowRoot = root;
  (overlay.updateMiniCart as () => void).call(overlay);
  return (root.querySelector('#debug-mini-cart-display') as HTMLElement)
    .innerHTML;
}

describe('DebugOverlay mini-cart', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('says the cart is empty rather than rendering an empty table', () => {
    setCart({});
    const html = renderMiniCart();
    expect(html).toContain('Cart empty');
    expect(html).not.toContain('debug-mini-cart-items');
  });

  it('shows one price for an undiscounted line and no savings row', () => {
    setCart({ items: [PLAIN], totalQuantity: 2, total: money(40) });
    const html = renderMiniCart();
    expect(html).toContain('$20.00 each × 2');
    expect(html).not.toContain('You save');
    expect(html).not.toContain('has-discount');
    expect(html).not.toContain('UPSELL');
    // Subtotal is the sum of the line totals, not the store's own subtotal.
    expect(html).toContain('$40.00');
  });

  it('shows was / now / saved for a discounted line, and the upsell badge', () => {
    setCart({
      items: [DISCOUNTED],
      totalQuantity: 3,
      total: money(72),
      totalDiscount: money(18),
    });
    const html = renderMiniCart();
    expect(html).toContain('has-discount');
    expect(html).toContain('UPSELL');
    expect(html).toContain('$30.00 each'); // was
    expect(html).toContain('$24.00 each × 3'); // now
    // 3 × (30 − 24) = 18, and (30 − 24) / 30 = 20%
    expect(html).toContain('$18.00 (20% off)');
  });

  it("lists a line's own discounts and escapes its properties", () => {
    setCart({ items: [DISCOUNTED], totalQuantity: 3, total: money(72) });
    const html = renderMiniCart();
    expect(html).toContain('Bundle offer');
    expect(html).toContain('Applied Discounts');
    expect(html).toContain('&lt;b&gt;Bond&lt;/b&gt;');
    expect(html).not.toContain('<b>Bond</b>');
  });

  it('falls back to a generic line when a price is discounted with no detail', () => {
    setCart({
      items: [
        { ...PLAIN, package_price: '15.00', original_package_price: '20.00' },
      ],
      totalQuantity: 2,
      total: money(30),
    });
    const html = renderMiniCart();
    expect(html).toContain('Price discount applied (25% off)');
  });

  it('shows FREE shipping as a word and a discounted rate struck through', () => {
    setCart({
      items: [PLAIN],
      totalQuantity: 2,
      total: money(40),
      shippingMethod: { price: money(0), discountAmount: money(0) },
    });
    expect(renderMiniCart()).toContain('FREE');

    setCart({
      items: [PLAIN],
      totalQuantity: 2,
      total: money(45),
      // The API returns net shipping, so the pre-discount price is price + discount.
      shippingMethod: { price: money(5), discountAmount: money(5) },
    });
    const discounted = renderMiniCart();
    expect(discounted).toContain('mini-cart-shipping-row has-discount');
    expect(discounted).toContain('$10.00'); // struck-through original
    expect(discounted).toContain('$5.00'); // charged
  });

  it('only opens the cart-level popup when a voucher or a bare total is discounted', () => {
    // Offers alone do not open it — they are usually already shown on the lines.
    setCart({
      items: [PLAIN],
      totalQuantity: 2,
      total: money(35),
      totalDiscount: money(5),
      offerDiscounts: [
        { offer_id: 9, description: 'Auto offer', amount: '5.00' },
      ],
    });
    expect(renderMiniCart()).not.toContain('has-cart-discounts');

    // A voucher does.
    setCart({
      items: [PLAIN],
      totalQuantity: 2,
      total: money(35),
      totalDiscount: money(5),
      voucherDiscounts: [{ name: 'SAVE5', amount: '5.00' }],
    });
    const withVoucher = renderMiniCart();
    expect(withVoucher).toContain('has-cart-discounts');
    expect(withVoucher).toContain('VOUCHER');
    expect(withVoucher).toContain('SAVE5');
    expect(withVoucher).toContain('-$5.00');

    // With no breakdown at all, a non-zero total discount becomes one row.
    setCart({
      items: [PLAIN],
      totalQuantity: 2,
      total: money(35),
      totalDiscount: money(5),
    });
    const fallback = renderMiniCart();
    expect(fallback).toContain('has-cart-discounts');
    expect(fallback).toContain('OFFER');
    expect(fallback).toContain('Discount');
  });
});

/** Builds a click on `selector` inside a throwaway shadow root and records what it triggered. */
function clickTrace(
  html: string,
  selector: string
): { calls: string[]; overlay: Record<string, unknown> } {
  const overlay = DebugOverlay.getInstance() as unknown as Record<
    string,
    unknown
  >;
  const calls: string[] = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = html;
  overlay.shadowRoot = root;
  overlay.isExpanded = false;
  overlay.activePanel = 'cart';
  overlay.activePanelTab = undefined;
  overlay.panels = [
    {
      id: 'event-timeline',
      toggleInternalEvents: () => calls.push('toggleInternalEvents'),
    },
    {
      id: 'cart',
      getActions: () => [
        { label: 'Clear', action: () => calls.push('panelAction') },
      ],
    },
  ];
  for (const name of [
    'hide',
    'clearCart',
    'exportAllData',
    'toggleMiniCart',
    'toggleXray',
    'closeMiniCart',
    'updateBodyHeight',
    'updateOverlay',
    'updateContent',
  ]) {
    overlay[name] = () => calls.push(name);
  }
  const target = root.querySelector(selector) as HTMLElement;
  (overlay.handleContainerClick as (e: unknown) => void)({ target });
  return { calls, overlay };
}

describe('DebugOverlay click routing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('routes each data-action to its own handler', () => {
    const cases: Array<[string, string]> = [
      ['close', 'hide'],
      ['clear-cart', 'clearCart'],
      ['export-data', 'exportAllData'],
      ['toggle-mini-cart', 'toggleMiniCart'],
      ['toggle-xray', 'toggleXray'],
      ['close-mini-cart', 'closeMiniCart'],
      ['toggle-internal-events', 'toggleInternalEvents'],
    ];
    for (const [action, expected] of cases) {
      const { calls } = clickTrace(
        `<button id="t" data-action="${action}"></button>`,
        '#t'
      );
      expect(calls, action).toContain(expected);
    }
  });

  it('finds the action on an ancestor when the click lands on a child', () => {
    const { calls } = clickTrace(
      '<button data-action="close"><span id="t"></span></button>',
      '#t'
    );
    expect(calls).toContain('hide');
  });

  it('remembers the expanded state across reloads', () => {
    const { overlay } = clickTrace(
      '<button id="t" data-action="toggle-expand"></button>',
      '#t'
    );
    expect(overlay.isExpanded).toBe(true);
    expect(localStorage.getItem('debug-overlay-expanded')).toBe('true');
  });

  it('switching panel clears the remembered tab, switching tab does not', () => {
    localStorage.setItem('debug-overlay-active-tab', 'totals');
    const panel = clickTrace(
      '<div id="t" class="debug-panel-tab" data-panel="order"></div>',
      '#t'
    );
    expect(panel.overlay.activePanel).toBe('order');
    expect(panel.overlay.activePanelTab).toBeUndefined();
    expect(localStorage.getItem('debug-overlay-active-panel')).toBe('order');
    expect(localStorage.getItem('debug-overlay-active-tab')).toBeNull();

    const tab = clickTrace(
      '<div id="t" class="horizontal-tab" data-panel-tab="totals"></div>',
      '#t'
    );
    expect(tab.overlay.activePanelTab).toBe('totals');
    expect(localStorage.getItem('debug-overlay-active-tab')).toBe('totals');
  });

  it('re-clicking the panel that is already active writes nothing', () => {
    const { calls } = clickTrace(
      '<div id="t" class="debug-panel-tab" data-panel="cart"></div>',
      '#t'
    );
    expect(calls).not.toContain('updateOverlay');
    expect(localStorage.getItem('debug-overlay-active-panel')).toBeNull();
  });

  it("runs the active panel's own action, matched by its button label", () => {
    const hit = clickTrace(
      '<button id="t" class="panel-action-btn" data-panel-action="Clear"></button>',
      '#t'
    );
    expect(hit.calls).toContain('panelAction');

    const miss = clickTrace(
      '<button id="t" class="panel-action-btn" data-panel-action="Nope"></button>',
      '#t'
    );
    expect(miss.calls).not.toContain('panelAction');
  });

  it('ignores a click on nothing in particular', () => {
    const { calls } = clickTrace('<div id="t"></div>', '#t');
    expect(calls).toEqual([]);
  });
});

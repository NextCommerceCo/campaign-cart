import type { Engine } from '../engine/engine';
import { cents, formatCents } from '../engine/format';
import type { ApiOrderLine } from '../engine/types';
import { fillTemplate } from '../bindings/dom';

const ITEM_TOKEN = /\{item\.(\w+)\}/g;

const DEFAULT_TEMPLATE =
  '<div class="order-item"><img src="{item.image}" alt=""><span>{item.name}</span> × {item.quantity} <span>{item.lineTotal}</span></div>';

function templateOf(el: Element): string {
  const id = el.getAttribute('data-item-template-id');
  const selector = el.getAttribute('data-item-template-selector');
  const source = (id && document.getElementById(id)) || (selector && document.querySelector(selector));
  const html = source ? source.innerHTML : (el.getAttribute('data-item-template') ?? el.innerHTML);
  return html.replace(/<!--[\s\S]*?-->/g, '').trim() ? html : DEFAULT_TEMPLATE;
}

function tokens(line: ApiOrderLine, money: (c: number) => string): Record<string, string> {
  const each = (amount: string | undefined) => money(Math.round(cents(amount) / (line.quantity || 1)));
  const flag = (on: boolean) => String(on);
  const show = (on: boolean) => (on ? 'show' : 'hide');
  return {
    id: String(line.id),
    name: line.product_title,
    title: line.product_title,
    sku: line.product_sku ?? '',
    quantity: String(line.quantity),
    image: line.image ?? '',
    description: line.product_description ?? '',
    variant: line.variant_title ?? '',
    price: each(line.price_incl_tax),
    priceExclTax: each(line.price_excl_tax),
    lineTotal: money(cents(line.price_incl_tax)),
    lineTotalExclTax: money(cents(line.price_excl_tax)),
    isUpsell: flag(!!line.is_upsell),
    upsellBadge: line.is_upsell ? 'UPSELL' : '',
    showUpsell: show(!!line.is_upsell),
    hasImage: flag(!!line.image),
    showImage: show(!!line.image),
    hasVariant: flag(!!line.variant_title),
    showVariant: show(!!line.variant_title),
  };
}

export function bindReceipt(engine: Engine): Array<() => void> {
  return [...document.querySelectorAll<HTMLElement>('[data-next-order-items]')].map((el) => {
    const template = templateOf(el);
    const empty = el.getAttribute('data-empty-template') ?? '<div class="order-empty">No items found in order</div>';
    let shown = '';
    return () => {
      const { order: state, campaign } = engine.getState();
      const money = (c: number) => formatCents(c, engine.getState());
      const lines = state?.order?.lines ?? [];
      const status =
        state?.status === 'loading'
          ? 'loading'
          : state?.status === 'failed'
            ? 'error'
            : lines.length
              ? 'has-items'
              : 'empty';
      const html =
        status === 'loading'
          ? '<div class="status-message">Loading order items...</div>'
          : status === 'error'
            ? '<div class="status-message">Error loading order items</div>'
            : status === 'empty'
              ? empty
              : lines.map((line) => fillTemplate(template, tokens(line, money), ITEM_TOKEN)).join('');
      for (const s of ['loading', 'error', 'empty', 'has-items']) el.classList.toggle(`order-${s}`, s === status);
      if (html !== shown) el.innerHTML = shown = html;
    };
  });
}

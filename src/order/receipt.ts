import type { Engine } from '../engine/engine';
import { cents, formatCents } from '../engine/display/format';
import type { ApiOrderLine } from '../engine/types';
import { fillTemplate } from '../dom/dom';

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
    'item.id': String(line.id),
    'item.name': line.product_title,
    'item.title': line.product_title,
    'item.sku': line.product_sku ?? '',
    'item.quantity': String(line.quantity),
    'item.image': line.image ?? '',
    'item.description': line.product_description ?? '',
    'item.variant': line.variant_title ?? '',
    'item.price': each(line.price_incl_tax),
    'item.priceExclTax': each(line.price_excl_tax),
    'item.lineTotal': money(cents(line.price_incl_tax)),
    'item.lineTotalExclTax': money(cents(line.price_excl_tax)),
    'item.isUpsell': flag(!!line.is_upsell),
    'item.upsellBadge': line.is_upsell ? 'UPSELL' : '',
    'item.showUpsell': show(!!line.is_upsell),
    'item.hasImage': flag(!!line.image),
    'item.showImage': show(!!line.image),
    'item.hasVariant': flag(!!line.variant_title),
    'item.showVariant': show(!!line.variant_title),
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
              : lines.map((line) => fillTemplate(template, tokens(line, money))).join('');
      for (const s of ['loading', 'error', 'empty', 'has-items']) el.classList.toggle(`order-${s}`, s === status);
      if (html !== shown) el.innerHTML = shown = html;
    };
  });
}

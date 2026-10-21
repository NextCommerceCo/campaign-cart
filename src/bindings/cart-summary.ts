import { cartTokens, discountTokens, lineTokens } from '../engine/values';
import type { BindContext, Render } from './context';
import { applyValues, fillTokens, stamp, tokenValue } from './dom';

function renderDiscounts(root: ParentNode, b: BindContext, scoped: boolean): void {
  const { cart, campaign } = b.engine.getState();
  const s = cart.summary;
  root.querySelectorAll<HTMLElement>('[data-next-discounts]').forEach((el) => {
    if (!scoped && (el.closest('[data-next-cart-summary]') || el.closest('[data-next-bundle-card]'))) return;
    const kind = el.getAttribute('data-next-discounts');
    const list = !s
      ? []
      : kind === 'offer'
        ? s.offer_discounts
        : kind === 'voucher'
          ? s.voucher_discounts
          : [...s.offer_discounts, ...s.voucher_discounts];
    stamp(el, list, (d) => discountTokens(d, s?.currency, campaign?.language));
  });
}

export function bindCartSummary(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];
  const { engine } = b;

  b.each(root, 'data-next-cart-summary', (el) => {
    const template = el.querySelector<HTMLTemplateElement>(':scope > template');
    if (!template) return b.warn('data-next-cart-summary needs a <template> child');
    let last: unknown;
    renders.push(() => {
      const { cart } = engine.getState();
      const key = [cart.summary, cart.calculating, engine.getState().campaign];
      if (last && key.every((k, i) => k === (last as unknown[])[i])) return;
      last = key;
      const tokens = cartTokens(engine);
      const copy = template.content.cloneNode(true) as DocumentFragment;
      fillTokens(copy, tokens);
      const cartLines = engine.cart.lines();
      copy.querySelectorAll('[data-summary-lines]').forEach((lines) =>
        stamp(
          lines,
          cart.summary?.lines ?? [],
          (line) => lineTokens(engine, line, cart.summary?.currency),
          (row, line) => {
            const properties = cartLines.find((l) => l.package_id === line.package_id && l.properties)?.properties;
            row.querySelectorAll('[data-next-item-properties]').forEach((p) =>
              stamp(p, Object.entries(properties ?? {}), ([key, value]) => ({
                'property.key': key,
                'property.value': value,
              })),
            );
            applyValues(row, engine, tokenValue(lineTokens(engine, line, cart.summary?.currency)));
          },
        ),
      );
      renderDiscounts(copy, b, true);
      applyValues(copy, engine);
      el.replaceChildren(template, copy);
      const flags: Record<string, boolean> = {
        'next-cart-empty': tokens.isEmpty === 'true',
        'next-has-discounts': tokens.hasDiscounts === 'true',
        'next-free-shipping': tokens.isFreeShipping === 'true',
        'next-has-shipping-discount': tokens.hasShippingDiscount === 'true',
        'next-calculating': cart.calculating,
        'next-has-tax': false,
      };
      const opposite: Record<string, string> = {
        'next-cart-empty': 'next-cart-has-items',
        'next-has-discounts': 'next-no-discounts',
        'next-free-shipping': 'next-has-shipping',
        'next-has-shipping-discount': 'next-no-shipping-discount',
        'next-calculating': 'next-not-calculating',
        'next-has-tax': 'next-no-tax',
      };
      for (const [cls, on] of Object.entries(flags)) {
        el.classList.toggle(cls, on);
        el.classList.toggle(opposite[cls]!, !on);
      }
    });
  });

  let lastSummary: unknown = null;
  renders.push(() => {
    const summary = engine.getState().cart.summary;
    if (summary === lastSummary) return;
    lastSummary = summary;
    renderDiscounts(root, b, false);
  });
  return renders;
}

import { localeOf, type Value } from '../engine/format';
import { cartTokens, lineTokens } from '../engine/cart/tokens';
import { discountsOfKind, discountTokens, type Tokens } from '../engine/tokens';
import type { BindContext, Render } from './context';
import { applyValues } from './display';
import { fillTokens, stamp } from './tokens';

const tokenValue =
  (tokens: Tokens) =>
  (path: string): Value | undefined => {
    const raw = tokens[path];
    if (raw === undefined) return undefined;
    if (raw === 'true' || raw === 'show') return { type: 'bool', value: true };
    if (raw === 'false' || raw === 'hide') return { type: 'bool', value: false };
    return { type: 'text', value: raw };
  };

function renderDiscounts(root: ParentNode, b: BindContext, scoped: boolean): void {
  const s = b.engine.getState().cart.summary;
  root.querySelectorAll<HTMLElement>('[data-next-discounts]').forEach((el) => {
    if (!scoped && (el.closest('[data-next-cart-summary]') || el.closest('[data-next-bundle-card]'))) return;
    const list = discountsOfKind(s, el.getAttribute('data-next-discounts'));
    stamp(el, list, (d) => discountTokens(d, s?.currency, localeOf(b.engine.getState())));
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
          [...(cart.summary?.lines ?? [])].sort((a, b) => a.package_id - b.package_id),
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

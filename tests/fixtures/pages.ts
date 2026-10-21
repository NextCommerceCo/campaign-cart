import { vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import { flush, makeEngine } from './engine';

export const SELECTOR = `
  <div data-next-bundle-selector data-next-selector-id="main">
    <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'>
      <span id="one-price" data-next-bundle-display="price"></span>
    </div>
    <div data-next-bundle-card data-next-bundle-id="two" data-next-selected="true"
         data-next-bundle-items='[{"packageId":2,"quantity":1}]'>
      <div id="two-badge" data-next-bundle-display="hasDiscount">Save <span data-next-bundle-display="discountPercentage"></span></div>
    </div>
  </div>
  <div data-next-toggle-container>
    <div id="bump" data-next-toggle-card data-next-package-id="9">
      <input id="note" type="text">
      <span id="bump-price" data-next-toggle-display="price"></span>
    </div>
  </div>
  <span id="total" data-next-display="cart.total"></span>
  <span id="pick" data-next-display="bundle.main.price"></span>
  <span id="by-card" data-next-display="bundle.one.price"></span>`;

export async function mount(
  html: string,
  opts: { params?: Record<string, string>; session?: Storage; fetch?: typeof fetch } = {},
) {
  document.body.innerHTML = html;
  const made = makeEngine({ session: opts.session, fetch: opts.fetch, params: opts.params });
  await made.engine.start();
  const navigate = vi.fn();
  const bindings = bindAll(document, made.engine, navigate);
  await flush();
  return { ...made, bindings, navigate, $: (s: string) => document.querySelector<HTMLElement>(s)! };
}

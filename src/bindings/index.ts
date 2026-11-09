import type { Engine } from '../engine/engine';
import { bindAddToCart } from './add-to-cart';
import { bindBundleSelectors } from './bundle-selector';
import { bindCartControls } from './cart-controls';
import { BindContext, type Render } from '../dom/context';
import { bindDisplay } from './display';
import { bindLinks } from './links';
import { bindPackageToggles } from './package-toggle';
import { bindPromotions } from './promotion';

export interface Bindings {
  render(): void;
  bind(root: ParentNode): void;
  /** Settles once the lazy bindings the page needed so far are bound and rendered; none if it needed none. */
  ready?: Promise<void>;
  /** The conditions these bindings left to attributes v2. */
  deferred: Set<Element>;
  /** Whether the page had markup for these bindings when they started. */
  legacy: boolean;
  /** Stops rendering on engine updates and removes the listeners these bindings added outside the bound elements. */
  dispose(): void;
}

const SUMMARY = '[data-next-cart-summary], [data-next-discounts]';
const summaryIn = (node: ParentNode) =>
  (node instanceof Element && node.matches(SUMMARY)) ||
  [...node.querySelectorAll(SUMMARY)].some(
    (el) => !el.closest('[data-next-bundle-card]') || el.matches('[data-next-cart-summary]'),
  );

export function bindAll(
  root: ParentNode,
  engine: Engine,
  navigate: (url: string) => void = (url) => location.assign(url),
): Bindings {
  const context = new BindContext(engine);
  const renders: Render[] = [];
  let ready: Promise<void> | undefined;
  const later = (node: ParentNode) => {
    if (!summaryIn(node)) return;
    ready = Promise.all([
      ready,
      import('./cart-summary').then(({ bindCartSummary }) => {
        const added = bindCartSummary(node, context);
        renders.push(...added);
        added.forEach((r) => r());
      }),
    ]).then(() => {});
  };

  const bind = (node: ParentNode): Render[] => {
    const added = [
      ...bindBundleSelectors(node, context),
      ...bindPackageToggles(node, context),
      ...bindAddToCart(node, context, navigate),
      ...bindCartControls(node, context),
      ...bindLinks(node, context),
      ...bindPromotions(node, context),
      ...bindDisplay(node, context),
    ];
    renders.push(...added);
    later(node);
    return added;
  };

  const render = () => renders.forEach((r) => r());

  context.offs.push(engine.subscribe(render));
  bind(root);
  render();

  return {
    render,
    bind: (node) => bind(node).forEach((r) => r()),
    deferred: context.deferred,
    legacy: renders.length > 0 || !!ready,
    dispose: () => context.offs.forEach((off) => off()),
    get ready() {
      return ready;
    },
  };
}

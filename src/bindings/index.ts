import type { Engine } from '../engine/engine';
import { bindAddToCart } from './add-to-cart';
import { bindBundleSelectors } from './bundle-selector';
import { bindCartControls } from './cart-controls';
import { bindCartSummary } from './cart-summary';
import { BindContext, type Render } from './context';
import { bindDisplay } from './display';
import { bindLinks } from './links';
import { bindPackageToggles } from './package-toggle';

export interface Bindings {
  render(): void;
  bind(root: ParentNode): void;
}

export function bindAll(
  root: ParentNode,
  engine: Engine,
  navigate: (url: string) => void = (url) => location.assign(url),
): Bindings {
  const context = new BindContext(engine);
  const renders: Render[] = [];

  const bind = (node: ParentNode): Render[] => {
    const added = [
      ...bindBundleSelectors(node, context),
      ...bindPackageToggles(node, context),
      ...bindAddToCart(node, context, navigate),
      ...bindCartControls(node, context),
      ...bindLinks(node, context),
      ...bindCartSummary(node, context),
      ...bindDisplay(node, context),
    ];
    renders.push(...added);
    return added;
  };

  const render = () => renders.forEach((r) => r());

  engine.subscribe(render);
  bind(root);
  render();

  return {
    render,
    bind: (node) => bind(node).forEach((r) => r()),
  };
}

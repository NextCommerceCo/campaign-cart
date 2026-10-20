import type { Engine } from '../engine/engine';
import { bindAddToCart } from './add-to-cart';
import { bindBundleSelectors } from './bundle-selector';
import { BindContext, type Render } from './context';
import { bindDisplay } from './display';
import { bindPackageToggles } from './package-toggle';

export interface Bindings {
  context: BindContext;
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

  const bind = (node: ParentNode) => {
    renders.push(
      ...bindBundleSelectors(node, context),
      ...bindPackageToggles(node, context),
      ...bindAddToCart(node, context, navigate),
      ...bindDisplay(node, context),
    );
  };

  const render = () => renders.forEach((r) => r());

  let queued = false;
  engine.on('*', () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render();
    });
  });

  bind(root);
  render();

  return {
    context,
    render,
    bind(node) {
      const before = renders.length;
      bind(node);
      renders.slice(before).forEach((r) => r());
    },
  };
}

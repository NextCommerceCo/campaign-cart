import { EXPRESS_METHODS } from '../engine/checkout';
import type { Engine } from '../engine/engine';
import { legacyExpressOrder } from '../compat/checkout';
import { EXPRESS_BUTTONS } from './logos';

function button(method: string): HTMLButtonElement {
  const look = EXPRESS_BUTTONS[method]!;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `payment-btn ${look.className}`;
  el.setAttribute('data-next-express-checkout', method);
  el.setAttribute('data-action', 'submit');
  const logo = Object.assign(document.createElement('div'), { className: look.logoClass, innerHTML: look.svg });
  const spinner = Object.assign(document.createElement('div'), {
    className: 'payment-btn-spinner',
    innerHTML: '<div class="spinner"></div>',
  });
  spinner.setAttribute('next-slot', 'spinner');
  el.append(logo, spinner);
  return el;
}

export function expressMethods(engine: Engine): string[] {
  const offered = (engine.getState().campaign?.available_express_payment_methods ?? []).map((m) =>
    m.code.toLowerCase().replace(/-/g, '_'),
  );
  const order = legacyExpressOrder();
  const methods = order ? order.filter((m) => offered.includes(m)) : offered;
  const android = /android/i.test(navigator.userAgent);
  return methods.filter((m) => EXPRESS_METHODS.includes(m) && !(m === 'apple_pay' && android));
}

export function bindExpress(engine: Engine, pay: (method: string) => Promise<void>): () => void {
  const containers = [...document.querySelectorAll<HTMLElement>('[data-next-express-checkout="container"]')];
  if (!containers.length) return () => {};
  const methods = expressMethods(engine);
  const buttons: HTMLButtonElement[] = [];

  for (const container of containers) {
    const host = container.querySelector('[data-next-express-checkout="buttons"]') ?? container;
    if (!methods.length) {
      container.style.display = 'none';
      continue;
    }
    for (const method of methods) {
      const el = button(method);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (el.disabled) return;
        el.classList.add('next-loading');
        void pay(method).finally(() => el.classList.remove('next-loading'));
      });
      host.append(el);
      buttons.push(el);
    }
  }

  return () => {
    const { cart, checkout: state } = engine.getState();
    const empty = !Object.values(cart.groups).some((g) => g.lines.length);
    const busy = state?.status !== 'idle';
    for (const el of buttons) {
      el.disabled = empty || busy;
      el.classList.toggle('next-cart-empty', empty);
    }
  };
}

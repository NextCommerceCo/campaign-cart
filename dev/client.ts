interface DevPage {
  mode: string;
  stubPayments: boolean;
  rules: boolean;
}

const dev = (window as unknown as { __NEXT_DEV__?: DevPage }).__NEXT_DEV__ ?? {
  mode: 'MOCK',
  stubPayments: true,
  rules: true,
};
const API = 'https://campaigns.apps.29next.com';
const RULES = 'https://i18n-rules.nextcommerce.com';
const STUBS: Record<string, string> = {
  [`${API}/js/v1/campaign/`]: '/__dev/stub/next-campaign.js',
  ...(dev.stubPayments && { 'https://payments.29next.com/js/v1/payment.js': '/__dev/stub/payment.js' }),
};

const PRECONNECT = /^https:\/\/(payments\.29next\.com|core\.spreedly\.com)/;

const real = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  const local = url.startsWith(API)
    ? url.replace(API, '/__api')
    : dev.rules && url.startsWith(RULES)
      ? url.replace(RULES, '/__rules')
      : undefined;
  if (!local) return real(input, init);
  return input instanceof Request ? real(new Request(local, input), init) : real(local, init);
};

if (dev.stubPayments) {
  const href = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href')!;
  Object.defineProperty(HTMLLinkElement.prototype, 'href', {
    ...href,
    set(this: HTMLLinkElement, value: string) {
      href.set!.call(this, PRECONNECT.test(value) ? location.origin : value);
    },
  });
}

if (dev.rules) {
  const image = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...image,
    set(this: HTMLImageElement, value: string) {
      image.set!.call(this, value.startsWith(RULES) ? value.replace(RULES, '/__rules') : value);
    },
  });
}

const src = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')!;
Object.defineProperty(HTMLScriptElement.prototype, 'src', {
  ...src,
  set(this: HTMLScriptElement, value: string) {
    const stub = Object.entries(STUBS).find(([prefix]) => value.startsWith(prefix))?.[1];
    src.set!.call(this, stub ?? value);
  },
});

addEventListener('DOMContentLoaded', () => {
  const badge = Object.assign(document.createElement('a'), {
    href: '/',
    textContent: dev.mode,
    title: 'Campaign SDK test mode',
  });
  const color = dev.mode === 'FULL' ? '#c51a00' : dev.mode === 'MOCK' ? '#555' : '#0b62d6';
  Object.assign(badge.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    zIndex: '2147483646',
    background: color,
    color: '#fff',
    font: '600 11px/1 system-ui',
    padding: '6px 9px',
    borderRadius: '999px',
    textDecoration: 'none',
    opacity: '.85',
  });
  document.body.append(badge);
});

const luhn = (digits: string) =>
  digits
    .split('')
    .reverse()
    .reduce((sum, d, i) => sum + (i % 2 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][Number(d)]! : Number(d)), 0) %
    10 ===
  0;

type Handlers = {
  onReady(): void;
  onFieldStateChange(state: object): void;
  onValidation(payload: object): void;
  onError(error: unknown): void;
  onTokenized(result: unknown): void;
};

class DevNextPayment implements Handlers {
  onReady = () => {};
  onFieldStateChange = (_: object) => {};
  onValidation = (_: object) => {};
  onError = (_: unknown) => {};
  onTokenized = (_: unknown) => {};
  private number: HTMLInputElement;
  private cvv: HTMLInputElement;

  constructor(options: { numberEl: string; cvvEl: string; placeholder?: { number?: string; cvv?: string } }) {
    this.number = this.mount(options.numberEl, options.placeholder?.number ?? 'Card Number', 'cc-number');
    this.cvv = this.mount(options.cvvEl, options.placeholder?.cvv ?? 'CVV', 'cc-csc');
    setTimeout(() => this.onReady(), 50);
  }

  private mount(id: string, placeholder: string, autocomplete: string): HTMLInputElement {
    const input = Object.assign(document.createElement('input'), { placeholder, autocomplete, inputMode: 'numeric' });
    Object.assign(input.style, {
      border: '0',
      outline: '0',
      width: '100%',
      height: '100%',
      background: 'transparent',
      font: 'inherit',
    });
    document.getElementById(id)?.replaceChildren(input);
    const field = id.includes('cvv') ? 'cvv' : 'number';
    for (const action of ['input', 'focus', 'blur']) input.addEventListener(action, () => this.report(field, action));
    return input;
  }

  private state() {
    const number = this.number.value.replace(/\D/g, '');
    const cvv = this.cvv.value.replace(/\D/g, '');
    return {
      numberLength: number.length,
      cvvLength: cvv.length,
      validNumber: number.length >= 13 && number.length <= 19 && luhn(number),
      validCvv: cvv.length === 3 || cvv.length === 4,
    };
  }

  private report(field: string, action: string) {
    this.onFieldStateChange({ ...this.state(), field, action });
  }

  submit() {
    const state = this.state();
    const errors = [
      ...(state.validNumber ? [] : [{ attribute: 'number', message: 'Card number is invalid' }]),
      ...(state.validCvv ? [] : [{ attribute: 'cvv', message: 'CVV is invalid' }]),
    ];
    if (errors.length) return void setTimeout(() => this.onValidation({ errors }), 100);
    const decline = this.number.value.replace(/\D/g, '') === '4000000000000002';
    setTimeout(
      () => this.onTokenized({ tokenResponse: { payment_method: { token: decline ? 'dev_tok_decline' : 'dev_tok' } } }),
      300,
    );
  }

  destroy() {}
}

if (dev.stubPayments) {
  (window as unknown as { __devNextPayment: unknown }).__devNextPayment = DevNextPayment;
  (window as unknown as { NextPayment: unknown }).NextPayment = DevNextPayment;
}
console.info(`[dev] Campaign SDK test page: ${dev.mode}`);

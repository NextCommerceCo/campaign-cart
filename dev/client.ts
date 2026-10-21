const API = 'https://campaigns.apps.29next.com';
const RULES = 'https://i18n-rules.nextcommerce.com';
const STUBS: Record<string, string> = {
  'https://payments.29next.com/js/v1/payment.js': '/__dev/stub/payment.js',
  [`${API}/js/v1/campaign/`]: '/__dev/stub/next-campaign.js',
};

const real = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith(API)) return real(url.replace(API, '/__mock/api'), init);
  if (url.startsWith(RULES)) return real(url.replace(RULES, '/__mock/rules'), init);
  return real(input, init);
};

const src = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')!;
Object.defineProperty(HTMLScriptElement.prototype, 'src', {
  ...src,
  set(this: HTMLScriptElement, value: string) {
    const stub = Object.entries(STUBS).find(([prefix]) => value.startsWith(prefix))?.[1];
    src.set!.call(this, stub ?? value);
  },
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

(window as unknown as { __devNextPayment: unknown }).__devNextPayment = DevNextPayment;
(window as unknown as { NextPayment: unknown }).NextPayment = DevNextPayment;
console.info('[dev] Campaign SDK from source; API, i18n-rules and payment.js are local');

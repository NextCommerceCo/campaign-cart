import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NextPaymentTokenizer,
  cssTextToStyle,
  normalizeNextPaymentError,
} from '../next-payment';
import type {
  CardTokenizerEvents,
  HostedFieldsMount,
} from '../card-tokenizer.types';

/** What the page script gets back from `new NextPayment(…)`, with its setters recorded. */
interface FakeInstance {
  options: Record<string, unknown>;
  onReady: () => void;
  onValidation: (payload: { errors?: unknown[] }) => void;
  onError: (error: unknown) => void;
  onTokenized: (result: unknown) => void;
  onFieldStateChange: (payload: unknown) => void;
  submit: ReturnType<typeof vi.fn>;
  setFocus: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

let instances: FakeInstance[];

const MOUNT: HostedFieldsMount = {
  numberId: 'spreedly-number',
  cvvId: 'spreedly-cvv',
  labels: { number: 'Card number', cvv: 'Security code' },
  placeholders: { number: 'Card Number', cvv: 'CVV *' },
  titles: { number: 'Enter your card number', cvv: 'Enter the code' },
};

function events(): CardTokenizerEvents & {
  [K in keyof CardTokenizerEvents]: ReturnType<typeof vi.fn>;
} {
  return {
    onReady: vi.fn(),
    onFieldState: vi.fn(),
    onError: vi.fn(),
    onToken: vi.fn(),
  };
}

async function mounted(config = {}) {
  const tokenizer = new NextPaymentTokenizer('env-key', config);
  const handlers = events();
  await tokenizer.mount(MOUNT, handlers);
  const instance = instances.at(-1);
  if (!instance) throw new Error('NextPayment was never constructed');
  instance.onReady();
  return { tokenizer, handlers, instance };
}

const CARD = { full_name: 'Ada Lovelace', month: '05', year: '2030' };

beforeEach(() => {
  instances = [];
  window.NextPayment = function (this: FakeInstance, options: unknown) {
    this.options = options as Record<string, unknown>;
    this.submit = vi.fn();
    this.setFocus = vi.fn();
    this.destroy = vi.fn();
    instances.push(this);
  } as unknown as typeof window.NextPayment;
});

afterEach(() => {
  delete window.NextPayment;
});

describe('NextPaymentTokenizer — the outcome of a tokenize attempt', () => {
  it('ends an attempt NextPayment rejects itself, which no onError follows', async () => {
    const { tokenizer, handlers, instance } = await mounted();
    tokenizer.tokenize(CARD);

    instance.onValidation({
      errors: [
        {
          attribute: 'year',
          key: 'errors.required',
          message: 'Expiry year is required',
        },
      ],
    });

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError).toHaveBeenCalledWith([
      {
        field: 'year',
        textKey: 'payment.card.expiry_year.errors.blank',
        message: 'Expiry year is required',
      },
    ]);
  });

  it('ends a rejected card number with its field errors, not the string that echoes them', async () => {
    const { tokenizer, handlers, instance } = await mounted();
    tokenizer.tokenize(CARD);

    instance.onValidation({
      errors: [
        {
          attribute: 'number',
          key: 'errors.invalid',
          message: 'Card number is invalid',
        },
      ],
    });
    expect(handlers.onError).not.toHaveBeenCalled();

    instance.onError('Card number must be between 13 and 19 digits');

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError).toHaveBeenCalledWith([
      {
        field: 'number',
        textKey: 'payment.card.number.errors.invalid',
        message: 'Card number is invalid',
      },
    ]);
  });

  it("hands back the payment method's token, not the transaction's", async () => {
    const { tokenizer, handlers, instance } = await mounted();
    tokenizer.tokenize(CARD);

    const paymentMethod = { token: 'pm-token', last_four_digits: '1111' };
    instance.onTokenized({
      message: 'Token generated',
      tokenResponse: {
        token: 'transaction-token',
        payment_method: paymentMethod,
      },
    });

    expect(handlers.onToken).toHaveBeenCalledWith('pm-token', paymentMethod);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('fails an attempt whose response carries no payment method token', async () => {
    const { tokenizer, handlers, instance } = await mounted();
    tokenizer.tokenize(CARD);

    instance.onTokenized({ tokenResponse: { token: 'transaction-token' } });

    expect(handlers.onToken).not.toHaveBeenCalled();
    expect(handlers.onError).toHaveBeenCalledWith([
      expect.objectContaining({ textKey: 'payment.errors.generic' }),
    ]);
  });

  it('sends a copy of the cardholder data, since submit() writes to it', async () => {
    const { tokenizer, instance } = await mounted();
    tokenizer.tokenize(CARD);

    expect(instance.submit).toHaveBeenCalledWith(CARD);
    expect(instance.submit.mock.calls[0]?.[0]).not.toBe(CARD);
  });
});

describe('NextPaymentTokenizer — the hosted fields between attempts', () => {
  it('reports each field empty, invalid or valid from a validation outside an attempt', async () => {
    const { handlers, instance } = await mounted();

    instance.onValidation({
      errors: [
        {
          attribute: 'number',
          key: 'errors.invalid',
          message: 'Card number is required',
        },
      ],
    });

    expect(handlers.onFieldState).toHaveBeenCalledWith({
      field: 'number',
      action: 'input',
      valid: false,
      hasValue: false,
    });
    expect(handlers.onFieldState).toHaveBeenCalledWith({
      field: 'cvv',
      action: 'input',
      valid: true,
      hasValue: true,
    });
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('passes a failure outside any attempt straight through', async () => {
    const { handlers, instance } = await mounted();

    instance.onError({ message: 'CVV expired', reason: 'ttl' });

    expect(handlers.onError).toHaveBeenCalledWith([
      { textKey: 'payment.errors.session_expired', message: 'CVV expired' },
    ]);
  });

  it('forwards focus and blur, and nothing else a field state change carries', async () => {
    const { handlers, instance } = await mounted();

    instance.onFieldStateChange({ field: 'cvv', action: 'focus' });
    instance.onFieldStateChange({ field: 'cvv', action: 'mouseover' });
    instance.onFieldStateChange({ field: 'iframe', action: 'blur' });

    expect(handlers.onFieldState).toHaveBeenCalledTimes(1);
    expect(handlers.onFieldState).toHaveBeenCalledWith({
      field: 'cvv',
      action: 'focus',
    });
  });

  it('ignores a ready from the instance a reset replaced', async () => {
    const { tokenizer, handlers, instance } = await mounted();
    handlers.onReady.mockClear();

    tokenizer.reset();

    expect(instance.destroy).toHaveBeenCalled();
    instance.onReady();
    expect(handlers.onReady).not.toHaveBeenCalled();
    instances.at(-1)?.onReady();
    expect(handlers.onReady).toHaveBeenCalledTimes(1);
  });

  it('mounts with the texts and a CSS-string style turned into properties', async () => {
    const { instance } = await mounted({
      styles: { number: 'font-size: 1rem; color: #333' },
    });

    expect(instance.options).toMatchObject({
      numberEl: 'spreedly-number',
      cvvEl: 'spreedly-cvv',
      labels: MOUNT.labels,
      placeholder: MOUNT.placeholders,
      titles: MOUNT.titles,
      styling: { number: { fontSize: '1rem', color: '#333' } },
    });
  });
});

describe('normalizeNextPaymentError', () => {
  it.each([
    ['a string', 'Please wait', 'payment.errors.generic', 'Please wait'],
    [
      'a { message, reason }',
      { message: 'timed out', reason: 'cvv_ttl' },
      'payment.errors.session_expired',
      'timed out',
    ],
    [
      'a { message }',
      { message: 'no recache' },
      'payment.errors.generic',
      'no recache',
    ],
  ])('reads %s', (_, error, textKey, message) => {
    expect(normalizeNextPaymentError(error)).toEqual([{ textKey, message }]);
  });

  it('reads a gateway response field by field', () => {
    expect(
      normalizeNextPaymentError({
        errors: [
          { attribute: 'month', key: 'errors.expired', message: 'expired' },
          { attribute: 'first_name', key: 'errors.blank', message: 'blank' },
        ],
      })
    ).toEqual([
      {
        field: 'month',
        textKey: 'payment.card.expiry_month.errors.expired',
        message: 'expired',
      },
      {
        field: 'full_name',
        textKey: 'payment.card.name.errors.blank',
        message: 'blank',
      },
    ]);
  });

  it.each([undefined, null, 42, {}, { errors: [] }])(
    'answers %j with a generic error rather than nothing',
    error => {
      expect(normalizeNextPaymentError(error)).toEqual([
        expect.objectContaining({ textKey: 'payment.errors.generic' }),
      ]);
    }
  );
});

describe('cssTextToStyle', () => {
  it('camel-cases each property and keeps a ; inside quotes or parentheses', () => {
    expect(
      cssTextToStyle(
        'font-family: "A; B", serif; background-image: url(a;b.png); color:#fff;'
      )
    ).toEqual({
      fontFamily: '"A; B", serif',
      backgroundImage: 'url(a;b.png)',
      color: '#fff',
    });
  });

  it('drops a declaration with no property or no value', () => {
    expect(cssTextToStyle('color:; : red; width: 100%')).toEqual({
      width: '100%',
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CREDENTIALS_TTL_MS,
  NextPaymentTokenizer,
  cssTextToStyle,
  normalizeNextPaymentError,
} from '../next-payment';
import type {
  CardTokenizerEvents,
  HostedFieldsMount,
} from '../card-tokenizer.types';
import { useCampaignStore } from '@/state/campaign';
import type { Campaign } from '@/types/campaign';

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

/** Every tokenizer a test mounts, destroyed after it so its tab listener goes too. */
const live: NextPaymentTokenizer[] = [];

async function mounted(config = {}) {
  const tokenizer = new NextPaymentTokenizer('env-key', config);
  live.push(tokenizer);
  const handlers = events();
  await tokenizer.mount(MOUNT, handlers);
  const instance = instances.at(-1);
  if (!instance) throw new Error('NextPayment was never constructed');
  instance.onReady();
  return { tokenizer, handlers, instance };
}

const CARD = { full_name: 'Ada Lovelace', month: '05', year: '2030' };

/** A field state change as NextPayment sends it, captured from the live demo. */
function fieldState(overrides: Record<string, unknown> = {}) {
  return {
    cardType: 'visa',
    cvvLength: 3,
    luhnValid: false,
    numberLength: 16,
    validCvv: true,
    validNumber: false,
    action: 'mouseover',
    field: 'cvv',
    focused: false,
    hovered: true,
    ...overrides,
  };
}

const FakeNextPayment = function (this: FakeInstance, options: unknown) {
  this.options = options as Record<string, unknown>;
  this.submit = vi.fn();
  this.setFocus = vi.fn();
  this.destroy = vi.fn();
  instances.push(this);
} as unknown as typeof window.NextPayment;

beforeEach(() => {
  instances = [];
  window.NextPayment = FakeNextPayment;
});

afterEach(() => {
  live.splice(0).forEach(tokenizer => tokenizer.destroy());
  useCampaignStore.setState({ data: null });
  delete window.NextPayment;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('NextPaymentTokenizer — the outcome of a tokenize attempt', () => {
  it('ends an attempt NextPayment rejects itself, which no onError follows', async () => {
    const { tokenizer, handlers, instance } = await mounted();
    tokenizer.tokenize({ ...CARD, year: '' });

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
    instance.onFieldStateChange(
      fieldState({ action: 'input', field: 'number' })
    );
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

    instance.onError('Invalid card number');

    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError).toHaveBeenCalledWith([
      {
        field: 'number',
        textKey: 'payment.card.number.errors.invalid',
        message: 'Card number is invalid',
      },
    ]);
  });

  it('names an empty number blank from its length, whatever the message says', async () => {
    const { tokenizer, handlers, instance } = await mounted();
    instance.onFieldStateChange(
      fieldState({ action: 'input', field: 'number', numberLength: 0 })
    );
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
    instance.onError('Card number must be between 13 and 19 digits');

    expect(handlers.onError).toHaveBeenCalledWith([
      expect.objectContaining({ textKey: 'payment.card.number.errors.blank' }),
    ]);
  });

  it.each([
    ['', 'payment.card.expiry_month.errors.blank'],
    ['13', 'payment.card.expiry_month.errors.invalid'],
  ])('names a month of %j from what was submitted', async (month, textKey) => {
    const { tokenizer, handlers, instance } = await mounted();
    tokenizer.tokenize({ ...CARD, month });

    instance.onValidation({
      errors: [
        { attribute: 'month', key: 'errors.invalid', message: 'Expiry month' },
      ],
    });

    expect(handlers.onError).toHaveBeenCalledWith([
      expect.objectContaining({ field: 'month', textKey }),
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

    expect(instance.submit).toHaveBeenCalledWith(CARD, expect.anything());
    expect(instance.submit.mock.calls[0]?.[0]).not.toBe(CARD);
  });

  it('stores which SDK, version and page made the token, without the query string', async () => {
    window.history.replaceState(null, '', '/checkout?email=ada%40example.test');
    const { tokenizer, instance } = await mounted();
    tokenizer.tokenize(CARD);

    const { metadata } = instance.submit.mock.calls[0]?.[1] as {
      metadata: Record<string, string>;
    };
    expect(Object.keys(metadata).sort()).toEqual([
      'page',
      'sdk_version',
      'source',
    ]);
    expect(metadata['source']).toBe('next-campaign-cart');
    expect(metadata['sdk_version']).toMatch(/^\d+\.\d+\.\d+/);
    expect(metadata['page']).toBe(`${window.location.origin}/checkout`);
  });

  it('stores the campaign id when the campaign response carries one', async () => {
    useCampaignStore.setState({ data: { id: 42 } as unknown as Campaign });
    const { tokenizer, instance } = await mounted();
    tokenizer.tokenize(CARD);

    const { metadata } = instance.submit.mock.calls[0]?.[1] as {
      metadata: Record<string, string>;
    };
    expect(metadata['campaign_id']).toBe('42');
  });
});

describe('NextPaymentTokenizer — the hosted fields between attempts', () => {
  it('clears an error only on a keystroke, and keeps both fields current on every event', async () => {
    const { handlers, instance } = await mounted();

    instance.onFieldStateChange(
      fieldState({ action: 'mouseover', field: 'cvv' })
    );
    expect(handlers.onFieldState.mock.calls.map(([s]: unknown[]) => s)).toEqual(
      [
        { field: 'number', action: 'validation', hasValue: true, valid: false },
        { field: 'cvv', action: 'validation', hasValue: true, valid: true },
      ]
    );

    handlers.onFieldState.mockClear();
    instance.onFieldStateChange(
      fieldState({ action: 'input', field: 'number', validNumber: true })
    );
    expect(handlers.onFieldState.mock.calls.map(([s]: unknown[]) => s)).toEqual(
      [
        { field: 'number', action: 'input', hasValue: true, valid: true },
        { field: 'cvv', action: 'validation', hasValue: true, valid: true },
      ]
    );
  });

  it('ignores a validation outside an attempt', async () => {
    const { handlers, instance } = await mounted();

    instance.onValidation({
      errors: [
        { attribute: 'number', key: 'errors.invalid', message: 'invalid' },
      ],
    });

    expect(handlers.onFieldState).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('passes a failure outside any attempt straight through', async () => {
    const { handlers, instance } = await mounted();

    instance.onError({ message: 'CVV expired', reason: 'ttl' });

    expect(handlers.onError).toHaveBeenCalledWith([
      {
        textKey: 'payment.card.errors.session_expired',
        message: 'CVV expired',
      },
    ]);
  });

  it('forwards focus and blur, and ignores an event about neither hosted field', async () => {
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
      'payment.card.errors.session_expired',
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

describe('NextPaymentTokenizer — credentials that expire', () => {
  /** The `<script>` tags a load asked for, kept out of the document so none is fetched. */
  let requested: HTMLScriptElement[];

  beforeEach(() => {
    requested = [];
    vi.spyOn(document.head, 'appendChild').mockImplementation(node => {
      requested.push(node as HTMLScriptElement);
      return node;
    });
  });

  /** The `<script>` a fresh load appends, answered as the browser would. */
  function answerScriptLoad(): void {
    const script = requested.at(-1);
    if (!script) throw new Error('no script was requested');
    expect(script.src).toMatch(
      /^https:\/\/payments\.29next\.com\/js\/v1\/payment\.js/
    );
    expect(script.src).toContain('env_key=env-key');
    window.NextPayment = FakeNextPayment;
    script.onload?.(new Event('load'));
  }

  it('rebuilds the fields from a fresh script instead of tokenizing with old credentials', async () => {
    vi.useFakeTimers();
    const { tokenizer, handlers, instance } = await mounted();
    vi.advanceTimersByTime(CREDENTIALS_TTL_MS + 1);

    tokenizer.tokenize(CARD);

    expect(instance.submit).not.toHaveBeenCalled();
    expect(handlers.onError).toHaveBeenCalledWith([
      expect.objectContaining({
        textKey: 'payment.card.errors.session_expired',
      }),
    ]);
    expect(instance.destroy).toHaveBeenCalled();
    // The old class is gone, or the new script would keep it.
    expect(window.NextPayment).toBeUndefined();

    answerScriptLoad();
    await vi.waitFor(() => expect(instances).toHaveLength(2));
    instances[1]?.onReady();
    tokenizer.tokenize(CARD);
    expect(instances[1]?.submit).toHaveBeenCalledWith(CARD, expect.anything());
  });

  it('asks for the card again when it is tokenized mid-rebuild', async () => {
    vi.useFakeTimers();
    const { tokenizer, handlers } = await mounted();
    vi.advanceTimersByTime(CREDENTIALS_TTL_MS + 1);
    tokenizer.tokenize(CARD);
    handlers.onError.mockClear();

    tokenizer.tokenize(CARD);

    expect(handlers.onError).toHaveBeenCalledWith([
      expect.objectContaining({
        textKey: 'payment.card.errors.session_expired',
      }),
    ]);
    expect(requested).toHaveLength(1);
  });

  it('rebuilds stale fields when the shopper comes back to the tab', async () => {
    vi.useFakeTimers();
    const { instance } = await mounted();
    vi.advanceTimersByTime(CREDENTIALS_TTL_MS + 1);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(instance.destroy).toHaveBeenCalled();
    answerScriptLoad();
    await vi.waitFor(() => expect(instances).toHaveLength(2));
  });

  it('leaves fresh fields alone when the shopper comes back to the tab', async () => {
    vi.useFakeTimers();
    const { instance } = await mounted();
    vi.advanceTimersByTime(CREDENTIALS_TTL_MS - 1000);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(instance.destroy).not.toHaveBeenCalled();
    expect(requested).toEqual([]);
  });

  it('stops watching the tab once destroyed', async () => {
    vi.useFakeTimers();
    const { tokenizer } = await mounted();
    tokenizer.destroy();
    vi.advanceTimersByTime(CREDENTIALS_TTL_MS + 1);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(requested).toEqual([]);
  });

  it('says the card form could not load when the fresh script fails', async () => {
    vi.useFakeTimers();
    const { tokenizer, handlers } = await mounted();
    vi.advanceTimersByTime(CREDENTIALS_TTL_MS + 1);
    tokenizer.tokenize(CARD);
    handlers.onError.mockClear();

    requested.at(-1)?.onerror?.(new Event('error'));

    await vi.waitFor(() =>
      expect(handlers.onError).toHaveBeenCalledWith([
        expect.objectContaining({ textKey: 'payment.card.errors.network' }),
      ])
    );
  });
});

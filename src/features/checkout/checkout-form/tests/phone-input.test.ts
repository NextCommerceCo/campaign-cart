import { describe, it, expect, vi, afterEach } from 'vitest';

import type { PhoneNumberResult, PhoneRules } from '@/core/country-service';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import {
  awaitPhoneRules,
  initializePhoneInputs,
  phoneFieldFor,
  showPhoneVerdict,
  type PhoneField,
  type PhoneInputContext,
} from '../phone-input';

// Copied from the address-rules service's country files (i18n-rules `src/rules/*.json`),
// as `src/core/tests/country-service.phone.test.ts` does.
const US: PhoneRules = {
  calling_code: '1',
  national_prefix: '1',
  masks: [{ mask: '(###) ###-####' }],
  pattern: '^[0-9]{10,11}$',
  example: '(201) 555-0123',
};
const TH: PhoneRules = {
  calling_code: '66',
  national_prefix: '0',
  masks: [
    { start: '02', mask: '## ### ####' },
    { start: '0[3-57]', mask: '### ### ###' },
    { start: '1', mask: '#### ### ###' },
    { mask: '### ### ####' },
  ],
  pattern: '^[0-9]{8,14}$',
  example: '081 234 5678',
};
const GB: PhoneRules = {
  calling_code: '44',
  national_prefix: '0',
  masks: [{ mask: '##### ######' }],
  pattern: '^[0-9]{7,11}$',
  example: '07400 123456',
};
const RULES: Record<string, PhoneRules> = { US, TH, GB };

/**
 * A stand-in for the address-rules service: what `POST /v1/validate` answered, from
 * libphonenumber, for the numbers these tests type, keyed by country and the digits and
 * `+` typed. Anything else it reads as not valid.
 */
const READINGS: Record<string, PhoneNumberResult> = {
  'US|4155552671': { valid: true, value: '+14155552671', country: 'US' },
  'US|14155552671': { valid: true, value: '+14155552671', country: 'US' },
  'US|+14155552671': { valid: true, value: '+14155552671', country: 'US' },
  'GB|+14155552671': { valid: true, value: '+14155552671', country: 'US' },
  'TH|0812345678': { valid: true, value: '+66812345678', country: 'TH' },
  'TH|00166812345678': { valid: true, value: '+66812345678', country: 'TH' },
  'US|+66812345678': { valid: true, value: '+66812345678', country: 'TH' },
  'GB|07400123456': { valid: true, value: '+447400123456', country: 'GB' },
  'GB|02079460958': { valid: true, value: '+442079460958', country: 'GB' },
  'US|+447400123456': { valid: true, value: '+447400123456', country: 'GB' },
  'US|011447400123456': { valid: true, value: '+447400123456', country: 'GB' },
};

function readPhoneNumber(
  number: string,
  country: string
): Promise<PhoneNumberResult | undefined> {
  const key = `${country}|${number.replace(/[^\d+]/g, '')}`;
  return Promise.resolve(READINGS[key] ?? { valid: false });
}

function makeLogger(): { logger: Logger; errorSpy: ReturnType<typeof vi.fn> } {
  const errorSpy = vi.fn();
  const logger = {
    error: errorSpy,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
  return { logger, errorSpy };
}

/** A phone input inside its own field wrapper, attached so it can take focus. */
function phoneInput(attributes: Record<string, string> = {}): HTMLInputElement {
  const wrapper = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'tel';
  for (const [name, value] of Object.entries(attributes)) {
    input.setAttribute(name, value);
  }
  wrapper.appendChild(input);
  document.body.appendChild(wrapper);
  return input;
}

function countrySelect(...codes: string[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.innerHTML = codes
    .map(code => `<option value="${code}">${code}</option>`)
    .join('');
  document.body.appendChild(select);
  return select;
}

function chooseCountry(select: HTMLSelectElement, code: string): void {
  select.value = code;
  select.dispatchEvent(new Event('change'));
}

function makeCtx(
  overrides: Partial<PhoneInputContext> = {}
): PhoneInputContext {
  return {
    fields: new Map(),
    billingFields: new Map(),
    phoneInputs: new Map(),
    detectedCountryCode: 'US',
    loadPhoneRules: code => Promise.resolve(RULES[code]),
    readPhoneNumber,
    updateFormData: vi.fn(),
    logger: makeLogger().logger,
    ...overrides,
  };
}

/** Builds the shipping field on `input` and waits for its rules. */
async function shippingField(
  input: HTMLInputElement,
  overrides: Partial<PhoneInputContext> = {}
): Promise<{ ctx: PhoneInputContext; field: PhoneField }> {
  const ctx = makeCtx({
    fields: new Map<string, HTMLElement>([['phone', input]]),
    ...overrides,
  });
  initializePhoneInputs(ctx);
  const field = ctx.phoneInputs.get('shipping');
  if (!field) throw new Error('no shipping phone field was built');
  await field.whenReady();
  return { ctx, field };
}

/** Types `text` at the caret, one character per `input` event, as a keyboard does. */
function type(input: HTMLInputElement, text: string): void {
  input.focus();
  for (const char of text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + char + input.value.slice(end);
    input.setSelectionRange(start + 1, start + 1);
    input.dispatchEvent(
      new InputEvent('input', { inputType: 'insertText', data: char })
    );
  }
}

/** Presses Backspace at the caret. */
function backspace(input: HTMLInputElement): void {
  input.focus();
  const at = input.selectionStart ?? input.value.length;
  const from = Math.max(0, at - 1);
  input.value = input.value.slice(0, from) + input.value.slice(at);
  input.setSelectionRange(from, from);
  input.dispatchEvent(
    new InputEvent('input', { inputType: 'deleteContentBackward' })
  );
}

/** Presses Delete at the caret. */
function forwardDelete(input: HTMLInputElement): void {
  input.focus();
  const at = input.selectionStart ?? input.value.length;
  input.value = input.value.slice(0, at) + input.value.slice(at + 1);
  input.setSelectionRange(at, at);
  input.dispatchEvent(
    new InputEvent('input', { inputType: 'deleteContentForward' })
  );
}

function caretAt(input: HTMLInputElement, offset: number): void {
  input.focus();
  input.setSelectionRange(offset, offset);
}

function flagOf(input: HTMLInputElement): HTMLImageElement | null {
  const flag = input.previousElementSibling;
  return flag instanceof HTMLImageElement ? flag : null;
}

afterEach(() => {
  document.body.innerHTML = '';
  useCheckoutStore.getState().reset();
});

describe('the phone field, as the shopper types', () => {
  it("fills the country's mask as the number is typed", async () => {
    const input = phoneInput();
    await shippingField(input);

    type(input, '415');
    expect(input.value).toBe('(415');
    type(input, '55');
    expect(input.value).toBe('(415) 55');
    type(input, '52671');
    expect(input.value).toBe('(415) 555-2671');
  });

  it('shows a national prefix the mask has no place for before it', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    type(input, '14155552671');

    expect(input.value).toBe('1 (415) 555-2671');
    await field.whenReady();
    expect(field.getNumber()).toBe('+14155552671');
  });

  it('keeps a national prefix the mask holds, and the service drops it from E.164', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input, { detectedCountryCode: 'TH' });

    type(input, '0812345678');

    expect(input.value).toBe('081 234 5678');
    await field.whenReady();
    expect(field.getNumber()).toBe('+66812345678');
  });

  it('keeps the caret after a digit typed into the middle', async () => {
    const input = phoneInput();
    await shippingField(input);
    type(input, '415555267');
    expect(input.value).toBe('(415) 555-267');

    caretAt(input, 4); // after "(415"
    type(input, '9');

    expect(input.value).toBe('(415) 955-5267');
    expect(input.selectionStart).toBe(7); // after the 9
  });

  it('steps back over a separator on Backspace, then takes the digit before it', async () => {
    const input = phoneInput();
    await shippingField(input);
    type(input, '4155552671');

    caretAt(input, 10); // after the "-"
    backspace(input);
    expect(input.value).toBe('(415) 555-2671');
    expect(input.selectionStart).toBe(9); // before the "-"

    backspace(input);
    expect(input.value).toBe('(415) 552-671');
    expect(input.selectionStart).toBe(8);
  });

  it('steps over a separator on Delete, then takes the digit after it', async () => {
    const input = phoneInput();
    await shippingField(input);
    type(input, '4155552671');

    caretAt(input, 9); // before the "-"
    forwardDelete(input);
    expect(input.value).toBe('(415) 555-2671');
    expect(input.selectionStart).toBe(10); // after the "-"

    forwardDelete(input);
    expect(input.value).toBe('(415) 555-671');
    expect(input.selectionStart).toBe(10);
  });

  it('drops a letter rather than showing it', async () => {
    const input = phoneInput();
    await shippingField(input);

    type(input, '415a');

    expect(input.value).toBe('(415');
  });

  it('writes the text to the checkout store, then the E.164 number the service reads', async () => {
    const input = phoneInput();
    const { ctx, field } = await shippingField(input);

    type(input, '4155552671');
    expect(ctx.updateFormData).toHaveBeenLastCalledWith({
      phone: '(415) 555-2671',
    });

    await field.whenReady();
    expect(ctx.updateFormData).toHaveBeenLastCalledWith({
      phone: '+14155552671',
    });
  });

  it("checks the number against the country's loose pattern", async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    type(input, '415555267');
    expect(field.isValidNumber()).toBe(false);
    type(input, '1');
    expect(field.isValidNumber()).toBe(true);
  });

  /** The form's prefill writes the input without an event; the field still reads it. */
  it('reads a number written into the input by script once asked', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    input.value = '(415) 555-2671';
    await field.whenReady();

    expect(field.getNumber()).toBe('+14155552671');
    expect(field.isValidNumber()).toBe(true);
  });

  it('writes the billing number onto the billing address', async () => {
    const input = phoneInput();
    const ctx = makeCtx({
      billingFields: new Map<string, HTMLElement>([
        ['billing-phone', input],
        ['billing-country', countrySelect('GB')],
      ]),
    });
    initializePhoneInputs(ctx);
    await ctx.phoneInputs.get('billing')?.whenReady();

    type(input, '07400123456');
    await ctx.phoneInputs.get('billing')?.whenReady();

    expect(input.value).toBe('07400 123456');
    expect(input.getAttribute('data-next-phone-country')).toBe('GB');
    expect(useCheckoutStore.getState().billingAddress?.phone).toBe(
      '+447400123456'
    );
  });

  it('writes Thai and full-width digits typed one by one as ASCII, in order', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input, { detectedCountryCode: 'TH' });

    type(input, '๐๘๑๒๓๔๕๖๗๘');
    expect(input.value).toBe('081 234 5678');

    input.value = '';
    type(input, '０８１２３４５６７８');
    expect(input.value).toBe('081 234 5678');
    await field.whenReady();
    expect(field.getNumber()).toBe('+66812345678');
  });
});

describe('the phone field, and the country', () => {
  it('starts on the address country, and follows it when it changes', async () => {
    const input = phoneInput();
    const select = countrySelect('US', 'GB');
    const { field } = await shippingField(input, {
      fields: new Map<string, HTMLElement>([
        ['phone', input],
        ['country', select],
      ]),
    });
    expect(input.getAttribute('data-next-phone-country')).toBe('US');
    type(input, '02079460958');

    chooseCountry(select, 'GB');
    await field.whenReady();

    expect(input.getAttribute('data-next-phone-country')).toBe('GB');
    expect(flagOf(input)?.src).toBe(
      'https://i18n-rules.nextcommerce.com/v1/flags/gb.svg'
    );
    expect(input.value).toBe('02079 460958');
    expect(field.getNumber()).toBe('+442079460958');
  });

  it('uses the detected country while the address country has no value', async () => {
    const input = phoneInput();
    const select = countrySelect('', 'GB');
    const { field } = await shippingField(input, {
      fields: new Map<string, HTMLElement>([
        ['phone', input],
        ['country', select],
      ]),
      detectedCountryCode: 'TH',
    });
    expect(input.getAttribute('data-next-phone-country')).toBe('TH');

    chooseCountry(select, 'GB');
    chooseCountry(select, '');
    await field.whenReady();

    expect(input.getAttribute('data-next-phone-country')).toBe('TH');
  });

  it('drops the rules of a country left before they arrived', async () => {
    let deliverUS: (rules: PhoneRules) => void = () => {};
    const input = phoneInput();
    const select = countrySelect('US', 'GB');
    const ctx = makeCtx({
      fields: new Map<string, HTMLElement>([
        ['phone', input],
        ['country', select],
      ]),
      loadPhoneRules: code =>
        code === 'US'
          ? new Promise(resolve => (deliverUS = resolve))
          : Promise.resolve(RULES[code]),
    });
    initializePhoneInputs(ctx);
    const field = ctx.phoneInputs.get('shipping');

    chooseCountry(select, 'GB');
    await field?.whenReady();
    deliverUS(US);
    await new Promise(resolve => setTimeout(resolve, 0));
    type(input, '07400123456');
    await field?.whenReady();

    expect(input.value).toBe('07400 123456');
    expect(field?.getNumber()).toBe('+447400123456');
  });

  /** Typing `+44` in a US store no longer moves the flag: it follows the address. */
  it('follows the country the service reads a + number as, whatever the address country', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    type(input, '+66 81 234 5678');
    await field.whenReady();

    expect(input.getAttribute('data-next-phone-country')).toBe('TH');
    expect(input.previousElementSibling?.getAttribute('src')).toMatch(
      /\/th\.svg$/
    );
    expect(field.getNumber()).toBe('+66812345678');
    expect(field.isValidNumber()).toBe(true);
  });

  it('reads a number dialled abroad as the address country dials, whether typed or written in', async () => {
    const reads = vi.fn(readPhoneNumber);
    const thai = phoneInput();
    const fromThailand = await shippingField(thai, {
      detectedCountryCode: 'TH',
      readPhoneNumber: reads,
    });
    type(thai, '001 66 81 234 5678');
    expect(thai.value).toBe('00166812345678');
    await fromThailand.field.whenReady();
    expect(thai.getAttribute('data-next-phone-e164')).toBe('+66812345678');
    expect(thai.getAttribute('data-next-phone-country')).toBe('TH');

    const american = phoneInput();
    const fromUs = await shippingField(american, { readPhoneNumber: reads });
    american.value = '011 44 7400 123456';
    american.dispatchEvent(new Event('change'));
    await fromUs.field.whenReady();
    expect(reads).toHaveBeenLastCalledWith('011447400123456', 'US');
    expect(american.getAttribute('data-next-phone-country')).toBe('GB');
    expect(fromUs.field.getNumber()).toBe('+447400123456');
  });

  it('asks for the address country rules alone, and reads each number once', async () => {
    const loadPhoneRules = vi.fn((code: string) =>
      Promise.resolve(RULES[code])
    );
    const reads = vi.fn(readPhoneNumber);
    const input = phoneInput();
    const { field } = await shippingField(input, {
      loadPhoneRules,
      readPhoneNumber: reads,
    });

    type(input, '+44 7400 123456');
    input.dispatchEvent(new Event('blur'));
    await field.whenReady();
    await field.whenReady();

    expect(field.getNumber()).toBe('+447400123456');
    expect(loadPhoneRules.mock.calls.map(([code]) => code)).toEqual(['US']);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('waits for a pause in the typing before asking, and asks at once on blur', async () => {
    const reads = vi.fn(readPhoneNumber);
    const input = phoneInput();
    await shippingField(input, { readPhoneNumber: reads });

    type(input, '415555');
    expect(reads).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(reads).toHaveBeenCalledWith('(415) 555', 'US')
    );

    type(input, '2671');
    input.dispatchEvent(new Event('blur'));
    expect(reads).toHaveBeenLastCalledWith('(415) 555-2671', 'US');
  });

  it('drops an answer for text the shopper has since changed', async () => {
    let answer: (result: PhoneNumberResult) => void = () => {};
    const input = phoneInput();
    const { field } = await shippingField(input, {
      readPhoneNumber: () => new Promise(resolve => (answer = resolve)),
    });

    input.value = '4155552671';
    input.dispatchEvent(new Event('change'));
    type(input, '9');
    answer({ valid: true, value: '+14155552671', country: 'US' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(field.getNumber()).toBe('');
    expect(input.hasAttribute('data-next-phone-e164')).toBe(false);
  });

  it('shows the number as the service writes it once the shopper leaves the field', async () => {
    const reads = vi.fn((number: string) =>
      Promise.resolve<PhoneNumberResult>(
        number.startsWith('011')
          ? {
              valid: true,
              value: '+447400123456',
              country: 'GB',
              national: '07400 123456',
              international: '+44 7400 123456',
            }
          : {
              valid: true,
              value: '+14155552671',
              country: 'US',
              national: '(415) 555-2671',
              international: '+1 415 555 2671',
            }
      )
    );
    const input = phoneInput();
    const { field } = await shippingField(input, {
      loadPhoneRules: () => Promise.resolve(undefined),
      readPhoneNumber: reads,
    });

    type(input, '4155552671');
    await field.whenReady();
    // Still in the field: what the shopper typed stays.
    expect(input.value).toBe('4155552671');

    input.blur();
    input.dispatchEvent(new Event('blur'));
    await vi.waitFor(() => expect(input.value).toBe('(415) 555-2671'));
    expect(field.getNumber()).toBe('+14155552671');

    input.value = '011 44 7400 123456';
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(input.value).toBe('+44 7400 123456'));
    expect(field.getNumber()).toBe('+447400123456');
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('never refuses a number the service reads as not valid when the loose pattern takes it', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input, {
      readPhoneNumber: () => Promise.resolve({ valid: false }),
    });

    type(input, '4155552671');
    await field.whenReady();

    expect(field.getNumber()).toBe('');
    expect(field.isValidNumber()).toBe(true);
  });

  it('shows the service’s sentence under a number it reads as not valid, once the shopper leaves', async () => {
    const message = 'Enter a valid phone number, like +66 81 234 5678';
    const input = phoneInput();
    await shippingField(input, {
      readPhoneNumber: () =>
        Promise.resolve({ valid: false, error: { code: 'invalid', message } }),
    });
    const verdict = { showError: vi.fn(), clearError: vi.fn() };

    type(input, '+6683873196');
    input.blur();
    await showPhoneVerdict(verdict, 'phone', input);

    expect(verdict.showError).toHaveBeenCalledWith('phone', message);
  });

  it('takes the sentence away once the number is read as valid, and clears nothing it did not show', async () => {
    let answer: PhoneNumberResult = {
      valid: false,
      error: { code: 'invalid', message: 'Enter a valid phone number' },
    };
    const input = phoneInput();
    await shippingField(input, {
      readPhoneNumber: () => Promise.resolve(answer),
    });
    const verdict = { showError: vi.fn(), clearError: vi.fn() };

    type(input, '4155552671');
    input.blur();
    await showPhoneVerdict(verdict, 'phone', input);
    answer = { valid: true, value: '+14155552671', country: 'US' };
    type(input, '9');
    input.blur();
    await showPhoneVerdict(verdict, 'phone', input);
    await showPhoneVerdict(verdict, 'phone', input);

    expect(verdict.showError).toHaveBeenCalledTimes(1);
    expect(verdict.clearError).toHaveBeenCalledTimes(1);
  });

  it('leaves a number the loose pattern refuses to its own message', async () => {
    const input = phoneInput();
    await shippingField(input, {
      readPhoneNumber: () =>
        Promise.resolve({
          valid: false,
          error: { code: 'invalid', message: 'Enter a valid phone number' },
        }),
    });
    const verdict = { showError: vi.fn(), clearError: vi.fn() };

    type(input, '41555');
    input.blur();
    await showPhoneVerdict(verdict, 'phone', input);

    expect(verdict.showError).not.toHaveBeenCalled();
  });

  it('shows nothing while the shopper is back in the field', async () => {
    const input = phoneInput();
    await shippingField(input, {
      readPhoneNumber: () =>
        Promise.resolve({
          valid: false,
          error: { code: 'invalid', message: 'Enter a valid phone number' },
        }),
    });
    const verdict = { showError: vi.fn(), clearError: vi.fn() };

    type(input, '4155552671');
    await showPhoneVerdict(verdict, 'phone', input);

    expect(verdict.showError).not.toHaveBeenCalled();
  });

  it('goes back to the address country when the + number goes', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);
    type(input, '+44 7400 123456');
    await field.whenReady();
    expect(input.getAttribute('data-next-phone-country')).toBe('GB');

    input.value = '';
    type(input, '4155552671');

    expect(input.getAttribute('data-next-phone-country')).toBe('US');
  });

  it('keeps the address country, and has no E.164, while the service cannot answer', async () => {
    const input = phoneInput();
    const { ctx, field } = await shippingField(input, {
      readPhoneNumber: () => Promise.resolve(undefined),
    });

    type(input, '+44 7400 123456');
    await field.whenReady();

    expect(input.getAttribute('data-next-phone-country')).toBe('US');
    expect(field.getNumber()).toBe('');
    // Typed with its own +, so the store still holds it in E.164.
    expect(ctx.updateFormData).toHaveBeenLastCalledWith({
      phone: '+447400123456',
    });
  });

  it('keeps a number typed with + as typed when the address country changes', async () => {
    const input = phoneInput();
    const select = countrySelect('US', 'GB');
    const { field } = await shippingField(input, {
      fields: new Map<string, HTMLElement>([
        ['phone', input],
        ['country', select],
      ]),
    });
    type(input, '+14155552671');

    chooseCountry(select, 'GB');
    await field.whenReady();

    expect(input.value).toBe('+14155552671');
    expect(field.getNumber()).toBe('+14155552671');
  });

  it('keeps the + while nothing follows it yet', async () => {
    const input = phoneInput();
    await shippingField(input);

    type(input, '+');
    expect(input.value).toBe('+');
    expect(input.selectionStart).toBe(1);

    type(input, '4');
    expect(input.value).toBe('+4');
  });

  it('keeps the caret after a + typed in front of a number', async () => {
    const input = phoneInput();
    await shippingField(input);
    type(input, '4155552671');

    caretAt(input, 0);
    type(input, '+');
    expect(input.value).toBe('+4155552671');
    expect(input.selectionStart).toBe(1);

    type(input, '1');
    expect(input.value).toBe('+14155552671');
    expect(input.selectionStart).toBe(2);
  });
});

describe('the phone field, without rules', () => {
  it('is a plain input that judges a national number by the service alone', async () => {
    const input = phoneInput();
    const { ctx, field } = await shippingField(input, {
      loadPhoneRules: () => Promise.resolve(undefined),
    });

    type(input, '(415) 555-2671');

    expect(input.value).toBe('(415) 555-2671');
    expect(field.isValidNumber()).toBeNull();
    expect(field.getNumber()).toBe('');
    expect(ctx.updateFormData).toHaveBeenLastCalledWith({
      phone: '(415) 555-2671',
    });

    await field.whenReady();
    expect(field.isValidNumber()).toBe(true);
    expect(field.getNumber()).toBe('+14155552671');
  });

  it('still stores the E.164 number a shopper typed with +', async () => {
    const input = phoneInput();
    const { ctx, field } = await shippingField(input, {
      loadPhoneRules: () => Promise.resolve(undefined),
    });

    type(input, '+1 415 555 2671');

    expect(ctx.updateFormData).toHaveBeenLastCalledWith({
      phone: '+14155552671',
    });
    expect(field.isValidNumber()).toBeNull();
  });

  it('formats what was typed once the rules arrive', async () => {
    let deliver: (rules: PhoneRules | undefined) => void = () => {};
    const lookup = new Promise<PhoneRules | undefined>(resolve => {
      deliver = resolve;
    });
    const input = phoneInput();
    const ctx = makeCtx({
      fields: new Map<string, HTMLElement>([['phone', input]]),
      loadPhoneRules: () => lookup,
    });
    initializePhoneInputs(ctx);
    const field = ctx.phoneInputs.get('shipping');

    type(input, '4155552671');
    expect(input.value).toBe('4155552671');
    expect(field?.isValidNumber()).toBeNull();

    deliver(US);
    await field?.whenReady();

    expect(input.value).toBe('(415) 555-2671');
    expect(input.selectionStart).toBe(14);
    expect(field?.isValidNumber()).toBe(true);
  });

  it('is a plain input when the rules lookup fails', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input, {
      loadPhoneRules: () => Promise.reject(new Error('offline')),
    });

    type(input, '4155552671');

    expect(input.value).toBe('4155552671');
    expect(field.isValidNumber()).toBeNull();
  });
});

describe('the phone field markup', () => {
  it('puts a flag before the input and marks the input and its parent', async () => {
    const input = phoneInput();
    await shippingField(input);

    const flag = flagOf(input);
    expect(flag?.className).toBe('next-phone-flag');
    expect(flag?.getAttribute('alt')).toBe('');
    expect(flag?.getAttribute('aria-hidden')).toBe('true');
    expect(flag?.getAttribute('width')).toBe('20');
    expect(flag?.getAttribute('height')).toBe('15');
    expect(flag?.hidden).toBe(false);
    expect(flag?.src).toBe(
      'https://i18n-rules.nextcommerce.com/v1/flags/us.svg'
    );
    expect(input.classList.contains('next-phone-input')).toBe(true);
    expect(input.parentElement?.classList.contains('next-phone-field')).toBe(
      true
    );
    expect(input.getAttribute('data-next-phone-country')).toBe('US');
  });

  it('hides the flag when no country is known', async () => {
    const input = phoneInput();
    await shippingField(input, { detectedCountryCode: '' });

    expect(flagOf(input)?.hidden).toBe(true);
    expect(input.hasAttribute('data-next-phone-country')).toBe(false);
  });

  it('marks a required phone in the placeholder', async () => {
    const required = phoneInput({ required: '' });
    const optional = phoneInput();
    await shippingField(required);
    await shippingField(optional);

    expect(required.placeholder).toBe('Phone*');
    expect(optional.placeholder).toBe('Phone (Optional)');
  });

  it('is found from its input', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    expect(phoneFieldFor(input)).toBe(field);
  });
});

describe('the phone field layout', () => {
  /** A ResizeObserver whose callbacks a test can run, since happy-dom does no layout. */
  class FakeResizeObserver {
    static last: FakeResizeObserver | undefined;
    readonly observed: Element[] = [];
    disconnected = false;
    constructor(readonly callback: () => void) {
      FakeResizeObserver.last = this;
    }
    observe(element: Element): void {
      this.observed.push(element);
    }
    disconnect(): void {
      this.disconnected = true;
    }
  }

  interface Box {
    top: number;
    height: number;
    left: number;
    width: number;
    /** The parent's inner width. */
    parentWidth: number;
  }

  /** Gives `input` and its parent the boxes a browser would lay them out with. */
  function layOut(input: HTMLInputElement, box: Box): void {
    const parent = input.parentElement;
    if (!parent) throw new Error('the input needs a parent to be laid out in');
    const measure = (element: Element, name: string, read: () => unknown) => {
      Object.defineProperty(element, name, { configurable: true, get: read });
    };
    measure(input, 'offsetParent', () => parent);
    measure(input, 'offsetTop', () => box.top);
    measure(input, 'offsetHeight', () => box.height);
    measure(input, 'offsetLeft', () => box.left);
    measure(input, 'offsetWidth', () => box.width);
    measure(parent, 'clientWidth', () => box.parentWidth);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.last = undefined;
  });

  /**
   * The form appends an error message to the input's parent. Centred on the parent, the
   * flag dropped below the input the moment a number was refused.
   */
  it('centres the flag on the input, not on its parent', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const input = phoneInput();
    const box = { top: 24, height: 40, left: 0, width: 600, parentWidth: 600 };
    layOut(input, box);
    await shippingField(input);

    expect(flagOf(input)?.style.top).toBe('44px');

    const error = document.createElement('div');
    error.className = 'next-error-label';
    input.parentElement?.appendChild(error);
    FakeResizeObserver.last?.callback();
    expect(flagOf(input)?.style.top).toBe('44px');

    box.top = 48; // a label above the input grew
    FakeResizeObserver.last?.callback();
    expect(flagOf(input)?.style.top).toBe('68px');
  });

  /** An unstyled `<div><input></div>`: the parent is as wide as the page. */
  it('keeps the flag inside an input narrower than its parent', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const input = phoneInput();
    layOut(input, {
      top: 0,
      height: 40,
      left: 16,
      width: 300,
      parentWidth: 800,
    });
    await shippingField(input);

    // 800 - (16 + 300) + 12: the flag's right edge 12px inside the input's.
    expect(flagOf(input)?.style.right).toBe('496px');
  });

  it('watches the input and its parent, and stops when destroyed', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const input = phoneInput();
    const { field } = await shippingField(input);
    const observer = FakeResizeObserver.last;

    expect(observer?.observed).toEqual([input, input.parentElement]);
    field.destroy();
    expect(observer?.disconnected).toBe(true);
  });

  it('leaves the flag to the stylesheet while the input is not laid out', async () => {
    const input = phoneInput(); // happy-dom: no offsetParent, as for a hidden input
    await shippingField(input);

    expect(flagOf(input)?.style.top).toBe('');
    expect(flagOf(input)?.style.right).toBe('');
  });

  /** A page's `.field input { padding: 12px }` outranks a single class; inline does not. */
  it('makes room for the flag inline, and puts the page padding back', async () => {
    const input = phoneInput({ style: 'padding-right: 8px' });
    const plain = phoneInput();
    const { field } = await shippingField(input);
    const { field: other } = await shippingField(plain);

    expect(input.style.paddingRight).toBe('44px');
    expect(plain.style.paddingRight).toBe('44px');

    field.destroy();
    other.destroy();
    expect(input.style.paddingRight).toBe('8px');
    expect(plain.getAttribute('style')).toBeFalsy();
  });
});

describe('the phone field teardown', () => {
  it('takes back everything it added to the page', async () => {
    const input = phoneInput({ placeholder: 'Mobile' });
    const wrapper = input.parentElement;
    wrapper?.classList.add('form-group');
    const { field } = await shippingField(input);

    field.destroy();

    expect(document.querySelector('.next-phone-flag')).toBeNull();
    expect(input.classList.contains('next-phone-input')).toBe(false);
    expect(wrapper?.className).toBe('form-group');
    expect(input.hasAttribute('data-next-phone-country')).toBe(false);
    expect(input.placeholder).toBe('Mobile');
    expect(phoneFieldFor(input)).toBeUndefined();
  });

  it('leaves a class the author put there', async () => {
    const input = phoneInput({ class: 'next-phone-input' });
    const { field } = await shippingField(input);

    field.destroy();

    expect(input.classList.contains('next-phone-input')).toBe(true);
  });

  it('stops formatting and writing the number once destroyed', async () => {
    const input = phoneInput();
    const { ctx, field } = await shippingField(input);

    field.destroy();
    vi.mocked(ctx.updateFormData).mockClear();
    type(input, '4155552671');

    expect(input.value).toBe('4155552671');
    expect(ctx.updateFormData).not.toHaveBeenCalled();
  });

  it('stops following the address country once destroyed', async () => {
    const input = phoneInput();
    const select = countrySelect('US', 'GB');
    const { field } = await shippingField(input, {
      fields: new Map<string, HTMLElement>([
        ['phone', input],
        ['country', select],
      ]),
    });

    field.destroy();
    chooseCountry(select, 'GB');

    expect(document.querySelector('.next-phone-flag')).toBeNull();
    expect(input.hasAttribute('data-next-phone-country')).toBe(false);
  });

  it('replaces the field on re-init instead of stacking a second one', async () => {
    const input = phoneInput();
    const { ctx } = await shippingField(input);

    initializePhoneInputs(ctx);
    await ctx.phoneInputs.get('shipping')?.whenReady();
    type(input, '4155552671');

    expect(document.querySelectorAll('.next-phone-flag')).toHaveLength(1);
    expect(input.value).toBe('(415) 555-2671');
    expect(ctx.updateFormData).toHaveBeenCalledTimes(10);
  });

  it('catches a failure to build a field, logs it, and does not propagate', () => {
    const { logger, errorSpy } = makeLogger();
    const input = phoneInput();
    vi.spyOn(input, 'before').mockImplementation(() => {
      throw new Error('detached');
    });
    const ctx = makeCtx({
      fields: new Map<string, HTMLElement>([['phone', input]]),
      logger,
    });

    expect(() => initializePhoneInputs(ctx)).not.toThrow();

    expect(errorSpy).toHaveBeenCalled();
    expect(ctx.phoneInputs.has('shipping')).toBe(false);
  });
});

/**
 * The wait that makes everything else about a phone number real: until a field's rules
 * load, `isValidNumber()` answers `null` and a submit racing the lookup would skip the
 * check with nothing looking wrong.
 */
describe('awaitPhoneRules', () => {
  it('resolves once every field has its rules and its number read', async () => {
    const ctx = makeCtx({
      fields: new Map<string, HTMLElement>([['phone', phoneInput()]]),
      billingFields: new Map<string, HTMLElement>([
        ['billing-phone', phoneInput()],
      ]),
    });
    initializePhoneInputs(ctx);

    await expect(awaitPhoneRules(ctx.phoneInputs)).resolves.toBe(true);
  });

  it('asks for a number typed just before a submit, and waits for it', async () => {
    const input = phoneInput();
    const { ctx, field } = await shippingField(input);

    type(input, '4155552671');
    await expect(awaitPhoneRules(ctx.phoneInputs)).resolves.toBe(true);

    expect(field.getNumber()).toBe('+14155552671');
  });

  it('gives up on a service that does not answer rather than holding the submit', async () => {
    const input = phoneInput();
    const { ctx } = await shippingField(input, {
      readPhoneNumber: () => new Promise(() => {}),
    });

    type(input, '4155552671');

    await expect(awaitPhoneRules(ctx.phoneInputs, 5)).resolves.toBe(false);
  });

  it('gives up after the timeout rather than holding the submit', async () => {
    const ctx = makeCtx({
      fields: new Map<string, HTMLElement>([['phone', phoneInput()]]),
      loadPhoneRules: () => new Promise(() => {}),
    });
    initializePhoneInputs(ctx);

    await expect(awaitPhoneRules(ctx.phoneInputs, 5)).resolves.toBe(false);
  });

  it('is satisfied immediately when the page has no phone field', async () => {
    await expect(awaitPhoneRules(new Map())).resolves.toBe(true);
  });
});

describe('the E.164 number a page reads off the field', () => {
  const E164 = 'data-next-phone-e164';

  it('carries the E.164 number the service reads, and the box keeps what the shopper reads', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    type(input, '4155552671');
    expect(input.hasAttribute(E164)).toBe(false);
    await field.whenReady();

    expect(input.value).toBe('(415) 555-2671');
    expect(input.getAttribute(E164)).toBe('+14155552671');
  });

  it('carries nothing while the number is still being typed', async () => {
    const input = phoneInput();
    await shippingField(input);

    type(input, '41555');

    expect(input.hasAttribute(E164)).toBe(false);
  });

  it('drops the number as soon as the text changes', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);
    type(input, '4155552671');
    await field.whenReady();
    expect(input.getAttribute(E164)).toBe('+14155552671');

    input.setSelectionRange(input.value.length, input.value.length);
    input.value = input.value.slice(0, -1);
    input.dispatchEvent(new Event('input'));

    expect(input.hasAttribute(E164)).toBe(false);
  });

  it("carries a number typed with + in its own country's E.164", async () => {
    const input = phoneInput();
    await shippingField(input);

    type(input, '+66 81 234 5678');

    await vi.waitFor(() =>
      expect(input.getAttribute(E164)).toBe('+66812345678')
    );
  });

  it('carries nothing for a number the service does not read as valid', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    type(input, '415555267');
    await field.whenReady();

    expect(input.hasAttribute(E164)).toBe(false);
  });

  it('reads a value written without typing, which announces itself with change', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    input.value = '4155552671';
    input.dispatchEvent(new Event('change'));
    await field.whenReady();

    expect(input.value).toBe('(415) 555-2671');
    expect(input.getAttribute(E164)).toBe('+14155552671');
  });

  it('takes the number off the input when the field is destroyed', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);
    type(input, '4155552671');
    await field.whenReady();

    field.destroy();

    expect(input.hasAttribute(E164)).toBe(false);
  });
});

describe('the verdict on an empty field', () => {
  it('is none, so a phone restored before the field is filled is not refused', async () => {
    const input = phoneInput();
    const { field } = await shippingField(input);

    expect(field.isValidNumber()).toBeNull();
  });
});

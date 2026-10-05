/**
 * The shipping and billing phone fields: the author's own `<input>`, shown in its
 * country's mask as the shopper types and read back as the E.164 number the order needs.
 *
 * The rules are the address-rules service's, per country (`CountryConfig.phone`, see
 * `core/i18n-rules`): a mask and a loose pattern. The check is loose on purpose,
 * because the order API validates the number. The E.164 number is the service's too: the
 * field asks it to read the number (`POST /v1/validate`) when the shopper pauses, leaves
 * the field, or a value is written in, and waits for nothing else. Until it answers, or if
 * it never does, there is no E.164 and the number is sent as typed.
 *
 * DOM contract, which the e2e specs and the published checkout guide rely on:
 *
 * - the `<input>` is never wrapped or moved;
 * - `<img class="next-phone-flag" alt="" aria-hidden="true">` is inserted immediately
 *   before it, `hidden` while no country is known, so an author's `input + label` rule
 *   still reaches the label;
 * - the input gets `next-phone-input`, `data-next-phone-country="{ISO code}"` and an
 *   inline `padding-right` that keeps its text clear of the flag, and its parent gets
 *   `next-phone-field`. The country is the address country's, or, once the service has
 *   read a number with another country's code, that country's: `+66 81…` in a US form
 *   is `TH`, and the flag follows it;
 * - the input gets `data-next-phone-e164="+14155552671"` once the service has read the
 *   number as a valid one, and loses it while the number changes or is not valid;
 * - the flag's `top` and `right` are set inline from the input's own box, so it stays
 *   inside the input whatever else the parent holds;
 * - `destroy()` takes all of that back off.
 */

import {
  asciiDigits,
  flagUrl,
  formatPhone,
  isPlausiblePhone,
  type PhoneNumberResult,
  type PhoneRules,
} from '@/core/i18n-rules';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import {
  checkPhone,
  normalizePhone,
  type PhoneNumberSource,
} from '../validation/phone-validation';

/** Which of the two addresses a phone field belongs to. */
export type PhoneFieldType = 'shipping' | 'billing';

/**
 * What this module needs from the checkout form.
 *
 * Passed rather than imported so these functions can be tested against a plain object,
 * and so the coupling to the enhancer is exactly this list rather than "all of it".
 * Mirrors the `UpsellHandlerContext` pattern used by `features/cart/accept-upsell`.
 */
export interface PhoneInputContext {
  /** Shipping fields, keyed by their `data-next-checkout-field` name. */
  fields: Map<string, HTMLElement>;
  /** Billing fields, keyed the same way with a `billing-` prefix. */
  billingFields: Map<string, HTMLElement>;
  /**
   * Live fields, keyed by {@link PhoneFieldType}. Held by the caller because the form
   * also destroys them on teardown, and re-initialising must replace rather than stack.
   */
  phoneInputs: Map<string, PhoneField>;
  /** Country a field uses while its country `<select>` has no value, or when there is none. */
  detectedCountryCode: string;
  /** A country's phone rules, or `undefined` when it has none. */
  loadPhoneRules: (countryCode: string) => Promise<PhoneRules | undefined>;
  /**
   * What the address-rules service reads a number as, typed for an address in `country`,
   * or `undefined` when it could not answer.
   */
  readPhoneNumber: (
    number: string,
    country: string
  ) => Promise<PhoneNumberResult | undefined>;
  /**
   * Writes the resolved international number back to the checkout form state.
   *
   * Narrowed to string values rather than mirroring the form's own
   * `Record<string, any>`: the only thing this module ever writes is a phone number, and
   * the narrower type is what a fake in a test has to satisfy.
   */
  updateFormData: (data: Record<string, string>) => void;
  logger: Logger;
}

/** What one {@link PhoneField} needs to run. */
interface PhoneFieldOptions {
  /** The country while {@link countryField} has no value, or when there is none. */
  fallbackCountry: string;
  /** The address country `<select>` the field follows, when the form has one. */
  countryField?: HTMLSelectElement | undefined;
  loadRules: (countryCode: string) => Promise<PhoneRules | undefined>;
  readNumber: (
    number: string,
    country: string
  ) => Promise<PhoneNumberResult | undefined>;
  /** Receives what to store for the number after every edit, and once it is read. */
  onNumber: (value: string) => void;
}

/** Where the field puts the E.164 number a page can read, while it can vouch for it. */
const E164_ATTRIBUTE = 'data-next-phone-e164';

/** How long the field waits after the last keystroke before asking for the number. */
const READ_PAUSE_MS = 400;

/** One field per input, whichever form built it. */
const phoneFields = new WeakMap<HTMLInputElement, PhoneField>();

const FLAG_WIDTH = 20;
const FLAG_HEIGHT = 15;
/** The flag's distance from the input's right edge. */
const FLAG_INSET = 12;
/** Room kept clear of text for it: inset + flag + the same gap again. */
const FLAG_ROOM = `${FLAG_INSET + FLAG_WIDTH + FLAG_INSET}px`;

/**
 * The phone field on `input`, when the checkout form built one.
 *
 * For code that holds the element but not the form's map: the billing field routing and
 * the prospect cart.
 *
 * @example
 * ```ts
 * normalizePhone(input.value, phoneFieldFor(input)); // → '+447700900123'
 * ```
 */
export function phoneFieldFor(input: HTMLInputElement): PhoneField | undefined {
  return phoneFields.get(input);
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function digitsBefore(text: string, offset: number): number {
  let count = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (isDigit(text[i])) count++;
  }
  return count;
}

/**
 * Where the caret goes in `text` to have `count` digits before it.
 *
 * Right after the last of them, so Backspace steps back over a separator. Right before the
 * next digit on a forward delete, or Delete over a separator would only see it put back.
 * And before the first digit when `count` is 0, so a leading `+` or `(` stays behind it.
 */
function caretOffset(text: string, count: number, forward: boolean): number {
  const beforeNext = forward || count === 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (!isDigit(text[i])) continue;
    if (beforeNext && seen === count) return i;
    seen++;
    if (!beforeNext && seen === count) return i + 1;
  }
  return text.length;
}

/**
 * The SDK's phone field on one `<input>`.
 *
 * Shows the number in its country's mask as it is typed, reading the digits back out of
 * the text each time; a mask holds no digits of its own, so none is ever typed twice. The
 * country is the address country `<select>`'s, or the detected one while that has no
 * value. A number typed with `+` is shown as `+` and its digits, one dialled with `00` as
 * the digits typed. Digits from a Thai or full-width keyboard are written back as ASCII
 * ones as they are typed.
 *
 * The E.164 number is what the service read the number as, for the text in the field now
 * and the address country now; any edit drops it until the service answers again.
 *
 * Implements {@link PhoneNumberSource}, so every phone check in the SDK asks it the same
 * way.
 */
export class PhoneField implements PhoneNumberSource {
  private readonly flag: HTMLImageElement;
  private readonly placeholder: string | null;
  /** The input's own inline `padding-right` and its priority, put back on destroy. */
  private readonly padding: [string, string];
  /** Places the flag again when the input or its parent changes size. */
  private readonly layout: ResizeObserver | undefined;
  private readonly addedClasses: Array<[Element, string]> = [];
  private readonly listeners = new AbortController();

  /** The address country the field formats and checks for; `''` when none is known. */
  private country = '';
  private rules: PhoneRules | undefined;
  /** Settles when the rules for {@link country} have loaded, or turned out not to exist. */
  private loading: Promise<void> = Promise.resolve();
  /** Counts loads, so a slow answer for a country left behind is dropped. */
  private loads = 0;

  /** What the service read, and for which text and country. */
  private read:
    | { key: string; result: PhoneNumberResult | undefined }
    | undefined;
  /** Settles when the service has answered for the text being asked about. */
  private reading: Promise<void> | undefined;
  private pause: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly input: HTMLInputElement,
    private readonly options: PhoneFieldOptions
  ) {
    phoneFields.get(input)?.destroy();

    this.flag = document.createElement('img');
    this.flag.className = 'next-phone-flag';
    this.flag.alt = '';
    this.flag.setAttribute('aria-hidden', 'true');
    this.flag.width = FLAG_WIDTH;
    this.flag.height = FLAG_HEIGHT;
    this.flag.hidden = true;
    input.before(this.flag);

    this.addClass(input, 'next-phone-input');
    if (input.parentElement) {
      this.addClass(input.parentElement, 'next-phone-field');
    }

    // Inline, so the room for the flag outranks a page's own `.field input` padding.
    this.padding = [
      input.style.getPropertyValue('padding-right'),
      input.style.getPropertyPriority('padding-right'),
    ];
    input.style.setProperty('padding-right', FLAG_ROOM);

    this.layout =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => this.placeFlag());
    this.layout?.observe(input);
    if (input.parentElement) this.layout?.observe(input.parentElement);
    this.placeFlag();

    // No example number as a placeholder: the required marker is what the form shows.
    this.placeholder = input.getAttribute('placeholder');
    input.placeholder =
      input.getAttribute('data-next-required') === 'true' ||
      input.hasAttribute('required')
        ? 'Phone*'
        : 'Phone (Optional)';

    // Capture, so this runs before the form's own `input` handler reads the number.
    input.addEventListener('input', event => this.handleInput(event), {
      capture: true,
      signal: this.listeners.signal,
    });
    // A value written by the form's own prefill or autofill announces itself with `change`.
    input.addEventListener('change', () => this.update(), {
      signal: this.listeners.signal,
    });
    input.addEventListener(
      'blur',
      () => void this.readNow().then(() => this.showWritten()),
      { signal: this.listeners.signal }
    );
    options.countryField?.addEventListener('change', () => this.follow(), {
      signal: this.listeners.signal,
    });

    this.follow();
    phoneFields.set(input, this);
  }

  /** E.164 for the number in the field, or `''` until the service has read it as valid. */
  getNumber(): string {
    const result = this.current();
    return result?.valid && result.value ? result.value : '';
  }

  /**
   * Whether the number could be one for its country: `true` once the service has read it
   * as valid, else the country's loose pattern. `null` when there is nothing to judge: an
   * empty field, rules still loading, or a country whose rules have no pattern.
   *
   * A number the service reads as not valid is still judged by the loose pattern alone, so
   * a range libphonenumber has not caught up with never stops a shopper.
   */
  isValidNumber(): boolean | null {
    if (!this.input.value.trim()) return null;
    if (this.current()?.valid) return true;
    if (this.rules?.pattern === undefined) return null;
    return isPlausiblePhone(this.input.value, this.rules);
  }

  /**
   * The service's sentence for the number in the field, once it has read it as not valid:
   * `Enter a valid phone number, like +66 81 234 5678`. `undefined` for a number it reads
   * as valid or could not read, and for one the loose pattern already refuses, whose own
   * message stands.
   */
  async invalidMessage(): Promise<string | undefined> {
    await this.readNow();
    const result = this.current();
    if (result?.valid !== false || this.isValidNumber() === false)
      return undefined;
    return result.error?.message;
  }

  /**
   * Settles once the rules for the address country are in, or known absent, and the
   * service has answered for the number in the field, or given up. Asks it now when it
   * has not been asked, so a submit straight after typing gets an E.164 number.
   */
  async whenReady(): Promise<void> {
    await this.loading;
    await this.readNow();
  }

  destroy(): void {
    this.listeners.abort();
    clearTimeout(this.pause);
    this.layout?.disconnect();
    this.flag.remove();
    const [padding, priority] = this.padding;
    if (padding)
      this.input.style.setProperty('padding-right', padding, priority);
    else this.input.style.removeProperty('padding-right');
    for (const [element, name] of this.addedClasses) {
      element.classList.remove(name);
    }
    this.input.removeAttribute('data-next-phone-country');
    this.input.removeAttribute(E164_ATTRIBUTE);
    if (this.placeholder === null) this.input.removeAttribute('placeholder');
    else this.input.placeholder = this.placeholder;
    if (phoneFields.get(this.input) === this) phoneFields.delete(this.input);
  }

  /**
   * Puts the flag inside the input's right edge, from the input's own box. The
   * stylesheet can only place it against the parent, which may be wider than the input
   * and is where the form appends an error message — so on its own the flag sits past
   * the input, and drops below it as soon as the number is refused.
   *
   * `offsetTop` and `offsetLeft` are measured from the flag's own containing block: the
   * parent, which the stylesheet positions.
   */
  private placeFlag(): void {
    const box = this.input.offsetParent;
    if (!box) return; // not laid out: hidden, or not in the page
    const { offsetTop, offsetHeight, offsetLeft, offsetWidth } = this.input;
    const right = box.clientWidth - (offsetLeft + offsetWidth) + FLAG_INSET;
    this.flag.style.top = `${offsetTop + offsetHeight / 2}px`;
    this.flag.style.right = `${right}px`;
  }

  private addClass(element: Element, name: string): void {
    if (element.classList.contains(name)) return;
    element.classList.add(name);
    this.addedClasses.push([element, name]);
  }

  /** What the service is asked about: the digits and `+` typed, and the address country. */
  private key(): string {
    const typed = asciiDigits(this.input.value).replace(/[^\d+]/g, '');
    return `${this.country}|${typed}`;
  }

  /** The service's answer for the field as it is now, if it has given one. */
  private current(): PhoneNumberResult | undefined {
    return this.read?.key === this.key() ? this.read.result : undefined;
  }

  private handleInput(event: Event): void {
    const forward =
      event instanceof InputEvent && event.inputType.endsWith('Forward');
    this.writeAsciiDigits();
    this.render(forward);
    this.settle();
    clearTimeout(this.pause);
    this.pause = setTimeout(() => void this.readNow(), READ_PAUSE_MS);
  }

  /** A value written without typing: formatted, stored, and read straight away. */
  private update(): void {
    this.writeAsciiDigits();
    this.render();
    this.settle();
    void this.readNow();
  }

  /** Thai or full-width digits in the input, as ASCII ones, the caret where it was. */
  private writeAsciiDigits(): void {
    const typed = this.input.value;
    const ascii = asciiDigits(typed);
    if (ascii === typed) return;
    const caret = this.input.selectionStart;
    this.input.value = ascii;
    if (caret !== null && document.activeElement === this.input) {
      this.input.setSelectionRange(caret, caret);
    }
  }

  /** What a page and the form read off the field, for the text in it now. */
  private settle(): void {
    this.options.onNumber(normalizePhone(this.input.value, this));
    this.publish();
  }

  /**
   * Asks the service to read the number in the field, unless it has already answered or
   * is answering for this text and country. Settles when it has.
   */
  private readNow(): Promise<void> {
    clearTimeout(this.pause);
    const key = this.key();
    const number = this.input.value.trim();
    if (!number || !this.country) return Promise.resolve();
    if (this.read?.key === key) return this.reading ?? Promise.resolve();

    this.read = { key, result: undefined };
    const reading = this.options
      .readNumber(number, this.country)
      .catch(() => undefined)
      .then(result => {
        if (this.listeners.signal.aborted || this.read?.key !== key) return;
        this.read = { key, result };
        this.settle();
        this.showWritten();
      });
    this.reading = reading;
    return reading;
  }

  /**
   * Once the shopper has left the field, the number as the service writes it: at home for
   * a number from the address country (`081 234 5678`), from abroad otherwise
   * (`+44 7400 123456`). This is what gives a country with no mask a written number too.
   * The reading moves with the text, since it is the same number.
   */
  private showWritten(): void {
    if (document.activeElement === this.input) return;
    const result = this.current();
    if (!result?.valid) return;
    const written =
      result.country === this.country ? result.national : result.international;
    if (!written || written === this.input.value) return;
    this.input.value = written;
    this.read = { key: this.key(), result };
    this.settle();
  }

  /**
   * `data-next-phone-e164` and the flag, from what the service read the number as: its
   * E.164 and its country while it is valid, nothing and the address country otherwise.
   */
  private publish(): void {
    const result = this.current();
    const number = this.getNumber();
    if (number) this.input.setAttribute(E164_ATTRIBUTE, number);
    else this.input.removeAttribute(E164_ATTRIBUTE);
    this.showCountry((result?.valid && result.country) || this.country);
  }

  private showCountry(country: string): void {
    if (country) {
      this.flag.src = flagUrl(country);
      this.flag.hidden = false;
      this.input.setAttribute('data-next-phone-country', country);
    } else {
      this.flag.hidden = true;
      this.input.removeAttribute('data-next-phone-country');
    }
  }

  /** Points the field at the address country, else the fallback while that has none. */
  private follow(): void {
    const selected = this.options.countryField?.value;
    // `''` is a select with nothing chosen yet, which falls back like a missing one.
    const country = (
      selected ? selected : this.options.fallbackCountry
    ).toUpperCase();
    if (country === this.country) return;
    this.country = country;
    this.rules = undefined;
    // An empty field writes nothing: a phone restored into the store before the form
    // fills its input must survive the field starting up.
    if (this.input.value.trim()) {
      this.settle();
      void this.readNow();
    } else {
      this.publish();
    }

    const load = ++this.loads;
    if (!country) {
      this.loading = Promise.resolve();
      return;
    }
    // A failed lookup is logged by the country service, and means the same as no rules.
    this.loading = Promise.resolve()
      .then(() => this.options.loadRules(country))
      .catch(() => undefined)
      .then(rules => {
        if (load !== this.loads || this.listeners.signal.aborted) return;
        this.rules = rules;
        this.render();
        if (this.input.value.trim()) this.settle();
        else this.publish();
      });
  }

  /** Writes the number in its country's mask; a field with no rules is left as typed. */
  private render(forward = false): void {
    if (!this.rules) return;
    const typed = this.input.value;
    const text = formatPhone(typed, this.rules);
    if (text === typed) return;

    const count =
      document.activeElement === this.input
        ? digitsBefore(typed, this.input.selectionStart ?? typed.length)
        : undefined;
    this.input.value = text;
    if (count !== undefined) {
      const offset = caretOffset(text, count, forward);
      this.input.setSelectionRange(offset, offset);
    }
  }
}

/** The country `<select>` paired with a phone field, when the form has one. */
function countryFieldFor(
  ctx: PhoneInputContext,
  type: PhoneFieldType
): HTMLElement | undefined {
  return type === 'shipping'
    ? ctx.fields.get('country')
    : ctx.billingFields.get('billing-country');
}

/** Puts the value to store for a phone into the checkout store. */
function storeNumber(
  ctx: PhoneInputContext,
  type: PhoneFieldType,
  value: string
): void {
  if (type === 'shipping') {
    ctx.updateFormData({ phone: value });
    return;
  }
  const checkoutStore = useCheckoutStore.getState();
  const currentBillingData = checkoutStore.billingAddress ?? {
    first_name: '',
    last_name: '',
    address1: '',
    city: '',
    province: '',
    postal: '',
    country: '',
    phone: '',
  };
  checkoutStore.setBillingAddress({ ...currentBillingData, phone: value });
}

/**
 * Turns one phone input into a {@link PhoneField}.
 *
 * Failure is contained: if building it throws, the error is logged and the form carries
 * on without it. That is why a broken phone field shows up as a log line and a shopper
 * who can still check out.
 */
function initializePhoneInput(
  ctx: PhoneInputContext,
  type: PhoneFieldType,
  phoneField: HTMLInputElement
): void {
  try {
    // Re-initialising must replace, not stack: a second field on the same element
    // would double every listener and reformat what the first one wrote.
    ctx.phoneInputs.get(type)?.destroy();
    ctx.phoneInputs.delete(type);

    const countryField = countryFieldFor(ctx, type);
    ctx.phoneInputs.set(
      type,
      new PhoneField(phoneField, {
        fallbackCountry: ctx.detectedCountryCode,
        countryField:
          countryField instanceof HTMLSelectElement ? countryField : undefined,
        loadRules: ctx.loadPhoneRules,
        readNumber: ctx.readPhoneNumber,
        onNumber: value => storeNumber(ctx, type, value),
      })
    );
  } catch (error) {
    ctx.logger.error(`Failed to initialize ${type} phone field:`, error);
  }
}

/** What showing the service's verdict on a number needs from the checkout form. */
export interface PhoneVerdictContext {
  /** Puts a message under a field without blocking a submit. */
  showError: (name: string, message: string) => void;
  /** Takes the message away again. */
  clearError: (name: string) => void;
}

/** The phone inputs showing the service's message, so only that one is cleared. */
const warnedPhones = new WeakSet<HTMLInputElement>();

/**
 * Once the shopper has left a phone field, shows the service's sentence under it when it
 * reads the number as not valid, and takes it away once it reads one as valid.
 *
 * Shown, never recorded: a submit judges the number by the loose pattern alone, so a range
 * libphonenumber has not caught up with never stops an order. An answer about a number the
 * shopper has since changed, or that arrives while they are back in the field, shows
 * nothing.
 *
 * @example
 * ```ts
 * void showPhoneVerdict({ showError, clearError }, 'phone', input);
 * ```
 */
export async function showPhoneVerdict(
  ctx: PhoneVerdictContext,
  fieldName: string,
  input: HTMLInputElement
): Promise<void> {
  const field = phoneFieldFor(input);
  if (!field) return;
  const typed = input.value;
  const message = await field.invalidMessage();
  if (message) {
    if (input.value !== typed || document.activeElement === input) return;
    warnedPhones.add(input);
    ctx.showError(fieldName, message);
  } else if (warnedPhones.delete(input)) {
    ctx.clearError(fieldName);
  }
}

/**
 * How long a caller waits for the phone rules and the service's reading before going ahead
 * anyway.
 *
 * Long enough for the address-rules service on any connection that can also reach the
 * orders API, short enough not to hold a shopper whose network dropped it. Normally
 * already settled.
 */
const RULES_WAIT_MS = 2000;

/**
 * Waits for every phone field's rules to load and its number to be read, and reports
 * whether they all settled.
 *
 * Until then `getNumber()` answers `''` and `isValidNumber()` judges by the loose pattern
 * alone, both quietly, so a submit that races them sends the number as typed. This turns
 * that race into a wait.
 *
 * Resolves `true` when every field is settled — including a country that has no rules and
 * a number the service could not read — and when the page has no phone field at all: both
 * mean "nothing here is still loading".
 * Only `false` needs handling, and it means the wait ran out rather than that anything
 * failed — the caller carries on and the number is handled as {@link checkPhone}'s
 * `unknown`, which never blocks a shopper for a problem that is ours.
 *
 * @example
 * ```ts
 * await awaitPhoneRules(this.phoneInputs);
 * const validation = await this.validator.validateForm(formData, countryConfigs);
 * ```
 */
export async function awaitPhoneRules(
  phoneInputs: ReadonlyMap<string, PhoneField>,
  timeoutMs: number = RULES_WAIT_MS
): Promise<boolean> {
  const pending = [...phoneInputs.values()].map(field => field.whenReady());
  if (pending.length === 0) return true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<false>(resolve => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  try {
    return await Promise.race([Promise.all(pending).then(() => true), expiry]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Initialises both phone fields, where they exist.
 *
 * Called on boot and again after the billing form is revealed, since the billing phone
 * field may not have been in the DOM the first time.
 */
export function initializePhoneInputs(ctx: PhoneInputContext): void {
  const shippingPhoneField = ctx.fields.get('phone');
  if (shippingPhoneField instanceof HTMLInputElement) {
    initializePhoneInput(ctx, 'shipping', shippingPhoneField);
  }

  const billingPhoneField = ctx.billingFields.get('billing-phone');
  if (billingPhoneField instanceof HTMLInputElement) {
    initializePhoneInput(ctx, 'billing', billingPhoneField);
  }
}

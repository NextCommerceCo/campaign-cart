import { type CheckoutActions, PHONES } from '../engine/checkout';
import type { Engine } from '../engine/engine';
import { asciiDigits, formatPhone } from '../engine/phone';
import type { Fields } from './form';

const FLAG_WIDTH = 20;
const FLAG_HEIGHT = 15;
const FLAG_INSET = 12;
const FLAG_ROOM = `${FLAG_INSET + FLAG_WIDTH + FLAG_INSET}px`;
const READ_PAUSE = 400;

interface Bound {
  input: HTMLInputElement;
  flag: HTMLImageElement;
  layout?: ResizeObserver;
  maskedFor?: string;
}

const isDigit = (char: string | undefined) => !!char && char >= '0' && char <= '9';

function digitsBefore(text: string, offset: number): number {
  let count = 0;
  for (let i = 0; i < offset && i < text.length; i++) if (isDigit(text[i])) count++;
  return count;
}

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

function placeFlag({ input, flag }: Bound): void {
  const box = input.offsetParent;
  if (!box) return;
  flag.style.top = `${input.offsetTop + input.offsetHeight / 2}px`;
  flag.style.right = `${box.clientWidth - (input.offsetLeft + input.offsetWidth) + FLAG_INSET}px`;
}

function attach(input: HTMLInputElement): Bound {
  const flag = Object.assign(document.createElement('img'), {
    className: 'next-phone-flag',
    alt: '',
    width: FLAG_WIDTH,
    height: FLAG_HEIGHT,
    hidden: true,
  });
  flag.setAttribute('aria-hidden', 'true');
  input.before(flag);
  input.classList.add('next-phone-input');
  input.parentElement?.classList.add('next-phone-field');
  input.style.setProperty('padding-right', FLAG_ROOM);
  const bound: Bound = { input, flag };
  if (typeof ResizeObserver !== 'undefined') {
    bound.layout = new ResizeObserver(() => placeFlag(bound));
    bound.layout.observe(input);
    if (input.parentElement) bound.layout.observe(input.parentElement);
  }
  placeFlag(bound);
  return bound;
}

export function bindPhones(
  engine: Engine,
  checkout: CheckoutActions,
  form: HTMLFormElement,
  fields: Fields,
  flags: string,
): () => void {
  const bound = new Map<string, Bound>();
  const pauses = new Map<string, ReturnType<typeof setTimeout>>();
  const state = () => engine.getState().checkout;
  const countryOf = (name: string) => state()?.fields[name.startsWith('billing_') ? 'billing_country' : 'country'];
  const formatOf = (name: string) => state()?.rules[countryOf(name) ?? '']?.fields.phone_number?.format;
  const phoneOf = (target: EventTarget | null) => PHONES.find((name) => fields.get(name) === target);

  const mask = (name: string, input: HTMLInputElement, forward = false) => {
    const typed = asciiDigits(input.value);
    const format = formatOf(name);
    const text = format?.masks?.length ? formatPhone(typed, format) : typed;
    if (text === input.value) return;
    const count = document.activeElement === input ? digitsBefore(typed, input.selectionStart ?? 0) : undefined;
    input.value = text;
    if (count === undefined) return;
    const at = caretOffset(text, count, forward);
    input.setSelectionRange(at, at);
  };

  const listen = (type: string, fn: (name: string, input: HTMLInputElement, e: Event) => void) =>
    form.addEventListener(
      type,
      (e) => {
        const name = phoneOf(e.target);
        if (name && e.target instanceof HTMLInputElement) fn(name, e.target, e);
      },
      true,
    );
  listen('input', (name, input, e) => {
    mask(name, input, e instanceof InputEvent && e.inputType.endsWith('Forward'));
    clearTimeout(pauses.get(name));
    pauses.set(
      name,
      setTimeout(() => void checkout.readPhone(name), READ_PAUSE),
    );
  });
  listen('change', (name, input) => mask(name, input));
  listen('focusout', (name, input) => {
    clearTimeout(pauses.get(name));
    void checkout.readPhone(name).then(() => {
      if (document.activeElement !== input) checkout.writePhone(name);
    });
  });

  return () => {
    const current = state();
    if (!current) return;
    for (const name of PHONES) {
      const input = fields.get(name);
      let phone = bound.get(name);
      if (phone && phone.input !== input) {
        phone.layout?.disconnect();
        phone.flag.remove();
        bound.delete(name);
        phone = undefined;
      }
      if (!(input instanceof HTMLInputElement)) continue;
      if (!phone) bound.set(name, (phone = attach(input)));

      const read = current.phones[name];
      const country = read?.country ?? countryOf(name);
      if (country) {
        phone.flag.src = `${flags}/v1/flags/${encodeURIComponent(country.toLowerCase())}.svg`;
        input.setAttribute('data-next-phone-country', country);
      } else input.removeAttribute('data-next-phone-country');
      phone.flag.hidden = !country;
      if (read) input.setAttribute('data-next-phone-e164', read.value);
      else input.removeAttribute('data-next-phone-e164');

      const rulesFor = formatOf(name) ? countryOf(name) : undefined;
      if (rulesFor && rulesFor !== phone.maskedFor && document.activeElement !== input && input.value) {
        phone.maskedFor = rulesFor;
        const before = input.value;
        mask(name, input);
        if (input.value !== before) queueMicrotask(() => checkout.setField(name, input.value));
      }
    }
  };
}

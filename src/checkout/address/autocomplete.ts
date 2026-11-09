import type { CheckoutActions } from '../state/checkout';
import type { AddressSuggestion } from '../state/types';
import type { Fields } from '../form/fields';
import { legacyAddressFilled } from '../../compat/checkout';

const DEBOUNCE = 300;
const searchable = (text: string) => /\S\s+\S/.test(text);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function highlight(query: string, label: string): HTMLSpanElement {
  const span = Object.assign(document.createElement('span'), { className: 'pac-item-query' });
  const words = query.split(/\s+/).filter(Boolean);
  if (!words.length) return Object.assign(span, { textContent: label });
  const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi');
  span.append(
    ...label
      .split(pattern)
      .map((part) =>
        words.some((w) => w.toLowerCase() === part.toLowerCase())
          ? Object.assign(document.createElement('b'), { textContent: part })
          : document.createTextNode(part),
      ),
  );
  return span;
}

function closeButton(onClose: () => void): HTMLButtonElement {
  const button = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'pac-close-button',
    textContent: '×',
  });
  button.setAttribute('aria-label', 'Close suggestions');
  button.style.cssText =
    'position:absolute;top:.4rem;right:.75rem;background:none;border:none;font-size:20px;line-height:24px;color:#6b7280;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;border-radius:4px;width:24px;height:24px';
  button.addEventListener('click', onClose);
  return button;
}

function suggestionItem(query: string, suggestion: AddressSuggestion, onPick: () => void): HTMLElement {
  const el = Object.assign(document.createElement('div'), { className: 'pac-item-nextcommerce' });
  el.append(
    Object.assign(document.createElement('span'), { className: 'pac-icon pac-icon-marker' }),
    highlight(query, suggestion.label),
  );
  el.addEventListener('click', onPick);
  return el;
}

function pickState(select: HTMLSelectElement, code: string, name: string, attempt = 0): void {
  if (attempt >= 5) return;
  setTimeout(
    () => {
      const options = [...select.options];
      const wanted = name.toLowerCase().trim();
      const match =
        (code && options.find((o) => o.value === code)) ||
        (wanted && options.find((o) => o.text.toLowerCase().trim().includes(wanted)));
      if (!match) return pickState(select, code, name, attempt + 1);
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
    300 * 1.5 ** attempt,
  );
}

function fill(fields: Fields, prefix: '' | 'billing_', { address }: AddressSuggestion): void {
  const set = (name: string, value: string | undefined) => {
    const el = fields.get(prefix + name);
    if (!(el instanceof HTMLInputElement) || !value) return;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set('line1', address.line1);
  set('city', address.city);
  set('postcode', address.postcode);
  if (!address.country) return;
  const country = fields.get(`${prefix}country`);
  if (country instanceof HTMLSelectElement && country.value !== address.country_code) {
    country.value = address.country_code;
    country.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const state = fields.get(`${prefix}state`);
  if (state instanceof HTMLSelectElement && (address.state || address.state_code))
    pickState(state, address.state_code, address.state);
}

interface SuggestionList {
  show(query: string, found: AddressSuggestion[]): void;
  /** Shows the list again if it is still there. */
  reveal(): boolean;
  hide(): void;
  close(): void;
  move(down: boolean): void;
  pick(): void;
  /** The shopper typed: the list stops pointing at a suggestion. */
  typing(): void;
}

function suggestionList(input: HTMLInputElement, choose: (s: AddressSuggestion) => void): SuggestionList {
  let box: HTMLElement | undefined;
  let results: AddressSuggestion[] = [];
  let active = -1;
  let typed: string | null = null;

  const items = () => [...(box?.querySelectorAll<HTMLElement>('.pac-item-nextcommerce') ?? [])];
  const hide = () => {
    if (box) box.style.display = 'none';
  };
  const outside = (e: MouseEvent) => {
    if (box && !box.contains(e.target as Node) && e.target !== input) box.style.display = 'none';
  };
  const close = () => {
    if (typed !== null) input.value = typed;
    typed = null;
    document.removeEventListener('click', outside);
    box?.remove();
    box = undefined;
    active = -1;
    results = [];
  };
  const setActive = (index: number) => {
    items().forEach((el, i) => el.classList.toggle('pac-item-nextcommerce--active', i === index));
    active = index;
    input.value = index >= 0 && results[index] ? results[index].label : (typed ?? '');
  };
  const select = (suggestion: AddressSuggestion) => {
    typed = null;
    input.value = suggestion.label;
    choose(suggestion);
    hide();
  };
  const show = (query: string, found: AddressSuggestion[]) => {
    close();
    box = Object.assign(document.createElement('div'), { className: 'pac-container-nextcommerce pac-logo' });
    box.style.cssText = 'display:none;position:absolute;z-index:9999';
    box.addEventListener('mousedown', (e) => e.preventDefault());
    document.addEventListener('click', outside);
    document.body.append(box);
    results = found;
    typed = input.value;
    box.append(...found.map((s) => suggestionItem(query, s, () => select(s))), closeButton(hide));
    if (!found.length) return;
    const rect = input.getBoundingClientRect();
    Object.assign(box.style, {
      top: `${rect.bottom + scrollY}px`,
      left: `${rect.left + scrollX}px`,
      width: `${rect.width}px`,
      display: 'block',
    });
  };

  return {
    show,
    reveal() {
      if (box) box.style.display = 'block';
      return !!box;
    },
    hide,
    close,
    move(down) {
      const count = items().length;
      if (!box || box.style.display === 'none' || !count) return;
      if (down) setActive(active >= count - 1 ? 0 : active + 1);
      else setActive(active <= 0 ? count - 1 : active - 1);
    },
    pick() {
      if (active >= 0) items()[active]?.click();
    },
    typing() {
      typed = null;
      if (active >= 0) setActive(-1);
    },
  };
}

function attach(
  input: HTMLInputElement,
  country: () => string,
  search: CheckoutActions['suggestAddresses'],
  choose: (s: AddressSuggestion) => void,
): void {
  const list = suggestionList(input, choose);
  let navigating = false;
  let last: { query: string; results: AddressSuggestion[] } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const lookup = async (query: string) => {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const found = await search(query, country(), signal);
    if (signal.aborted) return;
    last = { query, results: found };
    list.show(query, found);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      list.pick();
      return;
    }
    if (e.key === 'Escape') return list.close();
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
      navigating = false;
      return;
    }
    e.preventDefault();
    navigating = true;
    list.move(e.key === 'ArrowDown');
  });
  input.addEventListener('focus', () => {
    if (last?.results.length) {
      if (!list.reveal()) list.show(last.query, last.results);
    } else if (searchable(input.value)) void lookup(input.value);
  });
  input.addEventListener('blur', () => {
    if (!navigating) list.close();
    navigating = false;
  });
  input.addEventListener('input', () => {
    if (navigating) {
      navigating = false;
      return;
    }
    list.typing();
    clearTimeout(timer);
    if (!searchable(input.value)) {
      list.hide();
      return;
    }
    const query = input.value;
    timer = setTimeout(() => void lookup(query), DEBOUNCE);
  });
}

const attached = new WeakSet<HTMLInputElement>();

export function bindAutocomplete(fields: Fields, checkout: CheckoutActions): void {
  for (const prefix of ['', 'billing_'] as const) {
    const input = fields.get(`${prefix}line1`);
    if (!(input instanceof HTMLInputElement) || attached.has(input)) continue;
    attached.add(input);
    const country = () => fields.get(`${prefix}country`)?.value || 'US';
    const type = prefix ? 'billing' : 'shipping';
    attach(input, country, checkout.suggestAddresses, (s) => {
      checkout.autofill(type, s);
      fill(fields, prefix, s);
      legacyAddressFilled(input, type, s);
    });
  }
}

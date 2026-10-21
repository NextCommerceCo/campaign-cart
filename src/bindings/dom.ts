import type { SelectorLine } from '../engine/types';
import { legacySelectorId } from '../legacy';

export function selectorIdOf(el: Element): string {
  return el.getAttribute('data-next-selector-id') || legacySelectorId(el) || 'default';
}

export function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseLines(raw: string | null): SelectorLine[] {
  return parseJson<SelectorLine[]>(raw, [])
    .map((i) => ({
      packageId: Number(i.packageId),
      quantity: Number(i.quantity ?? 1),
      ...(i.configurable === true && { configurable: true }),
    }))
    .filter((l) => l.packageId > 0 && l.quantity > 0);
}

export function ownProperties(el: Element): Record<string, string> {
  const inputs = [...el.querySelectorAll<HTMLInputElement>('[data-next-property]')];
  return Object.fromEntries(
    inputs.map((i) => [i.getAttribute('data-next-property')!, i.value.trim()]).filter(([, value]) => value),
  );
}

export function pageProperties(card?: Element): Record<string, string> {
  const exclude = (card?.getAttribute('data-next-exclude-property') ?? '').split(',').map((s) => s.trim());
  if (exclude.includes('*')) return {};
  const found: Record<string, string> = {};
  for (const el of document.querySelectorAll<HTMLInputElement>('[data-next-default-property]')) {
    const name = el.getAttribute('data-next-default-property')!;
    if (el.value.trim() && !exclude.includes(name)) found[name] = el.value.trim();
  }
  return found;
}

export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setVisible(el: HTMLElement, visible: boolean): void {
  el.style.display = visible ? '' : 'none';
  el.classList.toggle('next-visible', visible);
  el.classList.toggle('next-hidden', !visible);
}

export function setState(el: Element, on: boolean): void {
  el.classList.toggle('next-selected', on);
  el.classList.toggle('next-active', on);
  el.classList.toggle('next-in-cart', on);
  el.classList.toggle('next-not-in-cart', !on);
  el.setAttribute('data-next-selected', String(on));
  el.setAttribute('data-next-active', String(on));
  el.setAttribute('aria-pressed', String(on));
}

export const isFormControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('a, input, select, textarea, label');

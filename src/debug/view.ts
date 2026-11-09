import type { Engine } from '../engine/engine';
import { format, localeOf } from '../engine/format';
import { type IconName, icon } from './icons';

export type Child = Node | string | false | null | undefined;

/** An element with its props and children; `role` and `aria*` props (`ariaLabel`) become attributes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> | string = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(typeof props === 'string' ? { className: props } : props))
    if (!/^(role|aria)/.test(k)) (el as unknown as Record<string, unknown>)[k] = v;
    else if (v != null) el.setAttribute(k.replace('aria', 'aria-').toLowerCase(), String(v));
  el.append(...nodes(children));
  return el;
}

const preview = (v: object) => {
  if (Array.isArray(v)) return `[${v.length}]`;
  const keys = Object.keys(v);
  return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
};

const leaf = (v: unknown) =>
  v instanceof Error
    ? h('span', 'red', `${v.name}: ${v.message}`)
    : h('span', typeof v === 'string' ? 's' : typeof v === 'number' ? 'n' : 'b', JSON.stringify(v) ?? String(v));

export const tsugi = <E extends HTMLElement>(el: E, data: Record<string, string>) => {
  Object.assign(el.dataset, data);
  return el;
};

export const tsugiCard = (className: string, ...children: Child[]) =>
  tsugi(h('div', `card ${className}`, h('section', {}, ...children)), { size: 'sm' });

export const badge = (text: Child, variant: string, ...rest: Child[]) =>
  tsugi(h('span', 'badge', text, ...rest), { variant });

export const nodes = (children: Child[]) => children.filter((c): c is Node | string => !!c);

export const button = (label: Child, onclick: () => void, data: Record<string, string> = {}, title = '') =>
  tsugi(h('button', { type: 'button', className: 'btn', title, onclick }, label), data);

export const iconButton = (name: IconName, label: string, onclick: () => void, size = 'icon-xs') =>
  tsugi(h('button', { type: 'button', className: 'btn', title: label, ariaLabel: label, onclick }, icon(name)), {
    variant: 'ghost',
    size,
  });

/** A text button drawn as a link. */
export const link = (label: Child | Child[], onclick: () => void, className = 'link') =>
  h('button', { type: 'button', className, onclick }, ...[label].flat());

/** A tsugi dialog with a close button, closed by a click outside it too. */
export function modal(className: string, size: string, ...children: Child[]) {
  const dialog = tsugi(
    h(
      'dialog',
      `dialog ${className}`,
      h(
        'div',
        {},
        ...children,
        iconButton('close', 'Close dialog', () => dialog.close(), 'icon-sm'),
      ),
    ),
    { size },
  );
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  return dialog;
}

/** One less, how many, one more: `set(n)` gives each button's click. */
export const stepper = (n: number, set: (n: number) => () => void) =>
  h(
    'span',
    'qty',
    h('button', { type: 'button', title: 'One less', onclick: set(n - 1) }, '−'),
    h('span', {}, String(n)),
    h('button', { type: 'button', title: 'One more', onclick: set(n + 1) }, '+'),
  );

/** Marks `el` with a tone for the styles, when it has one. */
export const toned = <E extends HTMLElement>(el: E, tone: string | false | undefined) => {
  if (tone) el.dataset.tone = tone;
  return el;
};

export const tablist = (data: Record<string, string>, label?: string) =>
  tsugi(h('div', { role: 'tablist', ariaLabel: label || null }), data);

export const tab = (selected: boolean, onclick: () => void, ...label: Child[]) =>
  h('button', { type: 'button', onclick, role: 'tab', ariaSelected: String(selected) }, ...label);

export const priceText = (engine: Engine, amount: string | number | undefined, currency?: string) => {
  const state = engine.getState();
  return format(
    { type: 'money', value: amount === undefined ? undefined : Number(amount) },
    currency ?? state.campaign?.currency,
    localeOf(state),
  );
};

/** A label, its value, and a class for the value (and the label, with `rows(…, true)`). */
export type Row = [label: Child, value: Child | Child[], className?: string];

/** A `dl` of label/value rows. */
export const rows = (className: string, list: Row[], classLabels = false) =>
  h(
    'dl',
    className,
    ...list.flatMap(([label, value, c]) => [h('dt', classLabels ? c : {}, label), h('dd', c, ...[value].flat())]),
  );

/** A block's head: its title, a line about it, and its actions on the right. */
export const blockHead = (title: string, about: Child[], actions?: Child) =>
  h('div', 'bhead', h('div', {}, h('h4', {}, title), h('p', {}, ...about)), actions);

/** A heading with how many there are, then the items, in a `wrap` div when given; nothing for none. */
export const counted = (title: string, items: Child[], wrap?: string): Child[] =>
  items.length ? [h('h3', {}, `${title} · ${items.length}`), ...(wrap ? [h('div', wrap, ...items)] : items)] : [];

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const time = (at: number) => {
  const d = new Date(at);
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

export const clock = (at: number) => time(at).slice(0, 8);

export const stamp = (at: number) => h('span', 'time', time(at));

export const empty = (title: string, detail = '', figure: IconName = 'search') =>
  h(
    'section',
    'empty',
    h('header', {}, h('figure', {}, icon(figure)), h('h3', {}, title), detail && h('p', {}, detail)),
  );

export function expandable(
  summary: Child[],
  path: string,
  open: Set<string>,
  fill: () => Child[],
  className = '',
): HTMLDetailsElement {
  const node = h('details', className, h('summary', {}, ...summary));
  let filled = false;
  const show = () => {
    if (filled) return;
    filled = true;
    node.append(...nodes(fill()));
  };
  node.addEventListener('toggle', () => {
    if (!node.open) return void open.delete(path);
    open.add(path);
    show();
  });
  if (open.has(path)) {
    node.open = true;
    show();
  }
  return node;
}

export function tree(label: Child, value: unknown, path: string, open: Set<string>): HTMLElement {
  if (!value || typeof value !== 'object' || value instanceof Error) return h('div', 'row', label, ' ', leaf(value));
  return expandable([label, ' ', h('span', 'dim', preview(value))], path, open, () =>
    Object.entries(value).map(([k, v]) => tree(h('span', 'key', k), v, `${path}.${k}`, open)),
  );
}

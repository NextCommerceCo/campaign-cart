import { type IconName, icon } from './icons';

export type Child = Node | string | false | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> | string = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), typeof props === 'string' ? { className: props } : props);
  el.append(...children.filter((c): c is Node | string => !!c));
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

export const iconButton = (name: IconName, label: string, onclick: () => void, size = 'icon-xs') => {
  const el = button(icon(name), onclick, { variant: 'ghost', size }, label);
  el.setAttribute('aria-label', label);
  return el;
};

export const tablist = (data: Record<string, string>, label = '') => {
  const el = tsugi(h('div', {}), data);
  el.setAttribute('role', 'tablist');
  if (label) el.setAttribute('aria-label', label);
  return el;
};

export const tab = (selected: boolean, onclick: () => void, ...label: Child[]) => {
  const el = h('button', { type: 'button', onclick }, ...label);
  el.setAttribute('role', 'tab');
  el.setAttribute('aria-selected', String(selected));
  return el;
};

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

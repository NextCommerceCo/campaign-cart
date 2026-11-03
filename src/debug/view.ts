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

export function hoverCard(trigger: HTMLElement, fill: () => Child[]): HTMLElement {
  const card = h('div', 'hovercard');
  card.dataset.popover = '';
  card.dataset.side = 'bottom';
  card.setAttribute('role', 'tooltip');
  card.setAttribute('aria-hidden', 'true');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      card.replaceChildren(...nodes(fill()));
      const { top, bottom, right } = trigger.getBoundingClientRect();
      const below = bottom + card.offsetHeight <= document.documentElement.clientHeight;
      card.dataset.side = below ? 'bottom' : 'top';
      Object.assign(card.style, {
        top: `${below ? bottom : top - card.offsetHeight}px`,
        right: `${document.documentElement.clientWidth - right}px`,
      });
      card.setAttribute('aria-hidden', 'false');
    }, 200);
  };
  const hide = () => {
    clearTimeout(timer);
    card.setAttribute('aria-hidden', 'true');
  };
  trigger.addEventListener('mouseenter', show);
  trigger.addEventListener('mouseleave', hide);
  trigger.append(card);
  return trigger;
}

export const nodes = (children: Child[]) => children.filter((c): c is Node | string => !!c);

export const time = (at: number) => {
  const d = new Date(at);
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

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

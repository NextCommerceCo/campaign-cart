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

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | false | undefined> = {},
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== false && v !== undefined) el.setAttribute(k, String(v));
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

export const nodes = (children: Child[]) => children.filter((c): c is Node | string => !!c);

export const time = (at: number) => {
  const d = new Date(at);
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

export const empty = (title: string, detail = '', className = 'empty') =>
  h('div', className, h('b', {}, title), detail && h('div', {}, detail));

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

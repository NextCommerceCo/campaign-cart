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

export function tree(label: Child, value: unknown, path: string, open: Set<string>): HTMLElement {
  if (!value || typeof value !== 'object' || value instanceof Error) return h('div', 'row', label, ' ', leaf(value));
  const node = h('details', {}, h('summary', {}, label, ' ', h('span', 'dim', preview(value))));
  let filled = false;
  const fill = () => {
    if (filled) return;
    filled = true;
    node.append(...Object.entries(value).map(([k, v]) => tree(h('span', 'key', k), v, `${path}.${k}`, open)));
  };
  node.addEventListener('toggle', () => {
    if (!node.open) return void open.delete(path);
    open.add(path);
    fill();
  });
  if (open.has(path)) {
    node.open = true;
    fill();
  }
  return node;
}

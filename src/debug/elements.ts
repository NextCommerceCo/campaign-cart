import { conditionMet, parseCondition } from '../engine/condition';
import type { Engine } from '../engine/engine';
import { format, localeOf, truthy } from '../engine/format';
import { resolve } from '../engine/values';
import { replacementFor } from './legacy';
import { empty, h } from './view';

const PREFIX = 'data-next-';

export interface Note {
  attr: string;
  value: string;
  note?: string;
  bad?: boolean;
  /** The attributes v2 name an earlier attribute has. */
  legacy?: string;
}

export interface Inspected {
  el: Element;
  notes: Note[];
  bad: boolean;
}

export interface Box {
  el: HTMLElement;
  show(target: Element): void;
  hide(): void;
}

const sdkAttrs = (el: Element) => el.getAttributeNames().filter((a) => a.startsWith(PREFIX));

const isSdkElement = (el: Element) => el !== document.documentElement && sdkAttrs(el).length > 0;

const lineage = (el: Element | null): Element[] => (el ? [el, ...lineage(el.parentElement)] : []);

const describe = (el: Element) =>
  `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList]
    .filter((c) => !c.startsWith('next-'))
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join('')}`;

function noteFor(engine: Engine, el: Element, attr: string, value: string): Omit<Note, 'attr' | 'value'> {
  const { campaign } = engine.getState();
  if (attr === 'data-next-package-id') {
    const pkg = engine.getPackage(Number(value));
    if (!campaign) return {};
    return pkg ? { note: `${pkg.name} · ${pkg.price}` } : { note: 'not in this campaign', bad: true };
  }
  const toggle = attr === 'data-next-show' || attr === 'data-next-hide';
  if (!toggle && attr !== 'data-next-display') return {};
  const condition = toggle ? parseCondition(value) : undefined;
  if (condition === null) return { note: 'cannot read', bad: true };
  const path = condition?.path ?? value;
  if (!path.includes('.') && el.closest('[data-next-bundle-card]')) return {};
  const packageId = Number(el.closest('[data-next-package-id]')?.getAttribute('data-next-package-id'));
  const v = resolve(engine, path, packageId ? { packageId } : {});
  if (!v) return { note: 'unknown path', bad: true };
  if (condition) {
    const shown = conditionMet(condition, v) === (attr === 'data-next-show');
    return { note: `${JSON.stringify(v.value) ?? 'undefined'} → ${shown ? 'shown' : 'hidden'}` };
  }
  if (v.type === 'bool') return { note: truthy(v) ? 'shown' : 'hidden' };
  return {
    note: JSON.stringify(
      format(v, campaign?.currency, localeOf(engine.getState()), el.getAttribute('data-next-format')),
    ),
  };
}

export function explain(engine: Engine, el: Element): Note[] {
  return sdkAttrs(el).map((attr) => {
    const value = el.getAttribute(attr) ?? '';
    const legacy = replacementFor(attr, value);
    return { attr, value, ...noteFor(engine, el, attr, value), ...(legacy && { legacy }) };
  });
}

export function highlighter(): Box {
  const label = h('span');
  const el = h('div', 'box', label);
  return {
    el,
    show(target) {
      const r = target.getBoundingClientRect();
      label.textContent = `${describe(target)}${r.width || r.height ? '' : ' (not visible)'}`;
      Object.assign(el.style, {
        display: 'block',
        top: `${r.top}px`,
        left: `${r.left}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    },
    hide() {
      el.style.display = 'none';
    },
  };
}

export function inspect(engine: Engine, picked?: Element): Inspected[] {
  return (picked ? lineage(picked) : [...document.body.querySelectorAll('*')]).filter(isSdkElement).map((el) => {
    const notes = explain(engine, el);
    return { el, notes, bad: notes.some((n) => n.bad) };
  });
}

export const countElements = () => [...document.body.querySelectorAll('*')].filter(isSdkElement).length;

export const matches = ({ el, notes }: Inspected, query: string) =>
  [describe(el), ...notes.map((n) => `${n.attr}="${n.value}"`)].join(' ').toLowerCase().includes(query);

export function card({ el, notes, bad }: Inspected, box: Box): HTMLElement {
  const row = h(
    'div',
    bad ? 'ecard bad' : 'ecard',
    h(
      'div',
      {},
      h('span', 'tagname', describe(el)),
      ...[...el.classList].filter((c) => c.startsWith('next-')).map((c) => h('span', 'class-tag', c)),
    ),
    ...notes.map((n) =>
      h(
        'div',
        n.bad ? 'attr bad' : 'attr',
        h('span', 'name', n.attr),
        '=',
        h('span', 's', `"${n.value}"`),
        n.note && h('span', 'note', ` → ${n.note}`),
        n.legacy && h('span', 'note', ` · legacy, now ${n.legacy}`),
      ),
    ),
  );
  row.onmouseenter = () => box.show(el);
  row.onmouseleave = () => box.hide();
  row.onclick = () => {
    el.scrollIntoView({ block: 'center' });
    box.show(el);
  };
  return row;
}

export function pick(host: Element, box: Box, done: (el?: Element) => void): () => void {
  const inside = (e: Event) => e.composedPath().includes(host);
  const target = (e: Event) => lineage(e.target as Element).find(isSdkElement);
  const over = (e: Event) => {
    const el = !inside(e) && target(e);
    if (el) box.show(el);
    else box.hide();
  };
  const click = (e: Event) => {
    if (inside(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const el = target(e);
    if (el) finish(el);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    finish();
  };
  const finish = (el?: Element) => {
    document.removeEventListener('mouseover', over, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('keydown', key, true);
    box.hide();
    done(el);
  };
  document.addEventListener('mouseover', over, true);
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', key, true);
  return () => finish();
}

const LIMIT = 200;

/** The Elements tab: every element with a data-next-* attribute, or the picked one and its SDK parents. */
export function elementsView(engine: Engine, box: Box, picked: Element | undefined, query: string, unpick: () => void) {
  const found = inspect(engine, picked).filter((i) => matches(i, query));
  const bad = found.filter((i) => i.bad).length;
  if (!found.length)
    return [
      query
        ? empty('Nothing matches', 'No element with a data-next-* attribute fits the filter.')
        : empty('No SDK elements', 'No element on this page has a data-next-* attribute.'),
    ];
  return [
    h(
      'div',
      'summary',
      picked ? 'Picked element and its SDK parents' : `${found.length} elements`,
      bad > 0 && h('span', 'red', ` · ${bad} with problems`),
      picked && h('button', { type: 'button', className: 'link', onclick: unpick }, 'Show all'),
    ),
    ...found.slice(0, LIMIT).map((i) => card(i, box)),
    found.length > LIMIT && h('div', 'summary', `Showing ${LIMIT} of ${found.length}. Filter to narrow.`),
  ];
}

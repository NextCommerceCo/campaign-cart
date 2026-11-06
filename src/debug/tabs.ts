import { type IconName, icon } from './icons';
import { badge, h, tab as tabButton, tablist } from './view';

export const TABS = {
  journey: 'Journey',
  issues: 'Issues',
  checkout: 'Checkout',
  analytics: 'Analytics',
  events: 'Events',
  elements: 'Elements',
  state: 'State',
  logs: 'Logs',
  benchmark: 'Performance',
};
export type Tab = keyof typeof TABS;
/** Developer mode's tabs, in the Developer tab's dropdown. */
export const DEV: Tab[] = ['elements', 'state', 'logs', 'benchmark'];
const ICONS: Record<string, IconName> = { elements: 'code', state: 'braces', logs: 'list', benchmark: 'gauge' };
const ALL = Object.keys(TABS) as Tab[];

const item = (glyph: IconName, label: string, onclick: () => void) => {
  const el = h('button', { type: 'button', onclick }, icon(glyph), h('span', {}, label));
  el.setAttribute('role', 'menuitem');
  return el;
};

/** The panel's tabs: one row, Developer's tools in a dropdown on its last tab, and one select for a narrow panel. */
export function tabBar(show: (tab: Tab) => void, pick: () => void) {
  let open = false;
  const main = ALL.filter((t) => !DEV.includes(t)).map((t) => {
    const el = tabButton(false, () => show(t), TABS[t]);
    el.dataset.tab = t;
    return el;
  });
  const developer = tabButton(false, () => toggle());
  developer.dataset.tab = 'developer';
  developer.setAttribute('aria-haspopup', 'menu');
  const strip = tablist({ size: 'sm' });
  strip.append(...main, developer);

  const info = h('dl', 'dinfo');
  const tools = DEV.map((t) => {
    const el = item(ICONS[t]!, TABS[t], () => (close(), show(t)));
    el.dataset.tab = t;
    return el;
  });
  const list = h(
    'div',
    'mlist',
    ...tools,
    h('div', { role: 'separator' }),
    item('pick', 'Pick an element', () => (close(), pick())),
  );
  list.setAttribute('role', 'menu');
  list.setAttribute('aria-label', 'Developer');
  const menu = h('div', 'dmenu dropdown pop', list, info);
  menu.hidden = true;

  const close = () => {
    open = false;
    menu.hidden = true;
    developer.setAttribute('aria-expanded', 'false');
  };
  const toggle = () => {
    if (open) return close();
    open = true;
    menu.hidden = false;
    developer.setAttribute('aria-expanded', 'true');
    const box = (menu.offsetParent ?? document.body).getBoundingClientRect();
    menu.style.left = `${Math.max(8, developer.getBoundingClientRect().left - box.left)}px`;
  };

  const select = h(
    'select',
    { className: 'select tabpick', onchange: () => show(select.value as Tab) },
    ...ALL.map((t) => h('option', { value: t }, DEV.includes(t) ? `Developer · ${TABS[t]}` : TABS[t])),
  );
  select.setAttribute('aria-label', 'Panel tab');

  const paint = (now: { tab: Tab; dev: boolean; issues: number; tone: string; setup: Array<[string, string]> }) => {
    const inDev = now.dev && DEV.includes(now.tab);
    for (const el of main) el.setAttribute('aria-selected', String(el.dataset.tab === now.tab));
    for (const el of tools) el.setAttribute('aria-current', String(el.dataset.tab === now.tab));
    developer.hidden = !now.dev;
    developer.setAttribute('aria-selected', String(inDev));
    developer.replaceChildren(inDev ? TABS[now.tab] : 'Developer', icon('chevron'));
    if (!now.dev) close();
    info.replaceChildren(...now.setup.flatMap(([k, v]) => [h('dt', {}, k), h('dd', { title: v }, v)]));
    main
      .find((el) => el.dataset.tab === 'issues')!
      .replaceChildren(
        TABS.issues,
        ...(now.issues > 0 ? [badge(String(now.issues), now.tone === 'red' ? 'destructive' : 'warning')] : []),
      );
    for (const o of select.options) o.hidden = o.disabled = !now.dev && DEV.includes(o.value as Tab);
    select.value = now.tab;
    select.querySelector('[value="issues"]')!.textContent = now.issues ? `${TABS.issues} · ${now.issues}` : TABS.issues;
  };

  return {
    strip,
    menu,
    select,
    paint,
    close,
    /** The dropdown is open and the click landed outside it and its tab. */
    outside: (path: EventTarget[]) => open && !path.includes(menu) && !path.includes(developer),
    isOpen: () => open,
  };
}

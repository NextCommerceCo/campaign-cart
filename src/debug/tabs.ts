import { icon } from './icons';
import { badge, button, h, tab as tabButton, tablist } from './view';

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
/** Developer mode's tabs, under one Developer tab. */
export const DEV: Tab[] = ['elements', 'state', 'logs', 'benchmark'];
const ALL = Object.keys(TABS) as Tab[];

/** The panel's tabs: the main row, Developer's own row under it, and one select for a narrow panel. */
export function tabBar(show: (tab: Tab) => void, pick: () => void) {
  let lastDev: Tab = 'elements';
  const make = (t: Tab) => {
    const el = tabButton(false, () => show(t), TABS[t]);
    el.dataset.tab = t;
    return el;
  };
  const main = ALL.filter((t) => !DEV.includes(t)).map(make);
  const developer = tabButton(false, () => show(lastDev), 'Developer');
  developer.dataset.tab = 'developer';
  const strip = tablist({ size: 'sm' });
  strip.append(...main, developer);
  const subs = DEV.map(make);
  const sub = tablist({ size: 'sm' }, 'Developer');
  sub.append(...subs);
  const picker = button(
    icon('pick'),
    pick,
    { variant: 'ghost', size: 'xs' },
    'Click an element on the page to inspect it',
  );
  picker.append('Pick');
  const info = h('small', 'dinfo');
  const devBar = h('div', 'dbar', h('div', 'tabs', sub), info, picker);
  const select = h(
    'select',
    { className: 'select tabpick', onchange: () => show(select.value as Tab) },
    ...ALL.map((t) => h('option', { value: t }, DEV.includes(t) ? `Developer · ${TABS[t]}` : TABS[t])),
  );
  select.setAttribute('aria-label', 'Panel tab');

  const paint = (now: { tab: Tab; dev: boolean; issues: number; tone: string; setup: string }) => {
    if (DEV.includes(now.tab)) lastDev = now.tab;
    const inDev = now.dev && DEV.includes(now.tab);
    for (const el of [...main, ...subs]) el.setAttribute('aria-selected', String(el.dataset.tab === now.tab));
    developer.hidden = !now.dev;
    developer.setAttribute('aria-selected', String(inDev));
    devBar.hidden = !inDev;
    info.textContent = now.setup;
    info.title = now.setup;
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

  return { strip, devBar, select, paint };
}

import type { Engine } from '../engine/engine';
import { card, type highlighter, inspect } from './elements';
import type { DebugActions, PageVisit } from './state';
import { icon } from './icons';
import { badge, type Child, empty, h, plural } from './view';

export type IssueTab = 'journey' | 'checkout' | 'analytics';
const LABELS: Record<IssueTab, string> = { journey: 'Journey', checkout: 'Checkout', analytics: 'Analytics' };

type Problem = { text: string; error: boolean };
type Tone = 'error' | 'warn' | 'note';
const TAGS: Record<Tone, [string, string]> = {
  error: ['Error', 'destructive'],
  warn: ['Warning', 'warning'],
  note: ['Note', 'secondary'],
};

/** One problem: its tone, what happened (the text before `: `), and the rest with where it was found. */
const row = (text: string, from: string, tone: Tone, onclick: () => void, times = 1) => {
  const cut = text.indexOf(': ');
  const [title, detail] = cut > 0 ? [text.slice(0, cut), text.slice(cut + 2)] : [text, ''];
  const el = h(
    'button',
    { type: 'button', className: 'irow', onclick },
    badge(...TAGS[tone]),
    h(
      'span',
      'itext',
      h('b', {}, title),
      h('small', {}, [detail, from, times > 1 && `×${times}`].filter(Boolean).join(' · ')),
    ),
    icon('chevron'),
  );
  el.dataset.tone = tone;
  return el;
};

/** Problems with the same text and tab, once each with how many times. */
const grouped = <T extends { text: string; from: IssueTab }>(list: T[]) => {
  const seen = new Map<string, T & { times: number }>();
  for (const item of list) {
    const key = `${item.from} ${item.text}`;
    seen.set(key, { ...item, times: (seen.get(key)?.times ?? 0) + 1 });
  }
  return [...seen.values()];
};

export function issuesView(
  engine: Engine,
  debug: DebugActions,
  ui: {
    checkout: { problems(): Problem[] };
    flow: { problems(): Problem[]; notes(): string[] };
    logs: { row(entry: ReturnType<Engine['log']['entries']>[number]): Child };
    box: ReturnType<typeof highlighter>;
    show(tab: IssueTab): void;
  },
) {
  const { checkout, flow, logs, box, show } = ui;
  const find = () => {
    const page = inspect(engine).filter((i) => i.bad);
    const shownOnPage = page.flatMap((i) => i.notes.filter((n) => n.bad).map((n) => `"${n.value}"`));
    const logged = engine.log
      .entries()
      .filter((e) => (e.level === 'warn' || e.level === 'error') && !shownOnPage.some((v) => e.message.includes(v)))
      .reverse();
    const pages = debug.state().pages;
    const marks = (p: PageVisit | undefined) => (p?.marks ?? []).filter((m) => m.tone === 'warn' || m.tone === 'error');
    const found = grouped([
      ...marks(pages.at(-1)).map((m) => ({ from: 'journey' as IssueTab, text: m.text, error: m.tone === 'error' })),
      ...checkout.problems().map((p) => ({ from: 'checkout' as IssueTab, ...p })),
      ...flow.problems().map((p) => ({ from: 'analytics' as IssueTab, ...p })),
    ]);
    const earlier = pages.slice(0, -1).reduce((n, p) => n + new Set(marks(p).map((m) => m.text)).size, 0);
    const tone = logged.some((e) => e.level === 'error') || found.some((f) => f.error) ? 'red' : 'amber';
    return {
      page,
      logged,
      found,
      earlier,
      notes: flow.notes(),
      count: page.length + logged.length + found.length,
      tone,
    };
  };

  const view = (): Child[] => {
    const { page, logged, found, earlier, notes } = find();
    const before =
      earlier > 0 &&
      h(
        'p',
        'summary',
        `Earlier pages in this tab had ${plural(earlier, 'problem')}. `,
        h('button', { type: 'button', className: 'link', onclick: () => show('journey') }, 'Open Journey'),
      );
    const setup = [
      notes.length > 0 && h('h3', {}, `Setup notes · ${notes.length}`),
      notes.length > 0 &&
        h('div', 'ilist', ...notes.map((text) => row(text, LABELS.analytics, 'note', () => show('analytics')))),
    ];
    if (!page.length && !logged.length && !found.length)
      return [
        empty(
          'No issues',
          'Nothing on this page needs a look: every SDK attribute resolves, the journey, checkout and analytics found no problems, and no warnings were logged.',
          'check',
        ),
        before,
        ...setup,
      ];
    return [
      found.length > 0 && h('h3', {}, `Problems · ${found.length}`),
      found.length > 0 &&
        h(
          'div',
          'ilist',
          ...found.map((f) => row(f.text, LABELS[f.from], f.error ? 'error' : 'warn', () => show(f.from), f.times)),
        ),
      page.length > 0 && h('h3', {}, `Page setup · ${page.length}`),
      ...page.map((i) => card(i, box)),
      logged.length > 0 && h('h3', {}, `Warnings and errors · ${logged.length}`),
      ...logged.map(logs.row),
      before,
      ...setup,
    ];
  };

  return { find, view };
}

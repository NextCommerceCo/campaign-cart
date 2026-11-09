import type { Engine } from '../../engine/engine';
import { card, type highlighter, inspect } from './elements';
import type { DebugActions, PageVisit } from '../state';
import { icon } from '../ui/icons';
import { type Child, counted, empty, h, link, plural, toned } from '../ui/view';

export type IssueTab = 'journey' | 'checkout' | 'analytics';
const LABELS: Record<IssueTab, string> = { journey: 'Journey', checkout: 'Checkout', analytics: 'Analytics' };

/** A problem another tab found, and how to open where it is: a modal, or a part of that tab (`focus`). */
type Problem = { text: string; error: boolean; open?: () => void; focus?: string };
type Tone = 'error' | 'warn' | 'note';

interface Sources {
  checkout: { problems(): Problem[] };
  flow: { problems(): Problem[]; notes(): string[] };
  logs: { row(entry: ReturnType<Engine['log']['entries']>[number]): Child };
  box: ReturnType<typeof highlighter>;
  show(tab: IssueTab): void;
  /** Shows a tab scrolled to its `[data-focus]` part, flashed. */
  focus(tab: IssueTab, part: string): void;
  /** Opens this page's Journey detail. */
  journey(): void;
}

/** One problem: its tone, what happened (the text before `: `), and the rest with where it was found. */
const row = (text: string, from: string, tone: Tone, onclick: () => void, times = 1) => {
  const cut = text.indexOf(': ');
  const [title, detail] = cut > 0 ? [text.slice(0, cut), text.slice(cut + 2)] : [text, ''];
  return toned(
    h(
      'button',
      { type: 'button', className: 'irow', onclick },
      h(
        'span',
        'itext',
        h('b', {}, title),
        h('small', {}, [detail, from, times > 1 && `×${times}`].filter(Boolean).join(' · ')),
      ),
      icon('chevron'),
    ),
    tone,
  );
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

const warned = (p: PageVisit | undefined) => (p?.marks ?? []).filter((m) => m.tone === 'warn' || m.tone === 'error');

/** Every problem on this page: SDK attributes, warnings logged, and what the other tabs found. */
function findIssues(engine: Engine, debug: DebugActions, ui: Sources) {
  const page = inspect(engine).filter((i) => i.bad);
  const shownOnPage = page.flatMap((i) => i.notes.filter((n) => n.bad).map((n) => `"${n.value}"`));
  const logged = engine.log
    .entries()
    .filter((e) => (e.level === 'warn' || e.level === 'error') && !shownOnPage.some((v) => e.message.includes(v)))
    .reverse();
  const pages = debug.state().pages;
  const found = grouped<Problem & { from: IssueTab }>([
    ...warned(pages.at(-1)).map((m) => ({
      from: 'journey' as IssueTab,
      text: m.text,
      error: m.tone === 'error',
      open: ui.journey,
    })),
    ...ui.checkout.problems().map((p) => ({ from: 'checkout' as IssueTab, ...p })),
    ...ui.flow.problems().map((p) => ({ from: 'analytics' as IssueTab, ...p })),
  ]);
  const earlier = pages.slice(0, -1).reduce((n, p) => n + new Set(warned(p).map((m) => m.text)).size, 0);
  const tone = logged.some((e) => e.level === 'error') || found.some((f) => f.error) ? 'red' : 'amber';
  return {
    page,
    logged,
    found,
    earlier,
    notes: ui.flow.notes(),
    count: page.length + logged.length + found.length,
    tone,
  };
}

export function issuesView(engine: Engine, debug: DebugActions, ui: Sources) {
  const { box, show, focus } = ui;
  const find = () => findIssues(engine, debug, ui);

  const view = (): Child[] => {
    const { page, logged, found, earlier, notes } = find();
    const before =
      earlier > 0 &&
      h(
        'p',
        'summary',
        `Earlier pages in this tab had ${plural(earlier, 'problem')}. `,
        link('Open Journey', () => show('journey')),
      );
    const setup = counted(
      'Setup notes',
      notes.map((text) => row(text, LABELS.analytics, 'note', () => show('analytics'))),
      'ilist',
    );
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
    const problems = found.map((f) =>
      row(
        f.text,
        LABELS[f.from],
        f.error ? 'error' : 'warn',
        f.open ?? (() => (f.focus ? focus(f.from, f.focus) : show(f.from))),
        f.times,
      ),
    );
    return [
      ...counted('Problems', problems, 'ilist'),
      ...counted(
        'Page setup',
        page.map((i) => card(i, box)),
      ),
      ...counted('Warnings and errors', logged.map(ui.logs.row)),
      before,
      ...setup,
    ];
  };

  return { find, view };
}

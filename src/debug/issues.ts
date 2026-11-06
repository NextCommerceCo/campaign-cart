import type { Engine } from '../engine/engine';
import { card, type highlighter, inspect } from './elements';
import type { DebugActions, PageVisit } from './state';
import { badge, type Child, empty, h, plural } from './view';

export type IssueTab = 'journey' | 'checkout' | 'analytics';
const LABELS: Record<IssueTab, string> = { journey: 'Journey', checkout: 'Checkout', analytics: 'Analytics' };

type Problem = { text: string; error: boolean };

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
    const found: Array<{ from: IssueTab; text: string; error: boolean }> = [
      ...marks(pages.at(-1)).map((m) => ({ from: 'journey' as IssueTab, text: m.text, error: m.tone === 'error' })),
      ...checkout.problems().map((p) => ({ from: 'checkout' as IssueTab, ...p })),
      ...flow.problems().map((p) => ({ from: 'analytics' as IssueTab, ...p })),
    ];
    const earlier = pages.slice(0, -1).reduce((n, p) => n + marks(p).length, 0);
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
      ...notes.map((text) =>
        h(
          'div',
          { className: 'ecard', onclick: () => show('analytics') },
          badge(LABELS.analytics, 'outline'),
          ' ',
          text,
        ),
      ),
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
      ...found.map((f) =>
        h(
          'div',
          { className: `ecard${f.error ? ' bad' : ''}`, onclick: () => show(f.from) },
          badge(LABELS[f.from], 'outline'),
          ' ',
          f.text,
        ),
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

import type { PageConfig } from '../engine/debug-config';
import type { Engine } from '../engine/engine';
import { type IconName, icon } from './icons';
import { LANGUAGES } from './locale';
import type { DebugActions } from './state';
import {
  clone,
  type Field,
  get,
  LOADER,
  normalize,
  type Obj,
  put,
  READ,
  SCRIPT_TAG,
  SECTIONS,
  short,
  snippetOf,
  withoutLoader,
} from './draft';
import { badge, type Child, h, iconButton, nodes, tab, tablist, tsugi } from './view';

export type ConfigSection = 'analytics' | 'language' | 'checkout' | 'page';

export interface PageConfigModal {
  dialog: HTMLDialogElement;
  open(section?: ConfigSection): void;
  /** This tab runs with a nextConfig tried from the modal, not the page's own. */
  trying(): boolean;
  /** Back to the page's own nextConfig: forgets the tried one and reloads. */
  reset(): void;
}

const action = (name: IconName, label: string, onclick: () => void, variant?: string) =>
  tsugi(h('button', { type: 'button', className: 'btn', onclick }, icon(name), label), variant ? { variant } : {});

export function configModal(
  engine: Engine,
  debug: DebugActions,
  info: { page: PageConfig; tried: boolean },
  render: () => void,
): PageConfigModal {
  const effective = (window as unknown as { nextConfig?: PageConfig }).nextConfig ?? {};
  const start = normalize(effective);
  const pageSnippet = snippetOf(normalize(info.page).draft);
  let draft = clone(start.draft) as Obj;
  let hints: Array<() => void> = [];

  const trying = () => info.tried || !!debug.state().config;
  const reset = () => {
    debug.setConfig(undefined);
    location.reload();
  };
  const snippet = () => snippetOf(draft);

  const origin = (f: Field): Child[] => {
    const now = get(draft, f.path);
    const was = get(start.draft, f.path);
    if ((now ?? f.fallback) !== (was ?? f.fallback)) return [h('b', {}, 'edited')];
    if (start.legacy[f.path]) return [badge('0.4.x', 'warning'), start.legacy[f.path]];
    const top = f.path.split('.')[0]!;
    return now !== undefined && info.tried && JSON.stringify(effective[top]) !== JSON.stringify(info.page[top])
      ? ['tried']
      : [];
  };

  const change = (path: string, value: unknown) => {
    put(draft, path, value);
    paint();
  };

  const control = (f: Field, value: unknown): HTMLElement => {
    if (f.kind === 'switch') {
      const el = h('input', { type: 'checkbox', className: 'input', checked: (value ?? f.fallback) === true });
      el.onchange = () => change(f.path, el.checked);
      el.setAttribute('role', 'switch');
      return el;
    }
    if (f.kind === 'text') {
      const el = h('input', { type: 'text', className: 'input', value: typeof value === 'string' ? value : '' });
      el.placeholder = f.placeholder ?? '';
      el.oninput = () => change(f.path, el.value || undefined);
      return el;
    }
    if (f.kind === 'locale') {
      const current = typeof value === 'string' ? value : '';
      const el = h(
        'select',
        { className: 'select', onchange: () => change(f.path, el.value || undefined) },
        h('option', { value: '' }, 'Campaign default'),
        current && !(current in LANGUAGES) && h('option', { value: current }, current),
        ...Object.entries(LANGUAGES).map(([code, name]) => h('option', { value: code }, name)),
      );
      el.value = current;
      return el;
    }
    return h('code', 'cval', value === undefined ? 'not set' : (f.summary ?? short)(value));
  };

  const row = (f: Field) => {
    const from = h('small', 'cfrom');
    hints.push(() => from.replaceChildren(...nodes(origin(f))));
    const input = control(f, get(draft, f.path));
    if (f.kind !== 'view') input.setAttribute('aria-label', f.label);
    return h(f.kind === 'view' ? 'div' : 'label', 'crow', h('span', 'clabel', h('span', {}, f.label), from), input);
  };

  const fixed = (label: string, value: unknown, hint: string) =>
    h(
      'div',
      'crow',
      h('span', 'clabel', h('span', {}, label), h('small', 'cfrom', hint)),
      h('code', 'cval', value === undefined ? 'not set' : short(value)),
    );

  const note = (text: Child, warn = false) => {
    const el = h('p', 'cnote', warn && icon('warn'), text);
    if (warn) el.dataset.tone = 'warn';
    return el;
  };

  const group = (id: string, title: string, ...children: Child[]) => {
    const el = h('div', 'cgroup', h('h3', 'chead', title), ...children);
    el.dataset.section = id;
    return el;
  };

  const notes: Record<ConfigSection, () => Child[]> = {
    analytics: () => [
      get(draft, 'analytics.providers.custom.enabled') === true &&
        note("providers.custom is not built in: send events from next.analytics.on('*', fn).", true),
    ],
    language: () => {
      const lang = engine.getState().visit.params.lang;
      return [lang && note(`?lang=${lang} in the URL wins over Language on this page.`)];
    },
    checkout: () => [],
    page: () => [note('Sent to RudderStack as page_type; a next-page-type meta tag wins.')],
  };

  const editor = h('div', 'cedit scrollbar-sm');
  const code = h('pre', 'ccode scrollbar-sm');
  const loaders = Object.keys(info.page).filter((k) => LOADER.has(k));
  const others = () => Object.keys(draft).filter((k) => !READ.has(k) && !LOADER.has(k));

  const paint = () => {
    for (const hint of hints) hint();
    const text = snippet();
    code.textContent = text;
    resetButton.hidden = !trying() && text === pageSnippet;
  };

  const fill = () => {
    hints = [];
    editor.replaceChildren(
      ...nodes([
        start.converted.length > 0 &&
          note(`0.4.x keys are shown in the current format: ${start.converted.join(', ')}.`, true),
        ...SECTIONS.map(([id, title, fields]) => group(id, title, ...fields.map(row), ...notes[id]())),
        loaders.length > 0 &&
          group(
            'loader',
            'Loader keys',
            ...loaders.map((k) => fixed(k, info.page[k], `script tag: ${SCRIPT_TAG[k]}`)),
            note('Read before the SDK starts: put them on the script tag. Never tried, and left out of the snippet.'),
          ),
        others().length > 0 &&
          group(
            'other',
            'Other keys',
            ...others().map((k) => fixed(k, draft[k], 'not read by the SDK')),
            note('Kept as they are in the snippet.'),
          ),
      ]),
    );
    paint();
  };

  const copied = document.createTextNode('Copy');
  const copy = () => {
    const done = () => {
      copied.textContent = 'Copied';
      setTimeout(() => (copied.textContent = 'Copy'), 1500);
    };
    const select = () => getSelection()?.selectAllChildren(code);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(snippet()).then(done, select);
    else select();
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([snippet()], { type: 'text/javascript' }));
    h('a', { href: url, download: 'next-config.js' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const tryOn = () => {
    const tried = withoutLoader(draft);
    for (const key of Object.keys(info.page)) if (!(key in tried) && !LOADER.has(key)) tried[key] = null;
    debug.setConfig(JSON.parse(JSON.stringify(tried)) as PageConfig);
    location.reload();
  };
  const resetButton = action(
    'reset',
    'Reset to page config',
    () => {
      if (trying()) return reset();
      draft = clone(start.draft) as Obj;
      fill();
    },
    'ghost',
  );
  const copyButton = action('copy', '', copy, 'outline');
  copyButton.append(copied);

  const snip = h(
    'aside',
    'csnip',
    h('small', {}, 'window.nextConfig for the page, defaults left out'),
    code,
    note(
      `Try on this tab applies it to every page of this tab while debug mode is on.${loaders.length ? ` ${loaders.join(' and ')} ${loaders.length > 1 ? 'stay' : 'stays'} on the script tag.` : ''}`,
    ),
  );
  const views = tablist({ size: 'sm' }, 'Page config view');
  const show = (code: boolean) => {
    editor.hidden = code;
    snip.hidden = !code;
    views.replaceChildren(
      tab(!code, () => show(false), 'Settings'),
      tab(code, () => show(true), 'Code'),
    );
  };
  show(false);

  const dialog = tsugi(
    h(
      'dialog',
      'dialog cmodal',
      h(
        'div',
        {},
        h(
          'header',
          {},
          h('h2', {}, 'Page config', info.tried && badge('Trying', 'warning')),
          h(
            'p',
            {},
            info.tried
              ? 'Trying a config on this tab. The page keeps its own: Reset goes back to it.'
              : 'window.nextConfig on this page. Edit it, copy it, or try it on this tab.',
          ),
        ),
        h('section', 'cbody', h('div', 'ctabs tabs', views), editor, snip),
        h(
          'footer',
          {},
          resetButton,
          action('download', 'Download .js', download, 'outline'),
          copyButton,
          action('flask', 'Try on this tab', tryOn),
        ),
        iconButton('close', 'Close dialog', () => dialog.close(), 'icon-sm'),
      ),
    ),
    { size: 'xl' },
  );
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  dialog.addEventListener('close', render);

  return {
    dialog,
    open(section) {
      if (!dialog.open) dialog.showModal();
      show(false);
      fill();
      const target = section && editor.querySelector<HTMLElement>(`[data-section="${section}"]`);
      if (!target) return;
      target.scrollIntoView?.({ block: 'start' });
      target.querySelector<HTMLElement>('input, select')?.focus();
    },
    trying,
    reset,
  };
}

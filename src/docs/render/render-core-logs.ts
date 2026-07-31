/**
 * Renders `src/core/guide/reference/logs.md` — every message the SDK's own machinery
 * can print, at the exact wording, grouped by the console prefix it appears under.
 *
 * Two inputs, deliberately kept apart. The **messages** come from the source
 * (`src/docs/extract/extract-logs.ts` reads all 480 `logger.*` call sites in `src/core`),
 * so nothing here can disagree with the code about what a line says. The **Meaning and
 * Action** for each `error` and `warn` come from `core-logs.ts`, because no generator
 * can say what to do about a failure.
 *
 * Build-time only — see the note on {@link CoreLogSource}.
 */

import type { CoreConsoleLog, CoreLogSource } from '../content/core-logs';
import type { LogEntry } from './render-feature-reference';
import { coreNav } from '../content/nav';

/** One message, with the prose attached when the level requires it. */
export interface CoreLogRow extends LogEntry {
  /** Required for `error` and `warn`; absent for `info` and `debug`. */
  meaning?: string;
  action?: string;
  /**
   * Set for a message the extractor cannot read — assembled from concatenated literals,
   * or forwarded through a private logging helper. Explained on the page, because the
   * reader will not find the string at the `logger.*` call itself.
   */
  unreadable?: 'concatenated' | 'forwarded';
}

/** One console prefix and everything it can print. */
export interface CoreLogGroup {
  source: CoreLogSource;
  rows: CoreLogRow[];
}

const GENERATED =
  '<!-- Generated from the logger calls in src/core plus the notes in\n' +
  '     src/docs/content/core-logs.ts. Do not edit by hand: change the log line in the\n' +
  '     code or the note in core-logs.ts, then run `npm run docs:reference`. -->';

const LEVELS: Array<{
  level: LogEntry['level'];
  title: string;
  blurb: string;
}> = [
  {
    level: 'error',
    title: 'Error',
    blurb:
      'Something did not work. Each of these means a visitor saw the wrong thing, or ' +
      'a piece of data went missing. Every one carries what it means and what to do.',
  },
  {
    level: 'warn',
    title: 'Warn',
    blurb:
      'The SDK carried on, but something in the markup, the configuration, or the ' +
      'campaign data was not what it expected. Worth fixing even when the page looks ' +
      'right — several of these are how tracking goes quietly wrong.',
  },
  {
    level: 'info',
    title: 'Info',
    blurb:
      'Normal progress. Read these as the play-by-play of what the SDK decided: which ' +
      'country it detected, which currency it chose, what it loaded.',
  },
  {
    level: 'debug',
    title: 'Debug',
    blurb:
      'The detail behind the info lines. Expected in bulk, and only visible with debug ' +
      'mode on — a long list here is health, not trouble.',
  },
];

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/** `|` ends a table cell, so a message containing one has to be escaped. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

/** Short per-row marker; the sentence explaining it is printed once per section. */
const UNREADABLE_TAG: Record<NonNullable<CoreLogRow['unreadable']>, string> = {
  concatenated: 'message assembled in code',
  forwarded: 'wording lives at the caller',
};

/** The one-off explanation for a section that contains such rows. */
const UNREADABLE_NOTE: Record<NonNullable<CoreLogRow['unreadable']>, string> = {
  concatenated:
    'Rows marked *message assembled in code* are built from several string literals ' +
    'joined together, so searching the source for the whole sentence finds nothing — ' +
    'search for the first few words instead. The location given is where the message ' +
    'text begins, which is a line or two after the `logger.*` call itself.',
  forwarded:
    'Rows marked *wording lives at the caller* are passed to a private logging helper, ' +
    'so the `logger.*` call is elsewhere in the file. The location given is where the ' +
    'wording is, which is the line you want.',
};

function noted(row: CoreLogRow): string {
  const facts = [
    `\`${row.where}\``,
    row.hasContext ? 'extra context attached' : undefined,
    row.unreadable ? UNREADABLE_TAG[row.unreadable] : undefined,
  ].filter(Boolean);

  return blocks(
    `#### \`${row.message}\``,
    facts.join(' · '),
    `**Meaning:** ${row.meaning}`,
    `**Action:** ${row.action}`
  );
}

function table(rows: CoreLogRow[]): string {
  return [
    '| Message | Source | Extra context |',
    '|---|---|---|',
    ...rows.map(
      r =>
        `| \`${cell(r.message)}\` | \`${r.where}\` | ${r.hasContext ? 'yes' : '—'} |`
    ),
  ].join('\n');
}

function section(group: CoreLogGroup): string {
  const { source, rows } = group;
  const parts: Array<string | undefined> = [
    `## \`[${source.prefix}]\``,
    source.what,
    `Logged from \`${source.file}\`.${
      source.prefixNote ? ` ${source.prefixNote}` : ''
    }`,
  ];

  // Printed once here rather than on every row it applies to.
  for (const kind of ['concatenated', 'forwarded'] as const) {
    if (rows.some(r => r.unreadable === kind)) {
      parts.push(UNREADABLE_NOTE[kind]);
    }
  }

  for (const level of LEVELS) {
    const forLevel = rows.filter(r => r.level === level.level);
    if (forLevel.length === 0) continue;
    parts.push(`### ${level.title}`, level.blurb);
    if (level.level === 'error' || level.level === 'warn') {
      parts.push(...forLevel.map(noted));
    } else {
      parts.push(table(forLevel));
    }
  }

  return blocks(...parts);
}

/** The index: which prefix covers what, and how much each one can print. */
function index(groups: CoreLogGroup[]): string {
  const areas = [...new Set(groups.map(g => g.source.area))];

  return blocks(
    '## Which prefix is which',
    'Console lines are prefixed with the part of the SDK that produced them. Find the ' +
      'prefix from your console line here, then read that section below.',
    ...areas.map(area =>
      blocks(
        `### ${area}`,
        [
          '| Prefix | What it does | Error | Warn | Info | Debug |',
          '|---|---|---|---|---|---|',
          ...groups
            .filter(g => g.source.area === area)
            .map(g => {
              const n = (level: LogEntry['level']): string => {
                const count = g.rows.filter(r => r.level === level).length;
                return count === 0 ? '—' : String(count);
              };
              return `| \`[${g.source.prefix}]\` | ${cell(g.source.what)} | ${n('error')} | ${n('warn')} | ${n('info')} | ${n('debug')} |`;
            }),
        ].join('\n')
      )
    )
  );
}

/**
 * What a reader actually sees in production, which is not what they see locally.
 *
 * This is the first question anyone asks of a logs page — "why is my console empty?" —
 * and the answer differs by bundle. The facts are pinned by
 * `src/tests/docs/coreLogs.test.ts`, which fails if the build configuration or the
 * loader's entry point changes underneath this text.
 */
const PRODUCTION = blocks(
  '## What prints in production',
  'Which of these lines a live page prints depends on the bundle it loaded and on ' +
    'whether debug mode is on. The two bundles behave differently enough that "the ' +
    'console is empty" means different things.',
  '**The module bundle** — `dist/index.js` and the chunks beside it, which is what the ' +
    'loader fetches for every browser that supports modules, so it is what almost every ' +
    'visitor runs. Its `console` calls are all still in the shipped code. `error` always ' +
    'prints. `warn`, `info`, and `debug` print only with debug mode on, because `Logger` ' +
    'returns early otherwise.',
  '**The UMD bundle** — `dist/index.umd.js`, loaded only by a browser with no module ' +
    'support, or as the fallback when the module import fails. It is minified with ' +
    '`drop_console`, which removes **every** `console` call, `console.error` included. ' +
    'A page on this bundle prints nothing at any level, and debug mode cannot bring the ' +
    'lines back — they are not in the file to be re-enabled.',
  'Turn debug mode on with `?debug=true` or `?debugger=true` in the URL, or by setting ' +
    '`debug: true` (or `debugger: true`) on `window.nextConfig` before the loader runs. ' +
    '**They are not equivalent, and `?debug=true` is the weakest of them.** `Logger` reads ' +
    'only the URL and `window.nextConfig` (`core/logger.ts › isDebugModeEnabled`), and the level is raised ' +
    'to `DEBUG` only by `config.debug` (`sdk-initializer.ts › SDKInitializer.initializeDebugMode`):',
  [
    '| What you set | `error` / `warn` / `info` | `debug` lines | On-page overlay |',
    '|---|---|---|---|',
    '| `?debug=true` | yes | **no** — the level stays at `INFO` | no |',
    '| `window.nextConfig.debug = true` | yes | yes | **no** |',
    '| `<meta name="next-debug" content="true">` | `error` only — `Logger` reads neither meta tags nor the config store, so `warn` and `info` stay suppressed | **no** | no |',
    '| `?debugger=true` / `nextConfig.debugger = true` | yes | yes | yes |',
  ].join('\n'),
  'The meta-tag row is the one that wastes an afternoon: it is the documented way to turn ' +
    'debugging on, it does install `window.nextDebug`, and beyond errors it prints ' +
    'nothing. Use `?debugger=true` when you want both the lines and the overlay.',
  '> If a console is empty on a page that is clearly misbehaving, check which bundle ' +
    'loaded before concluding nothing failed. `window.__NEXT_SDK_VERSION__` is set by ' +
    'the loader either way; the UMD fallback announces itself with a ' +
    '`UMD fallback loaded` line from the loader itself, which is not routed through ' +
    '`Logger` and therefore survives.'
);

/**
 * The lines that never reach `Logger`, and therefore never reach a prefix section.
 *
 * Kept as its own section rather than filed under a prefix, because the thing a reader
 * needs to know about them is exactly that they are *not* prefixed and *not* gated the
 * way everything above is.
 */
function rawConsole(
  console_: CoreConsoleLog[],
  lineOf: (log: CoreConsoleLog) => string
): string | undefined {
  if (console_.length === 0) return undefined;

  const files = [...new Set(console_.map(c => c.file))];

  return blocks(
    '## Lines that bypass the logger',
    `${console_.length} messages in \`src/core\` are printed with a bare ` +
      '`console.error` or `console.warn` instead of through `Logger`. They behave ' +
      'differently from everything above, and the difference matters when you are ' +
      'reading a console:',
    '- **No `[Prefix]`**, unless the message writes one out by hand — which the ' +
      'attribution collector does and the event bus does not. An unprefixed error line ' +
      'from the SDK is one of these.\n' +
      '- **Not gated by debug mode or the log level.** On the module bundle they print ' +
      'for every visitor. On the UMD bundle they are stripped like everything else.\n' +
      '- **`Logger.setLogLevel()` cannot silence them.**',
    `They come from ${files.map(f => `\`${f}\``).join(', ')}. The debug tooling under ` +
      '`core/debug/` also writes to the console directly; that output is the tool ' +
      'talking to whoever opened it, so it is not listed here.',
    ...console_.map(c =>
      blocks(
        `### \`${c.message}\``,
        [
          `\`${lineOf(c)}\``,
          `\`console.${c.level}\``,
          c.hasContext ? 'extra context attached' : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
        `**Meaning:** ${c.meaning}`,
        `**Action:** ${c.action}`
      )
    )
  );
}

export function renderCoreLogs(
  groups: CoreLogGroup[],
  healthyBoot: string[],
  rawConsoleLogs: CoreConsoleLog[] = [],
  whereOf: (log: CoreConsoleLog) => string = c => c.file
): string {
  const total = groups.reduce((sum, g) => sum + g.rows.length, 0);

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'Logs')}# Logs\n\n${GENERATED}`,
    `Every message the SDK's own machinery can print — ${total + rawConsoleLogs.length} ` +
      `of them, across ${groups.length} console prefixes plus ${rawConsoleLogs.length} ` +
      'lines that bypass the logger entirely. Search a line from your console here to ' +
      'find what produced it, what it means, and what to do about it.',
    'Messages are listed at the wording the code uses. A `{name}` inside one is a value ' +
      'filled in at runtime, so search for the text on either side of it. **Extra ' +
      'context** means the call passes a second argument — an object or an error logged ' +
      'beside the message; expand that entry in the console, because the message alone ' +
      'will not tell you which element, package, or event was involved.',
    'This page covers `src/core`: boot, DOM scanning, the shared base class, location ' +
      'and currency, attribution, analytics, and the debug tools. Each feature ' +
      'documents its own messages in its own `guide/reference/logs.md`.',
    PRODUCTION,
    blocks(
      '## Healthy boot',
      'With debug mode on, a page that starts correctly prints this sequence. Lines ' +
        'between these are normal detail; what matters is that they arrive in this ' +
        'order and end with the completion line.',
      `\`\`\`\n${healthyBoot.join('\n')}\n\`\`\``,
      'A sequence that stops part-way tells you which step failed without reading any ' +
        'further: no `Campaign data loaded` means the campaign request is the problem, ' +
        'and no `Enhanced … elements successfully` means the markup was never scanned.'
    ),
    index(groups),
    ...groups.map(section),
    rawConsole(rawConsoleLogs, whereOf),
  ];

  return `${blocks(...parts)}\n`;
}

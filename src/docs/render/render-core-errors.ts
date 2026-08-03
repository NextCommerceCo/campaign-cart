/**
 * Renders `src/core/guide/reference/errors.md` from {@link CORE_ERRORS}.
 *
 * The message of every entry is checked against the `throw` sites in `src/core` by
 * `src/tests/docs/coreLogs.test.ts`, so this page cannot claim an error that does not
 * exist or miss one that does. Recoverable-or-fatal, the cause, the fix, and what
 * catches it are hand-written in `core-errors.ts`.
 *
 * Build-time only — see the note on `core-errors.ts`.
 */

import type { CoreErrorDoc } from '../content/core-errors';
import type { CoreLogSource } from '../content/core-logs';
import { coreNav } from '../content/nav';

const GENERATED =
  '<!-- Generated from src/docs/content/core-errors.ts, checked against the throw sites in\n' +
  '     src/core. Do not edit by hand: edit core-errors.ts, then run\n' +
  '     `npm run docs:reference`. -->';

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

function entry(error: CoreErrorDoc): string {
  return blocks(
    `## \`${error.message}\``,
    [
      '| | |',
      '|---|---|',
      `| Type | ${error.kind === 'fatal' ? 'Fatal' : 'Recoverable'} |`,
      `| Thrown by | \`${error.file}\` — logs under \`[${error.owner}]\` |`,
      `| Cause | ${error.cause} |`,
      error.caught
        ? `| Caught | ${error.caught} |`
        : '| Caught | Nothing in core catches it — it reaches your code. |',
    ].join('\n'),
    `**Fix:** ${error.fix}`
  );
}

/**
 * Every subsystem, and whether it can throw at all — including the ones that cannot.
 *
 * "Can this part fail?" is the question a reader brings to this page, and silence is not
 * an answer: a subsystem missing from the list below is indistinguishable from one
 * nobody documented. `test-mode.ts` throws and logs nothing, so it appears here without
 * a prefix section in `logs.md`; `AttributeScanner` is the reverse.
 */
function coverage(errors: CoreErrorDoc[], sources: CoreLogSource[]): string {
  const files = [
    ...new Set([...sources.map(s => s.file), ...errors.map(e => e.file)]),
  ].sort();

  const label = new Map(sources.map(s => [s.file, s.prefix] as const));

  return blocks(
    '## Which parts can throw',
    'Every part of `src/core`, and whether it raises anything of its own. "Nothing" is a ' +
      'real answer — it means a failure there shows up as a log line rather than as a ' +
      'thrown error, and [logs.md](./logs.md) is the page to read.',
    [
      '| Part | Console prefix | Throws |',
      '|---|---|---|',
      ...files.map(file => {
        const mine = errors.filter(e => e.file === file);
        const prefix = label.get(file);
        return `| \`${file}\` | ${prefix ? `\`[${prefix}]\`` : '— logs nothing'} | ${
          mine.length === 0
            ? 'nothing'
            : `${mine.length} — ${mine
                .map(e => `\`${e.message.replace(/\|/g, '\\|')}\``)
                .join(', ')}`
        } |`;
      }),
    ].join('\n')
  );
}

export function renderCoreErrors(
  errors: CoreErrorDoc[],
  sources: CoreLogSource[]
): string {
  const header = `${coreNav('Reference', 'Errors')}# Errors\n\n${GENERATED}`;

  if (errors.length === 0) {
    return `${blocks(
      header,
      '`src/core` throws no errors of its own.',
      'It can still log a problem and carry on rather than throwing — see ' +
        '[logs.md](./logs.md) for the messages it prints and what they mean.'
    )}\n`;
  }

  // Fatal first: those recur for every visitor until something changes, so they are
  // what to fix first.
  const ordered = [
    ...errors.filter(e => e.kind === 'fatal'),
    ...errors.filter(e => e.kind === 'recoverable'),
  ];

  const parts: Array<string | undefined> = [
    header,
    `Every error the SDK's own machinery can raise — ${errors.length} of them — at the ` +
      'exact message, so a console line can be matched to a cause. Each feature ' +
      'documents its own throws in its own `guide/reference/errors.md`.',
    '**Recoverable** means a retry or a corrected input gets past it with no code ' +
      'change. **Fatal** means it happens every time until the markup, code, or ' +
      'configuration changes.',
    'The **Caught** row is the one to read first. Most of these are caught inside the ' +
      'SDK, which decides what a visitor is left with: an element that stays plain ' +
      'markup, a fallback country, a lost analytics event. Where it says nothing catches ' +
      'it, the error reaches your own `await` or `.catch()`.',
    blocks(
      '## At a glance',
      'Fatal first, since those recur for every visitor until something changes.',
      [
        '| Error | Type | Thrown by |',
        '|---|---|---|',
        ...ordered.map(
          e =>
            `| \`${e.message.replace(/\|/g, '\\|')}\` | ${
              e.kind === 'fatal' ? 'Fatal' : 'Recoverable'
            } | \`${e.file}\` |`
        ),
      ].join('\n')
    ),
    coverage(errors, sources),
  ];

  ordered.forEach((error, i) => {
    parts.push(entry(error));
    if (i < ordered.length - 1) parts.push('---');
  });

  return `${blocks(...parts)}\n`;
}

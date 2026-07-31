/**
 * Renders the extracted boot sequence into `core/guide/reference/boot-sequence.md`.
 *
 * The **structure** — which steps run, in what order, which are awaited, which are
 * conditional, and which can abort the boot — comes from the source through
 * `extract-boot-sequence.ts`. The **prose** lives here in {@link STEP_NOTES}, because
 * "what does this step mean for my page" is judgement no scanner produces. The drift
 * test pairs the two: a step with no note fails, and a note for a step that no longer
 * exists fails too.
 *
 * Build-time only — nothing under `src/` outside `src/docs/` may import this.
 */

import { coreNav } from '../content/nav';
import type {
  BootEvent,
  BootSequence,
  BootSignal,
  BootStep,
} from '../extract/extract-boot-sequence';

const GENERATED =
  '<!-- Generated from src/core/sdk-initializer.ts. Do not edit by hand:\n' +
  '     edit the source or STEP_NOTES in src/docs/render/render-boot-sequence.ts,\n' +
  '     then run `npm run docs:reference`. -->';

/**
 * What each boot step does, in terms of what the page gets out of it.
 *
 * Keyed by the step name as it appears at the call site in `initialize()`, so renaming
 * a method fails the drift test rather than silently dropping its description.
 */
export const STEP_NOTES: Record<string, string> = {
  waitForDOM:
    'Waits for `DOMContentLoaded` when the document is still parsing. Nothing below ' +
    'runs until `<body>` exists.',
  loadConfiguration:
    'Reads settings from `window.nextConfig`, then from the `<meta name="next-*">` ' +
    'tags, which win on conflict. Also stores every URL parameter for the rest of the ' +
    'session and honours `?reset=true` by clearing SDK storage.',
  initializeLocationAndCurrency:
    "Detects the visitor's country and picks the display currency, before campaign " +
    'prices are fetched so they arrive in the right currency. Skipped when ' +
    "`window.nextConfig.currencyBehavior` is `'manual'`; `?country=` and `?currency=` " +
    'override detection, and detection gives up after 3 seconds and falls back to ' +
    'US / USD.',
  initializeAttribution:
    'Captures where the visitor came from — UTM tags, click ids, referrer, landing ' +
    'page — so the values are attached to the order later. Adds the SDK version and ' +
    'the detected IP to the attribution metadata.',
  loadCampaignData:
    'Fetches the campaign with your API key: packages, prices, shipping methods, and ' +
    'the countries it ships to. **This is the step that needs `next-api-key`** — until ' +
    'it finishes, no price on the page has a real value.',
  initializeAnalytics:
    'Starts the analytics pipeline after campaign data exists, so product-level ' +
    'events have prices to report. It stays dormant unless a provider is configured.',
  waitForStoreRehydration:
    'Restores a cart saved earlier in the session from sessionStorage and recalculates ' +
    'its totals. This is why cart-reading code has to wait for boot: before this step ' +
    'the cart looks empty even when the visitor has items.',
  'cartOperations.clear':
    'Empties the restored cart when the page asks for a clean start with ' +
    '`<meta name="next-clear-cart" content="true">`. Used on landing pages that must ' +
    'not inherit a cart from an earlier visit.',
  initializeErrorHandler:
    'Installs the global handler that captures uncaught errors from SDK code. It loads ' +
    'in the background rather than being waited for, so treat it as available shortly ' +
    'after boot rather than exactly at boot.',
  checkAndLoadOrder:
    'Loads an existing order when the URL carries `?ref_id=` or `?order_ref_id=`, ' +
    'which is what makes receipt and post-purchase upsell pages work on a plain link.',
  scanAndEnhanceDOM:
    'Scans `<body>` for `data-next-*` attributes and turns each match into a live ' +
    'feature. This is the step that fills in prices, totals, and selectors — before ' +
    'it, the markup is whatever you wrote by hand.',
  setupReadyCallbacks:
    'Publishes `window.next` and runs every callback queued on `window.nextReady`, ' +
    'then replaces the queue with an object whose `push` runs callbacks immediately. ' +
    'Nothing you call on `window.next` can work before this step.',
  initializeDebugMode:
    'Loads the debug overlay and `window.nextDebug` when debug mode is on — ' +
    '`?debugger=true`, `<meta name="next-debug" content="true">`, or ' +
    '`window.nextConfig.debug` — and turns logging up to `DEBUG`. Does nothing on a ' +
    'normal page load.',
  emitInitializedEvent:
    'Dispatches `next:initialized` on `window`. Boot is over: everything above has ' +
    'finished, so this is the signal to build page logic on.',
};

/**
 * Overrides for the **If it fails** column, where the shape of the code and the real
 * behaviour disagree.
 *
 * The column is derived from whether an error inside a step can reach `initialize()`'s
 * `catch`. That is right for most steps and misleading for a few: the DOM scan is
 * awaited without a guard, yet the scanner swallows everything and never rejects. A
 * reader comparing that row against the cautions would conclude one of them is wrong,
 * so the judgement is written down instead of derived.
 */
export const STEP_FAILURE_NOTES: Record<string, string> = {
  waitForStoreRehydration:
    '**aborts the boot** if recalculating totals throws — the 50 ms wait itself ' +
    'cannot fail',
  scanAndEnhanceDOM:
    'boot continues — the awaited call is unguarded, but the scanner catches every ' +
    'error inside itself and never rejects',
  'cartOperations.clear':
    'not analysed here — the call leaves `SDKInitializer`',
};

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/** `useConfigStore.getState().clearCartOnInit` → a table cell that survives markdown. */
function code(text: string): string {
  return `\`${text.replace(/\|/g, '\\|')}\``;
}

function failureCell(step: BootStep): string {
  const override = STEP_FAILURE_NOTES[step.name];
  if (override) return override;
  if (step.errorsEscape === undefined) {
    return 'not analysed here — the call leaves `SDKInitializer`';
  }
  if (!step.errorsEscape) {
    return step.catchesOwnErrors
      ? 'logged, boot continues'
      : 'nothing in it can throw or reject';
  }
  return step.throws.length
    ? `**aborts the boot** — ${code(step.throws[0]?.message ?? '')}`
    : '**aborts the boot**';
}

function stepTable(steps: BootStep[]): string {
  return [
    '| # | Step | Boot waits? | Runs | If it fails | Source |',
    '|---|---|---|---|---|---|',
    ...steps.map(step =>
      [
        step.index,
        `**${code(step.name)}**<br>${STEP_NOTES[step.name] ?? ''}`,
        step.awaited ? 'yes' : 'no',
        step.guardedBy ? `only when ${code(step.guardedBy)}` : 'always',
        failureCell(step),
        code(step.where),
      ].join(' | ')
    ),
  ]
    .map(row => (row.startsWith('|') ? row : `| ${row} |`))
    .join('\n');
}

const PHASE_MEANING: Record<BootSignal['phase'], string> = {
  'boot-start': 'boot has started — nothing on the page has real values yet',
  'display-ready':
    'the DOM scan finished and display bindings have their first values',
  'boot-complete': 'boot finished — every step in the table above ran',
  'boot-failed': 'a step threw — see [When a step fails](#when-a-step-fails)',
};

function signalTable(signals: BootSignal[]): string {
  return [
    '| Written | Where | Means | Source |',
    '|---|---|---|---|',
    ...signals.map(signal => {
      const written =
        signal.kind === 'attribute'
          ? code(`${signal.name}="${signal.value ?? ''}"`)
          : `class ${code(signal.name)}`;
      const target = signal.target === 'html' ? '`<html>`' : '`<body>`';
      return `| ${written} | ${target} | ${PHASE_MEANING[signal.phase]} | ${code(signal.where)} |`;
    }),
  ].join('\n');
}

/** Reader order, not source order: the loader's event comes first because it fires first. */
const EVENT_ORDER = ['next:ready', 'next:display-ready', 'next:initialized'];

/** Exported so the drift test fails on an event the page would render without prose. */
export const EVENT_MEANING: Record<string, string> = {
  'next:ready':
    'The SDK **file** finished downloading. Boot has not started. Not a readiness signal.',
  'next:display-ready':
    'The DOM scan finished and display bindings resolved their first values. Fires ' +
    'inside the DOM-scan step, so `window.next` does not exist yet.',
  'next:initialized':
    'Boot finished. `window.next` exists, the cart is restored, and campaign data is ' +
    'loaded. **This is the one to listen for.**',
  'sdk:url-parameters-processed':
    'Internal, on the SDK event bus rather than on `window`: URL overrides such as ' +
    '`?forcePackageId=` have been applied to the cart, so features can re-evaluate.',
};

function eventTable(events: BootEvent[]): string {
  const ordered = [
    ...EVENT_ORDER.map(name => events.find(e => e.name === name)).filter(
      (e): e is BootEvent => e !== undefined
    ),
    ...events.filter(e => !EVENT_ORDER.includes(e.name)),
  ];

  return [
    '| Event | Listen on | Meaning | `detail` | Source |',
    '|---|---|---|---|---|',
    ...ordered.map(event => {
      const listen =
        event.target === 'event-bus'
          ? '`next.on()`'
          : `\`${event.target}.addEventListener\``;
      const detail = event.detail.length
        ? event.detail.map(key => code(key)).join(', ')
        : '—';
      const sites = event.sites > 1 ? ` (${event.sites} dispatch sites)` : '';
      return `| ${code(event.name)} | ${listen} | ${EVENT_MEANING[event.name] ?? ''} | ${detail} | ${code(event.where)}${sites} |`;
    }),
  ].join('\n');
}

function failureSection(sequence: BootSequence): string {
  const { retry } = sequence;
  const ladder = retry.delays.length
    ? retry.delays.map(ms => `${ms / 1000}s`).join(', then ')
    : code(retry.delayExpression);

  const aborting = sequence.steps.filter(step => step.errorsEscape);
  const withMessage = aborting.filter(step => step.throws.length);
  // Steps that abort with nothing to search the console for — and no hand-written
  // qualification saying they cannot really fail.
  const silent = aborting.filter(
    step => !step.throws.length && !STEP_FAILURE_NOTES[step.name]
  );

  return blocks(
    '## When a step fails',
    `An error in any step marked **aborts the boot** above stops the sequence there, ` +
      `so no later step runs. ${retry.maxRetries === 0 ? '' : `The whole sequence is then retried up to **${retry.maxRetries} times**, waiting ${ladder} before each attempt (${code(retry.where)}).`}`,
    'What the visitor sees in the meantime is the part worth planning for:',
    [
      `- \`data-next-sdk-loading\` is set back to \`"false"\` on the failure path, the same value it gets on success. CSS that reveals the page on \`"false"\` reveals it with nothing filled in — raw \`{price}\` placeholders and an empty cart.`,
      `- The \`next-display-ready\` class is **not** added, because the DOM scan never ran. That is the signal that separates a finished boot from an abandoned one.`,
      `- \`window.next\` is never published and callbacks queued on \`window.nextReady\` never run, so page code waiting on either stays silent rather than erroring.`,
      retry.recursive
        ? '- Each retry re-runs every step from the top, so the console shows the whole boot log again. Duplicate boot logs mean the first attempt failed — look for the earlier `SDK initialization failed:` line rather than treating the repetition as a page bug.'
        : undefined,
      retry.rethrows
        ? '- After the last retry the error is re-thrown. Nothing catches it (`src/index.ts:89` and `:93` call `initialize()` without a handler), so it surfaces as an unhandled promise rejection.'
        : undefined,
    ]
      .filter(Boolean)
      .join('\n'),
    withMessage.length
      ? blocks(
          '### Errors that stop the boot',
          [
            '| Message | Step | Source |',
            '|---|---|---|',
            ...withMessage.flatMap(step =>
              step.throws.map(
                thrown =>
                  `| ${code(thrown.message)} | ${step.index}. ${code(step.name)} | ${code(thrown.where)} |`
              )
            ),
          ].join('\n')
        )
      : undefined,
    silent.length
      ? `${silent.length === 1 ? 'Step' : 'Steps'} ${silent
          .map(step => `${step.index} (${code(step.name)})`)
          .join(
            ' and '
          )} carry no error message of their own, and no \`catch\` ` +
          'either — a rejected request or a failed dynamic import inside them lands on ' +
          'the same retry path.'
      : undefined
  );
}

export function renderBootSequence(sequence: BootSequence): string {
  const total = sequence.steps.length;
  const readyStep = sequence.steps.find(
    step => step.name === 'setupReadyCallbacks'
  );

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'Boot Sequence')}# Boot sequence\n\n${GENERATED}`,

    `The SDK boots once per page load, in ${total} steps, and only the last of them ` +
      'makes `window.next` usable. This page is the order those steps run in, what ' +
      'each one gives the page, and which signal to wait for before your own code ' +
      'touches the cart.',

    // The answer first: everything else on the page is detail behind this.
    '## Wait for `next:initialized`, not `next:ready`',

    'There are two events with similar names and a long gap between them. ' +
      '`next:ready` means the SDK **file** arrived. `next:initialized` means the SDK ' +
      '**ran**. Only the second one tells you the cart is restored, campaign prices ' +
      'are loaded, and `window.next` exists.',

    '```html\n' +
      '<script>\n' +
      '  // Runs after boot, whether the SDK has already finished or not.\n' +
      '  window.nextReady = window.nextReady || [];\n' +
      '  window.nextReady.push(function (next) {\n' +
      "    console.log('cart total', next.getCartData().totals.total.value);\n" +
      '  });\n' +
      '\n' +
      '  // The event form, for code that is not holding a reference to the queue.\n' +
      "  window.addEventListener('next:initialized', function () {\n" +
      "    document.body.classList.add('my-page-is-live');\n" +
      '  });\n' +
      '</script>\n' +
      '```',

    `\`window.nextReady\` works before boot and after it: the loader creates it as an ` +
      `array that collects callbacks, and step ${readyStep?.index ?? ''} drains that ` +
      'array and replaces it with an object whose `push` runs callbacks immediately. ' +
      'Pushing is therefore safe at any point in the page.',

    '## The order',

    'Read the **Boot waits?** column as "does the next step wait for this one to ' +
      'finish". Read **If it fails** as what happens to the rest of the page when ' +
      'this step throws.',

    stepTable(sequence.steps),

    sequence.reentryGuarded
      ? 'Calling `initialize()` a second time logs `SDK already initialized` and ' +
        'returns without repeating any of this. Re-running the sequence on purpose ' +
        'goes through `SDKInitializer.reinitialize()`, which tears the DOM scanner ' +
        'down first.'
      : undefined,

    '## What the page can watch',

    'Two markers land on the document, and they answer different questions. The ' +
      'attribute says the SDK is running; the class says the page is safe to show.',

    signalTable(sequence.signals),

    'A reveal rule wants both — the attribute alone flips to `"false"` on the failure ' +
      'path too:',

    '```css\n' +
      '/* Hide un-enhanced prices while the SDK works. */\n' +
      'body[data-next-sdk-loading="true"] .price { visibility: hidden; }\n' +
      '\n' +
      '/* Reveal only once the DOM scan actually resolved values. */\n' +
      'html.next-display-ready .price { visibility: visible; }\n' +
      '```',

    '### Events',

    eventTable(sequence.events),

    failureSection(sequence),

    '## Cautions',

    [
      '- **`next:ready` is not a readiness signal.** It fires as soon as the SDK ' +
        'module finishes downloading, before step 1 has run. A listener that ' +
        'calls `next.getCartData()` there reads `undefined` — `window.next` does not ' +
        'exist yet — or, on a slow campaign request, an empty cart. Listen for ' +
        '`next:initialized` or push onto `window.nextReady` instead.',
      '- **A missing API key aborts the boot instead of degrading it.** Without ' +
        '`<meta name="next-api-key" content="…">` (or `window.nextConfig.apiKey`), ' +
        'the campaign step throws, so there is no DOM scan, no `window.next`, and no ' +
        '`next-display-ready` class — yet `data-next-sdk-loading` still ends up ' +
        '`"false"`. A page that reveals itself on that attribute alone shows raw ' +
        '`{price}` placeholders. Add the meta tag, and gate the reveal on the ' +
        '`next-display-ready` class as well.',
      '- **The cart looks empty until the rehydration step finishes.** Code that ' +
        'reads cart contents from a `DOMContentLoaded` handler or an inline script ' +
        'sees zero items even when the visitor has a full cart, because the saved ' +
        'cart is restored partway through boot. Move that code into a ' +
        '`window.nextReady` callback.',
      '- **A failed DOM scan does not fail the boot.** The scanner catches its own ' +
        'errors, so `next:initialized` can fire while `next-display-ready` and ' +
        '`next:display-ready` never arrive and parts of the page stay un-enhanced. ' +
        'When enhanced elements are missing but boot reported success, search the ' +
        'console for `Error during scan and enhance` rather than re-checking your ' +
        'attributes.',
      '- **Debug mode participates in the boot.** With debug on, the overlay is ' +
        'imported inside the sequence, so a failure fetching that chunk aborts a boot ' +
        'that would have succeeded in production. Reproduce boot failures with debug ' +
        'off before concluding the page is broken.',
    ].join('\n'),
  ];

  return `${blocks(...parts)}\n`;
}

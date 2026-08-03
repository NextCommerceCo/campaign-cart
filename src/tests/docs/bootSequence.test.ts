import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
  renderBootSequence,
  STEP_NOTES,
  STEP_FAILURE_NOTES,
  EVENT_MEANING,
} from '@/docs/render/render-boot-sequence';
import { extractBootSequence } from '@/docs/extract/extract-boot-sequence';
import { fileOf } from '@/docs/extract/source-anchor';

/**
 * Generates `src/core/guide/reference/boot-sequence.md` from `core/sdk-initializer.ts`,
 * and fails when the committed markdown drifts.
 *
 * Regenerate:
 *   UPDATE_DOCS=1 npm run docs:reference
 *
 * Same shape as `featureReference.test.ts` and `stateReference.test.ts`: the page is a
 * render of extracted facts plus prose that has to cover them, and the assertions
 * below are the ones a reader would be hurt by if they stopped holding. Boot order is
 * the sharpest case — a page that documents the wrong order tells an author it is safe
 * to read the cart before it has been restored.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT = join(SRC, '..');

const sequence = extractBootSequence(
  {
    path: join(SRC, 'core/sdk-initializer.ts'),
    name: 'core/sdk-initializer.ts',
  },
  [
    {
      path: join(SRC, 'core/attribute-scanner.ts'),
      name: 'core/attribute-scanner.ts',
    },
    { path: join(ROOT, 'public/loader.js'), name: 'public/loader.js' },
  ]
);

const stepNames = sequence.steps.map(step => step.name);

describe('boot sequence docs', () => {
  it('reads the sequence out of initialize()', () => {
    expect(
      sequence.steps.length,
      'found no steps in SDKInitializer.initialize() — the extractor no longer ' +
        'recognises its shape, so the page would publish an empty order'
    ).toBeGreaterThan(5);
  });

  /**
   * The forward direction: a step added to the boot must be described. An undescribed
   * row is worse than a missing one — the reader sees the name and assumes the blank
   * cell means "nothing to know".
   */
  it('describes every step it lists', () => {
    const undescribed = stepNames.filter(name => !STEP_NOTES[name]?.trim());
    expect(
      undescribed,
      'in initialize() but not in STEP_NOTES (src/docs/render/render-boot-sequence.ts)'
    ).toEqual([]);
  });

  /** The reverse: a step removed from the boot must leave the page. */
  it('describes no step that has been removed', () => {
    const phantom = Object.keys(STEP_NOTES).filter(
      name => !stepNames.includes(name)
    );
    expect(
      phantom,
      'described in STEP_NOTES but no longer called by initialize()'
    ).toEqual([]);
  });

  /**
   * Every step the page names as one of `SDKInitializer`'s own must still be a method
   * on it. Without this, a rename leaves the page citing a method a reader cannot find
   * when they go looking for what the step actually does.
   */
  it('names only methods that exist on SDKInitializer', () => {
    const missing = sequence.steps
      .filter(step => step.receiver === 'this')
      .map(step => step.name)
      .filter(name => !sequence.methods.includes(name));
    expect(
      missing,
      'listed as a boot step but not declared on SDKInitializer'
    ).toEqual([]);
  });

  /**
   * The hand-written **If it fails** overrides say the code's shape is misleading for
   * that step. If the step is gone, so is the reason for the override — and a stale one
   * would quietly replace an accurate derived answer for whatever gets renamed into it.
   */
  it('overrides the failure column only for steps that exist', () => {
    const phantom = Object.keys(STEP_FAILURE_NOTES).filter(
      name => !stepNames.includes(name)
    );
    expect(
      phantom,
      'has a STEP_FAILURE_NOTES override but is no longer a boot step'
    ).toEqual([]);
  });

  it('explains every event it lists', () => {
    const unexplained = sequence.events
      .map(event => event.name)
      .filter(name => !EVENT_MEANING[name]?.trim());
    expect(
      unexplained,
      'dispatched on the boot path but not in EVENT_MEANING — the table would ' +
        'render the name with an empty meaning'
    ).toEqual([]);
  });

  /**
   * The page's headline: `next:ready` comes from the loader before the SDK runs, and
   * `next:initialized` comes from the end of boot. If either moves, the caution that
   * tells authors which one to listen for is no longer true.
   */
  it('still has two differently-timed readiness events', () => {
    const ready = sequence.events.find(event => event.name === 'next:ready');
    const initialized = sequence.events.find(
      event => event.name === 'next:initialized'
    );

    // Compared through `fileOf` rather than a regex on the anchor: what this test
    // means is "which file dispatches it", and that stays true however the anchor's
    // symbol part is formatted.
    expect(
      ready && fileOf(ready.where),
      'next:ready is no longer dispatched from the loader — check whether it now ' +
        'means what the page says it means'
    ).toBe('public/loader.js');
    expect(
      initialized && fileOf(initialized.where),
      'next:initialized is no longer dispatched from the initializer'
    ).toBe('core/sdk-initializer.ts');
    expect(
      stepNames.at(-1),
      'boot no longer ends by emitting next:initialized'
    ).toBe('emitInitializedEvent');
  });

  /**
   * The order the cautions are built on: campaign data before the DOM scan, DOM scan
   * before `window.next` is published, and the cart restored before either.
   */
  it('keeps the order the page tells authors to rely on', () => {
    const position = (name: string): number => stepNames.indexOf(name);

    expect(position('waitForStoreRehydration')).toBeGreaterThan(
      position('loadCampaignData')
    );
    expect(position('scanAndEnhanceDOM')).toBeGreaterThan(
      position('waitForStoreRehydration')
    );
    expect(position('setupReadyCallbacks')).toBeGreaterThan(
      position('scanAndEnhanceDOM')
    );
    expect(position('emitInitializedEvent')).toBeGreaterThan(
      position('setupReadyCallbacks')
    );
  });

  /**
   * The missing-API-key caution rests on three facts: the throw exists, it is in a step
   * whose errors escape, and that step runs before the DOM scan.
   */
  it('still aborts the boot when the API key is missing', () => {
    const campaign = sequence.steps.find(
      step => step.name === 'loadCampaignData'
    );
    expect(
      campaign?.errorsEscape,
      'loadCampaignData now handles its own errors'
    ).toBe(true);
    expect(campaign?.throws.map(thrown => thrown.message).join('\n')).toContain(
      'API key not found'
    );
    expect(
      stepNames.indexOf('loadCampaignData'),
      'the campaign step no longer runs before the DOM scan'
    ).toBeLessThan(stepNames.indexOf('scanAndEnhanceDOM'));
  });

  /**
   * `data-next-sdk-loading` is cleared on success and **left set** on failure — that
   * asymmetry is the point, and it is what finding 26 fixed. Clearing it on the failure
   * path revealed the un-enhanced page, `{price}` placeholders and all, because the same
   * attribute is the documented hook for revealing markup.
   *
   * A failure is therefore not detectable from the attribute alone: it stays `"true"`,
   * indistinguishable from a boot still in progress. The signal for "gave up" is the
   * `error:occurred` event with `code: 'SDK_INIT_FAILED'`.
   */
  it('clears data-next-sdk-loading on success and leaves it set on failure', () => {
    const loading = sequence.signals.filter(
      signal => signal.name === 'data-next-sdk-loading'
    );
    const done = loading.find(signal => signal.phase === 'boot-complete');
    const failed = loading.find(signal => signal.phase === 'boot-failed');

    expect(
      done?.value,
      'boot no longer clears the loading attribute on success'
    ).toBe('false');
    expect(
      failed,
      'the failure path clears the loading attribute again — that un-hides the ' +
        'un-enhanced page, which is finding 26 regressing'
    ).toBeUndefined();
    expect(
      sequence.signals.some(signal => signal.name === 'next-display-ready'),
      'the next-display-ready class is gone, so the page recommends a signal that ' +
        'no longer exists'
    ).toBe(true);
  });

  /** The retry ladder the failure section publishes. */
  it('retries the whole sequence before giving up', () => {
    expect(sequence.retry.maxRetries).toBeGreaterThan(0);
    expect(
      sequence.retry.delays.length,
      `the retry delay is now ${sequence.retry.delayExpression}, which the page ` +
        'cannot express as a ladder of waits'
    ).toBe(sequence.retry.maxRetries);
    expect(sequence.retry.recursive).toBe(true);
    expect(sequence.retry.rethrows).toBe(true);
  });

  /**
   * The page says the final failure surfaces as an unhandled rejection. That is only
   * true while the caller leaves it unhandled.
   */
  it('still has an unhandled boot rejection at the entry point', () => {
    const entry = readFileSync(join(SRC, 'index.ts'), 'utf8');
    const calls = entry.match(/SDKInitializer\.initialize\(\)[^\n]*/g) ?? [];
    expect(
      calls.length,
      'src/index.ts no longer starts the boot'
    ).toBeGreaterThan(0);
    expect(
      calls.every(call => !call.includes('.catch')),
      'boot failures are now handled at src/index.ts — drop that line from the ' +
        'failure section'
    ).toBe(true);
  });

  it('boot-sequence.md matches the source', () => {
    const expected = renderBootSequence(sequence);
    const refDir = join(SRC, 'core/guide/reference');
    const out = join(refDir, 'boot-sequence.md');
    if (UPDATE) {
      mkdirSync(refDir, { recursive: true });
      writeFileSync(out, expected);
    }
    expect(existsSync(out), `${relative(SRC, out)} is missing`).toBe(true);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });
});

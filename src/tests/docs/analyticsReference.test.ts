import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
  ANALYTICS_BLOCKED_EVENTS_NOTE,
  ANALYTICS_DEBUG_NOTES,
  ANALYTICS_ENABLE_NOTE,
  ANALYTICS_EVENT_DOCS,
  ANALYTICS_EVENTS_INTRO,
  ANALYTICS_FAILURE_STEPS,
  ANALYTICS_FIELD_DOCS,
  ANALYTICS_PROVIDER_DOCS,
  ANALYTICS_PROVIDERS_INTRO,
  ANALYTICS_SHARED_SHAPES,
  DL_PREFIX_NOTES,
  type SharedShapeName,
} from '@/core/docs/analytics-events';
import {
  renderAnalyticsEvents,
  renderAnalyticsProviders,
} from '@/core/docs/render-analytics-reference';
import { extractAnalytics } from './extract-analytics-events';

/**
 * Generates `src/core/guide/reference/analytics-events.md` and
 * `analytics-providers.md`, and fails when the committed markdown drifts or when
 * the hand-written prose no longer matches the code.
 *
 * Regenerate:
 *   UPDATE_DOCS=1 npm run docs:reference
 *
 * The analytics equivalent of `featureReference.test.ts` / `stateReference.test.ts`,
 * and the same reason it is a test rather than a script: the docs modules load
 * through Vite, so TypeScript and `@/` resolve with no extra build step.
 *
 * The drift checks run in **both** directions on purpose. Forward: a new event,
 * field, or provider must be documented before it can ship. Reverse: a removed
 * one must lose its row, because a reader trusts a stale table more than a
 * missing one.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REF_DIR = join(SRC, 'core/guide/reference');

const facts = extractAnalytics(SRC);

/** Words that promise the reader something a doc cannot deliver. */
const FORBIDDEN = /\b(simple|simply|easy|easily|just|straightforward)\b/i;

describe('analytics reference docs', () => {
  it('reads the vocabulary, its schemas and its provider registry', () => {
    expect(facts.events.length).toBeGreaterThan(0);
    expect(Object.keys(facts.schemas).length).toBeGreaterThan(0);
    expect(facts.providers.length).toBeGreaterThan(0);
    // The two shared field tables the per-event schemas reference by name. If a
    // rename broke the lookup, every event's `user_properties` would silently
    // expand into 15 undocumented rows instead.
    expect(facts.shared.UserProperties?.length).toBeGreaterThan(0);
    expect(facts.shared.Product?.length).toBeGreaterThan(0);
  });

  // ── events ───────────────────────────────────────────────────────────────

  it('documents every event in the vocabulary', () => {
    const documented = new Set(ANALYTICS_EVENT_DOCS.map(d => d.name));
    const missing = facts.events
      .map(e => e.name)
      .filter(name => !documented.has(name));
    expect(
      missing,
      'in DL_EVENTS but not in src/core/docs/analytics-events.ts — add a row'
    ).toEqual([]);
  });

  it('documents no event that has been removed', () => {
    const real = new Set(facts.events.map(e => e.name));
    const phantom = ANALYTICS_EVENT_DOCS.map(d => d.name).filter(
      name => !real.has(name)
    );
    expect(
      phantom,
      'documented but no longer in DL_EVENTS — delete the row'
    ).toEqual([]);
  });

  it('says when every event fires, in prose a reader can act on', () => {
    const empty = ANALYTICS_EVENT_DOCS.filter(d => !d.firesWhen?.trim()).map(
      d => d.name
    );
    expect(empty, 'every event needs a "fires when" in product terms').toEqual(
      []
    );
  });

  /**
   * The check that stops the catalogue lying by omission: seven events are in the
   * vocabulary that nothing builds. Marking them is not optional, and a name that
   * starts firing must lose its marker.
   */
  it('marks exactly the events that nothing in the SDK builds', () => {
    const neverBuilt = facts.events
      .map(e => e.name)
      .filter(name => (facts.emitSites[name] ?? []).length === 0)
      .sort();
    const marked = ANALYTICS_EVENT_DOCS.filter(d => d.neverFired)
      .map(d => d.name)
      .sort();
    expect(
      marked,
      'events with no construction site must carry `neverFired`, and only those'
    ).toEqual(neverBuilt);
  });

  // ── fields ───────────────────────────────────────────────────────────────

  it('describes every field of every event payload', () => {
    const undescribed: string[] = [];
    for (const doc of ANALYTICS_EVENT_DOCS) {
      for (const field of facts.schemas[doc.name] ?? []) {
        // Same lookup order the renderer uses — a per-event entry wins even if
        // it is blank, so a blank one has to fail here rather than silently
        // fall back to the shared description and render an empty cell.
        const described =
          doc.fields?.[field.path] ?? ANALYTICS_FIELD_DOCS[field.path];
        if (!described?.trim()) undescribed.push(`${doc.name}.${field.path}`);
      }
    }
    expect(
      undescribed,
      "add each to the event's own `fields` or to ANALYTICS_FIELD_DOCS"
    ).toEqual([]);
  });

  it('describes no field that no event carries', () => {
    const real = new Set<string>();
    for (const fields of Object.values(facts.schemas)) {
      for (const field of fields) real.add(field.path);
    }

    const phantomShared = Object.keys(ANALYTICS_FIELD_DOCS).filter(
      path => !real.has(path)
    );
    expect(
      phantomShared,
      'described in ANALYTICS_FIELD_DOCS but on no event schema'
    ).toEqual([]);

    const phantomPerEvent: string[] = [];
    for (const doc of ANALYTICS_EVENT_DOCS) {
      const paths = new Set((facts.schemas[doc.name] ?? []).map(f => f.path));
      for (const path of Object.keys(doc.fields ?? {})) {
        if (!paths.has(path)) phantomPerEvent.push(`${doc.name}.${path}`);
      }
    }
    expect(
      phantomPerEvent,
      'described on an event that does not carry the field'
    ).toEqual([]);
  });

  it('describes both shared field tables in full, and nothing extra', () => {
    for (const shape of ['UserProperties', 'Product'] as SharedShapeName[]) {
      const real = (facts.shared[shape] ?? []).map(f => f.path);
      const documented = Object.keys(ANALYTICS_SHARED_SHAPES[shape].fields);
      expect(
        real.filter(path => !documented.includes(path)),
        `on ${shape} but undocumented`
      ).toEqual([]);
      expect(
        documented.filter(path => !real.includes(path)),
        `documented on ${shape} but no longer a field`
      ).toEqual([]);
    }
  });

  // ── providers ────────────────────────────────────────────────────────────

  it('documents every provider in the registry, and only those', () => {
    const registry = facts.providers.map(p => p.key).sort();
    const documented = ANALYTICS_PROVIDER_DOCS.map(d => d.key).sort();
    expect(
      documented,
      'PROVIDER_FACTORIES and ANALYTICS_PROVIDER_DOCS must list the same providers'
    ).toEqual(registry);
  });

  it('says what every provider reshapes and what it drops', () => {
    const incomplete = ANALYTICS_PROVIDER_DOCS.filter(
      d => !d.summary?.trim() || !d.reshaping?.trim() || !d.drops?.trim()
    ).map(d => d.key);
    expect(
      incomplete,
      'each provider needs summary, reshaping and drops'
    ).toEqual([]);
  });

  /**
   * The provider mapping tables are rendered from the adapters, so an empty one
   * means the extractor stopped finding a literal it used to find — the tables
   * would render blank and read as "this provider maps nothing".
   */
  it("still finds each adapter's event mapping", () => {
    const maps = facts.providerEventMaps;
    expect(Object.keys(maps.facebook).length).toBeGreaterThan(0);
    expect(Object.keys(maps.rudderstack).length).toBeGreaterThan(0);
    expect(maps.nextCampaign.length).toBeGreaterThan(0);
    expect(maps.gtmEcommerce.length).toBeGreaterThan(0);
    expect(maps.facebookCustomEvents.length).toBeGreaterThan(0);

    // Every mapped name must be a name the vocabulary knows, or the docs would
    // advertise a destination for an event that cannot exist.
    const known = new Set(facts.events.map(e => e.name));
    const unknown = [
      ...Object.keys(maps.facebook),
      ...Object.keys(maps.rudderstack),
      ...maps.nextCampaign,
      ...maps.gtmEcommerce,
    ].filter(name => !known.has(name));
    expect(unknown, 'mapped by an adapter but not in DL_EVENTS').toEqual([]);
  });

  // ── readability ──────────────────────────────────────────────────────────

  it('keeps the forbidden words out of the prose', () => {
    const offenders: string[] = [];
    const check = (label: string, text?: string): void => {
      if (text && FORBIDDEN.test(text)) offenders.push(label);
    };
    // Page-level prose too — it is the first thing a reader meets.
    check('ANALYTICS_EVENTS_INTRO', ANALYTICS_EVENTS_INTRO);
    check('ANALYTICS_PROVIDERS_INTRO', ANALYTICS_PROVIDERS_INTRO);
    check('ANALYTICS_ENABLE_NOTE', ANALYTICS_ENABLE_NOTE);
    ANALYTICS_BLOCKED_EVENTS_NOTE.forEach((t, i) =>
      check(`ANALYTICS_BLOCKED_EVENTS_NOTE[${i}]`, t)
    );
    DL_PREFIX_NOTES.forEach((t, i) => check(`DL_PREFIX_NOTES[${i}]`, t));
    ANALYTICS_DEBUG_NOTES.forEach((t, i) =>
      check(`ANALYTICS_DEBUG_NOTES[${i}]`, t)
    );
    for (const step of ANALYTICS_FAILURE_STEPS) {
      check(`${step.stage}.condition`, step.condition);
      check(`${step.stage}.symptom`, step.symptom);
      check(`${step.stage}.fix`, step.fix);
    }
    for (const [shape, doc] of Object.entries(ANALYTICS_SHARED_SHAPES)) {
      check(`${shape}.summary`, doc.summary);
      for (const [path, text] of Object.entries(doc.fields)) {
        check(`${shape}.${path}`, text);
      }
    }
    for (const doc of ANALYTICS_EVENT_DOCS) {
      check(`${doc.name}.firesWhen`, doc.firesWhen);
      check(`${doc.name}.neverFired`, doc.neverFired);
      check(`${doc.name}.providerNotes`, doc.providerNotes);
      doc.cautions?.forEach((c, i) => check(`${doc.name}.cautions[${i}]`, c));
      for (const [path, text] of Object.entries(doc.fields ?? {})) {
        check(`${doc.name}.fields.${path}`, text);
      }
    }
    for (const [path, text] of Object.entries(ANALYTICS_FIELD_DOCS)) {
      check(`ANALYTICS_FIELD_DOCS.${path}`, text);
    }
    for (const doc of ANALYTICS_PROVIDER_DOCS) {
      check(`${doc.key}.summary`, doc.summary);
      check(`${doc.key}.reshaping`, doc.reshaping);
      check(`${doc.key}.drops`, doc.drops);
      doc.cautions?.forEach((c, i) => check(`${doc.key}.cautions[${i}]`, c));
    }
    expect(
      offenders,
      'see .claude/rules/documentation.md §2 — say what happens instead'
    ).toEqual([]);
  });

  // ── generated markdown ───────────────────────────────────────────────────

  const pages: Array<[string, () => string]> = [
    [
      'analytics-events.md',
      () => renderAnalyticsEvents(facts, ANALYTICS_EVENT_DOCS),
    ],
    [
      'analytics-providers.md',
      () => renderAnalyticsProviders(facts, ANALYTICS_PROVIDER_DOCS),
    ],
  ];

  it.each(pages)('%s matches the source', (file, render) => {
    const expected = render();
    const out = join(REF_DIR, file);
    if (UPDATE) {
      mkdirSync(REF_DIR, { recursive: true });
      writeFileSync(out, expected);
    }
    expect(existsSync(out), `${relative(SRC, out)} is missing`).toBe(true);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });
});

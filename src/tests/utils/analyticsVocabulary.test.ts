import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DL_EVENTS,
  DL_EVENT_NAMES,
  DL_EVENT_NAME_SET,
  isKnownDlEvent,
} from '@/utils/analytics/schemas/events';
import { eventSchemas } from '@/utils/analytics/schemas';

// Committed manifest = the cross-repo carrier. campaigns-os
// (campaign-spec/analytics-vocabulary.ts) syncs its copy from this file, so it
// must stay byte-identical to the DL_EVENTS const. Regenerate after editing the
// vocabulary with:  UPDATE_ANALYTICS_MANIFEST=1 npm run test -- analyticsVocabulary
const __dirname = dirname(fileURLToPath(import.meta.url));
const ANALYTICS_SRC = join(__dirname, '../../utils/analytics');
// The vocabulary declaration itself lists every name, so it must be excluded
// from the emit-site scan below — otherwise a typo'd entry in DL_EVENTS would
// appear as a literal here and hide from the drift check.
const SCHEMAS_DIR = join(ANALYTICS_SRC, 'schemas');
const MANIFEST_PATH = join(SCHEMAS_DIR, 'events.manifest.json');

// Recursively collect the analytics emit-site source files: every .ts under
// src/utils/analytics EXCEPT the schemas/ vocabulary declaration and test files.
function collectEmitSiteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === SCHEMAS_DIR) continue;
      out.push(...collectEmitSiteFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

// Every dl_* string literal emitted anywhere in the analytics source.
function scanEmittedEventNames(): Set<string> {
  const found = new Set<string>();
  for (const file of collectEmitSiteFiles(ANALYTICS_SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/['"](dl_[a-z_]+)['"]/g)) {
      found.add(m[1]);
    }
  }
  return found;
}

function buildManifest(): string {
  return (
    JSON.stringify(
      {
        $comment:
          'AUTO-GENERATED from src/utils/analytics/schemas/events.ts (DL_EVENTS). ' +
          'Do not hand-edit. Regenerate: UPDATE_ANALYTICS_MANIFEST=1 npm run test -- analyticsVocabulary',
        events: DL_EVENTS,
      },
      null,
      2
    ) + '\n'
  );
}

describe('analytics dl_* vocabulary (single source of truth)', () => {
  it('has no duplicate event names', () => {
    expect(DL_EVENT_NAMES.length).toBe(DL_EVENT_NAME_SET.size);
    expect(DL_EVENT_NAMES.length).toBe(DL_EVENTS.length);
  });

  it('every name is a well-formed dl_* identifier', () => {
    for (const name of DL_EVENT_NAMES) {
      expect(name).toMatch(/^dl_[a-z_]+$/);
    }
  });

  it('every schema-bearing event is registered in the vocabulary', () => {
    // Guards the invariant: you cannot add a field schema for an event without
    // also declaring it in DL_EVENTS. The reverse is allowed (the superset
    // contains many events that carry no field schema).
    const schemaKeys = Object.keys(eventSchemas);
    const missing = schemaKeys.filter(k => !DL_EVENT_NAME_SET.has(k));
    expect(missing).toEqual([]);
  });

  it('hasSchema flag matches eventSchemas membership exactly', () => {
    for (const def of DL_EVENTS) {
      expect(def.hasSchema).toBe(
        Object.prototype.hasOwnProperty.call(eventSchemas, def.name)
      );
    }
  });

  it('vocabulary matches the dl_* events actually emitted in source (both directions)', () => {
    // Closes the drift class this PR exists to prevent, in BOTH directions:
    //  • a new dl_* emit added to source (events/, tracking/, providers/) but
    //    not to DL_EVENTS — the manifest would silently miss it, and a
    //    blockedEvents picker built from it would too.
    //  • a typo'd/stale entry in DL_EVENTS that no source site actually emits
    //    (which the `name: string` type cannot catch on its own).
    const emitted = scanEmittedEventNames();

    const emittedNotListed = [...emitted]
      .filter(name => !DL_EVENT_NAME_SET.has(name))
      .sort();
    expect(
      emittedNotListed,
      `emitted in source but missing from DL_EVENTS: ${emittedNotListed.join(', ')}`
    ).toEqual([]);

    const listedNotEmitted = DL_EVENT_NAMES.filter(
      name => !emitted.has(name)
    ).sort();
    expect(
      listedNotEmitted,
      `in DL_EVENTS but not emitted anywhere in source (typo or stale?): ${listedNotEmitted.join(', ')}`
    ).toEqual([]);
  });

  it('isKnownDlEvent recognizes vocabulary and rejects unknowns', () => {
    expect(isKnownDlEvent('dl_purchase')).toBe(true);
    expect(isKnownDlEvent('purchase')).toBe(false); // the original drift bug
    expect(isKnownDlEvent('dl_not_a_real_event')).toBe(false);
  });

  it('committed manifest is in sync with DL_EVENTS', () => {
    const expected = buildManifest();
    if (process.env.UPDATE_ANALYTICS_MANIFEST) {
      // Regeneration is a deliberate, one-shot action — never a silent side
      // effect of a passing assertion. Writing then throwing means that if this
      // env var ever leaks into CI, the run goes RED (drift surfaced) instead of
      // green-with-a-dirty-tree. The `analytics:manifest` npm script writes here,
      // then re-runs this test WITHOUT the flag to confirm the tree is clean.
      writeFileSync(MANIFEST_PATH, expected);
      throw new Error(
        'events.manifest.json regenerated from DL_EVENTS — re-run tests without ' +
          'UPDATE_ANALYTICS_MANIFEST to confirm it is in sync.'
      );
    }
    const actual = readFileSync(MANIFEST_PATH, 'utf8');
    expect(actual).toBe(expected);
  });
});

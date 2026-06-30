import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
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
const MANIFEST_PATH = join(
  __dirname,
  '../../utils/analytics/schemas/events.manifest.json'
);

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

  it('isKnownDlEvent recognizes vocabulary and rejects unknowns', () => {
    expect(isKnownDlEvent('dl_purchase')).toBe(true);
    expect(isKnownDlEvent('purchase')).toBe(false); // the original drift bug
    expect(isKnownDlEvent('dl_not_a_real_event')).toBe(false);
  });

  it('committed manifest is in sync with DL_EVENTS', () => {
    const expected = buildManifest();
    if (process.env.UPDATE_ANALYTICS_MANIFEST) {
      writeFileSync(MANIFEST_PATH, expected);
    }
    const actual = readFileSync(MANIFEST_PATH, 'utf8');
    expect(actual).toBe(expected);
  });
});

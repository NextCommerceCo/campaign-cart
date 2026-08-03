/**
 * The public entry point: one call that reads the whole analytics surface by
 * composing every sibling extractor.
 */

import { join } from 'node:path';
import { extractEmitSites } from './extract-analytics-events-emit-sites';
import {
  extractProviderEventMaps,
  extractProviderRegistry,
} from './extract-analytics-events-providers';
import {
  extractDlEvents,
  extractEventSchemas,
} from './extract-analytics-events-schemas';
import type { AnalyticsExtract } from './extract-analytics-events-types';

/**
 * One call that reads the whole analytics surface.
 *
 * @param srcRoot absolute path to the repo's `src` directory
 */
export function extractAnalytics(srcRoot: string): AnalyticsExtract {
  const analyticsDir = join(srcRoot, 'core', 'analytics');
  const events = extractDlEvents(join(analyticsDir, 'schemas', 'events.ts'));
  const { schemas, shared } = extractEventSchemas(
    join(analyticsDir, 'schemas', 'index.ts')
  );
  const emitSites = extractEmitSites(analyticsDir, srcRoot, [
    join(srcRoot, 'core', 'sdk-initializer.ts'),
  ]);

  return {
    events,
    schemas,
    shared,
    // Every event gets a key, so "nothing builds this" is a fact the docs can
    // assert rather than an absent lookup.
    emitSites: Object.fromEntries(
      events.map(e => [e.name, emitSites[e.name] ?? []])
    ),
    providers: extractProviderRegistry(join(analyticsDir, 'index.ts')),
    providerEventMaps: extractProviderEventMaps(
      join(analyticsDir, 'providers')
    ),
  };
}

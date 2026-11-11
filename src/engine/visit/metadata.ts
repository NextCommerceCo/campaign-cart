import type { Engine } from '../engine';

/**
 * Merges `values` into the metadata the page set: a string or a number sets its key, a boolean is written out,
 * and `undefined`, `null` or `''` removes it. Any other value changes nothing; its key is returned.
 */
export function mergeMetadata(engine: Engine, values: Record<string, unknown>): string | undefined {
  const metadata = { ...engine.getState().visit.metadata };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') delete metadata[key];
    else if (typeof value === 'string' || typeof value === 'number') metadata[key] = value;
    else if (typeof value === 'boolean') metadata[key] = String(value);
    else return key;
  }
  engine.visit.setMetadata(metadata);
  return undefined;
}

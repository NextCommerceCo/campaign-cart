/** Build-time compatibility metadata; never imported by the SDK runtime. */
import { createHash } from 'node:crypto';
import type { StorageKeyDoc } from '@/docs/content/storage-keys';
import {
  toPattern,
  type ExtractedStorageKey,
} from '@/docs/extract/extract-storage-keys';

export function renderStorageCompatibility(input: {
  sdkVersion: string;
  extracted: ExtractedStorageKey[];
  docs: StorageKeyDoc[];
  /** Repo-relative paths and exact source text, including generation inputs. */
  provenanceInputs: Array<[string, string]>;
}): string {
  const docs = new Map(input.docs.map(doc => [toPattern(doc.key), doc]));
  const inputs = [...input.provenanceInputs].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const manifest = {
    schemaVersion: 1,
    sdkVersion: input.sdkVersion,
    // Re-evaluate on release: unknown SDK versions cannot receive a clean diagnosis.
    supportedSdkVersions: { min: '0.4.38', max: '0.4.38' },
    provenance: {
      extractor: 'src/docs/extract/extract-storage-keys.ts',
      registry: 'src/docs/content/storage-keys.ts',
      inputSha256: createHash('sha256')
        .update(JSON.stringify(inputs))
        .digest('hex'),
      inputs: inputs.map(([path, source]) => ({
        path,
        sha256: createHash('sha256').update(source).digest('hex'),
      })),
    },
    keys: [...input.extracted]
      .sort((a, b) => a.pattern.localeCompare(b.pattern))
      .map(key => {
        const doc = docs.get(key.pattern);
        if (!doc)
          throw new Error(`Storage key has no registry row: ${key.key}`);
        const scoped = doc.key.includes('{__scope}');
        if (
          doc.migration &&
          (!scoped ||
            toPattern(doc.migration.legacyKey + '{__scope}') !== key.pattern)
        ) {
          throw new Error(`Migration does not describe scoped key: ${doc.key}`);
        }
        return {
          key: doc.key,
          pattern: key.pattern,
          areas: key.areas,
          scoped,
          sources: key.sources,
          where: key.where,
          migration: doc.migration ?? null,
          replacement: doc.replacement ?? null,
        };
      }),
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

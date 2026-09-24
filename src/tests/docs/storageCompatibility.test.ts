import { describe, expect, it } from 'vitest';
import { renderStorageCompatibility } from '@/docs/render/render-storage-compatibility';
import type { ExtractedStorageKey } from '@/docs/extract/extract-storage-keys';
import type { StorageKeyDoc } from '@/docs/content/storage-keys';

const key: ExtractedStorageKey = {
  key: 'sample{__scope}',
  pattern: 'sample{}',
  dynamic: true,
  areas: ['sessionStorage'],
  sources: ['persist'],
  where: ['state/sample.ts › sample'],
};
const doc: StorageKeyDoc = {
  key: 'sample{__scope}',
  group: 'order',
  ttl: null,
  holds: 'Test state.',
  clearing: 'State is gone.',
};
function render(
  overrides: Partial<Parameters<typeof renderStorageCompatibility>[0]> = {}
) {
  return renderStorageCompatibility({
    sdkVersion: '0.4.38',
    extracted: [key],
    docs: [doc],
    provenanceInputs: [['src/sample.ts', 'source']],
    ...overrides,
  });
}

function parse(text: string): {
  keys: Array<{ key: string }>;
  provenance: { inputSha256: string };
  supportedSdkVersions: { min: string; max: string };
} {
  return JSON.parse(text) as ReturnType<typeof parse>;
}
describe('storage compatibility generation', () => {
  it('does not invent a boundary or replacement for an unknown scoped key', () => {
    expect(parse(render()).keys[0]).toMatchObject({
      scoped: true,
      migration: null,
      replacement: null,
    });
  });
  it('fails when a source key loses its registry entry', () => {
    expect(() => render({ docs: [] })).toThrow('no registry row');
  });
  it('rejects migration annotations that describe a different key', () => {
    expect(() =>
      render({
        docs: [
          {
            ...doc,
            migration: {
              since: '0.4.34',
              legacyKey: 'other',
              releaseEvidence: {
                commit: 'a'.repeat(40),
                tag: 'v0.4.34',
                previousTag: 'v0.4.33',
              },
            },
          },
        ],
      })
    ).toThrow('does not describe scoped key');
  });
  it('hashes exact source content while ignoring input enumeration order', () => {
    const inputs: Array<[string, string]> = [
      ['b.ts', 'two'],
      ['a.ts', 'one'],
    ];
    expect(render({ provenanceInputs: inputs })).toBe(
      render({ provenanceInputs: [...inputs].reverse() })
    );
    expect(parse(render()).provenance.inputSha256).not.toBe(
      parse(render({ provenanceInputs: [['src/sample.ts', 'changed']] }))
        .provenance.inputSha256
    );
  });
  it('does not silently authorize later SDK versions', () => {
    expect(
      parse(render({ sdkVersion: '0.4.39' })).supportedSdkVersions
    ).toEqual({ min: '0.4.38', max: '0.4.38' });
  });
});

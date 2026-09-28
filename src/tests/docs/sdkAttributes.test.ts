import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SDK_ATTRIBUTES } from '@/docs/content/sdk-attributes';
import { renderSdkAttributes } from '@/docs/render/render-sdk-attributes';

/**
 * Generates `docs/sdk-attributes.md` from `src/docs/content/sdk-attributes.ts` and
 * fails when the committed page drifts. Regenerate with `npm run docs:reference`.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('SDK-level attributes', () => {
  it('sdk-attributes.md matches the declared list', () => {
    const file = join(SRC, '../docs/sdk-attributes.md');
    const expected = renderSdkAttributes();
    if (UPDATE) writeFileSync(file, expected);
    expect(existsSync(file), `${file} is missing`).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(expected);
  });

  // No feature owns these, so nothing else notices when one leaves the code.
  it('every declared attribute is still read somewhere in src/core', () => {
    const core = Object.values(
      import.meta.glob<string>('../../core/**/*.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      })
    ).join('\n');
    const missing = SDK_ATTRIBUTES.filter(a => !core.includes(a.name)).map(
      a => a.name
    );
    expect(
      missing,
      'declared as SDK-level but not read anywhere in src/core'
    ).toEqual([]);
  });
});

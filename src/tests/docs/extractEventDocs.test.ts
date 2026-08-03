import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractEventDocs } from '@/docs/extract/extract-event-docs';

/**
 * Guards the `{@link}` handling in `extract-event-docs.ts`.
 *
 * TypeScript parses `{@link Foo}` into a `ts.JSDocLink` node rather than text, so
 * an extractor that reads only text nodes drops the symbol name and leaves the
 * `|` separator behind — which then breaks the markdown table row the text lands
 * in. That corruption is silent: `UPDATE_DOCS=1` writes it into the guides and
 * the drift test agrees with the mangled file.
 */

let dir: string;
let file: string;

const FIXTURE = `
export interface EventMap {
  /** Bare {@link Order} link. */
  'a:bare': {};
  /** Piped {@link Order | the created order} link. */
  'a:piped': {};
  /** Spaced {@link Order Created Order} link. */
  'a:spaced': {};
  /** Qualified {@link index.Order | full order} link. */
  'a:qualified': {};
  /** Code {@linkcode Order.lines} and plain {@linkplain Order.user | the buyer}. */
  'a:variants': {};
  /** See {@link https://example.com/orders | the orders API}. */
  'a:url': {};
  /** Field links. */
  'a:fields': {
    /** Matches {@link Order.ref_id | the order reference}. */
    refId: string;
  };
  /**
   * Example carrying a link.
   *
   * @example
   * \`\`\`json
   * { "refId": "ord_1" }
   * \`\`\`
   */
  'a:example': {};
}
`;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'event-docs-'));
  file = join(dir, 'global.ts');
  writeFileSync(file, FIXTURE);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('extractEventDocs', () => {
  it('renders a {@link} tag as its label, or the symbol when it has none', () => {
    const docs = extractEventDocs(file);

    expect(docs['a:bare']?.when).toBe('Bare Order link.');
    expect(docs['a:piped']?.when).toBe('Piped the created order link.');
    expect(docs['a:spaced']?.when).toBe('Spaced Created Order link.');
    expect(docs['a:qualified']?.when).toBe('Qualified full order link.');
    expect(docs['a:variants']?.when).toBe(
      'Code Order.lines and plain the buyer.'
    );
    expect(docs['a:url']?.when).toBe('See the orders API.');
  });

  it('leaves no `|` in a summary, which would split the table row', () => {
    for (const [name, doc] of Object.entries(extractEventDocs(file))) {
      expect(doc.when ?? '', `${name} summary`).not.toContain('|');
    }
  });

  it('resolves links in a payload field description too', () => {
    const fields = extractEventDocs(file)['a:fields']?.fields;
    expect(fields?.[0]?.description).toBe('Matches the order reference.');
  });

  it('still reads a fenced @example body', () => {
    expect(extractEventDocs(file)['a:example']?.example).toBe(
      '{ "refId": "ord_1" }'
    );
  });
});

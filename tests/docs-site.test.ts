import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countFiles, render404, renderRobots } from '../scripts/docs-site.mjs';

describe('docs site root files', () => {
  it('blocks crawlers until a public domain is set, then indexes only latest/', () => {
    expect(renderRobots(null)).toBe('User-agent: *\nDisallow: /\n');
    expect(renderRobots('https://docs.example.com')).toBe('User-agent: *\nAllow: /latest/\nDisallow: /\n');
  });

  it('links every version and main/ root-absolutely from the 404 page', () => {
    const html = render404([
      { version: '0.5.0', tag: 'v0.5.0', path: 'v0.5.0', current: true },
      { version: '0.4.40', tag: 'v0.4.40', path: 'v0.4.40', current: false },
    ]);
    expect(html).toContain('<a href="/v0.5.0/">0.5.0</a> (current)');
    expect(html).toContain('<a href="/v0.4.40/">0.4.40</a></li>');
    expect(html).toContain('<a href="/main/">main</a>');
  });

  it('counts files in nested folders', () => {
    const root = mkdtempSync(join(tmpdir(), 'docs-site-'));
    mkdirSync(join(root, 'latest/a'), { recursive: true });
    writeFileSync(join(root, 'index.html'), '');
    writeFileSync(join(root, 'latest/a/page.html'), '');
    expect(countFiles(root)).toBe(2);
  });
});

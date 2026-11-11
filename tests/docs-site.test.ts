import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countFiles, render404, renderRobots } from '../scripts/docs-site.mjs';
import { buildVersionIndex } from '../scripts/docs-versions.mjs';

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

describe('docs version index', () => {
  it('keeps current on the newest full release when a beta is newer', () => {
    const repo = mkdtempSync(join(tmpdir(), 'docs-versions-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], { cwd: repo });
    writeFileSync(join(repo, 'package.json'), '{"version":"0.5.1-beta.10"}');
    git('init', '--quiet');
    git('add', 'package.json');
    git('commit', '--quiet', '--no-gpg-sign', '-m', 'init');
    const tags = ['v0.5.0', 'v0.5.1-beta.2', 'v0.5.1-beta.10'];
    for (const tag of tags) {
      git('tag', tag);
      mkdirSync(join(repo, 'site', tag), { recursive: true });
    }

    const { versions } = buildVersionIndex({ cwd: repo, root: join(repo, 'site') });
    expect(versions.map((v) => [v.tag, v.current])).toEqual([
      ['v0.5.1-beta.10', false],
      ['v0.5.1-beta.2', false],
      ['v0.5.0', true],
    ]);
  });
});

describe('docs sidebar sections', () => {
  it('puts every sidebar group in a section, so none shows in all of them', () => {
    const { docGroups } = JSON.parse(readFileSync('typedoc.json', 'utf8')).cleanJsdocTheme;
    const sectioned = [...readFileSync('docs/assets/site.js', 'utf8').matchAll(/groups: \[([^\]]*)\]/g)].flatMap(
      ([, list]) => [...list!.matchAll(/'([^']+)'/g)].map(([, name]) => name),
    );
    expect(docGroups.filter((group: string) => !sectioned.includes(group))).toEqual([]);
  });
});

describe('docs loader examples', () => {
  it('load the SDK from the CDN at the version the docs are built for', () => {
    const pages = [
      'docs/site-home.md',
      ...readdirSync('docs/guides', { recursive: true, encoding: 'utf8' })
        .filter((name) => name.endsWith('.md'))
        .map((name) => join('docs/guides', name)),
    ];
    const sources = pages.flatMap((page) =>
      [...readFileSync(page, 'utf8').matchAll(/<script[^>]*src="([^"]*loader\.js)"/g)].map(([, src]) => src),
    );
    expect(sources.length).toBeGreaterThan(0);
    expect([...new Set(sources)]).toEqual([
      'https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js',
    ]);
  });
});

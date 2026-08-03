import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Drift check on the docs site's version index.
 *
 * `docs/site/versions.json` is the directory the in-page version switcher reads, and it
 * is **generated** — `scripts/docs-versions.mjs` derives it from the repository's release
 * tags plus `package.json`'s `version`. This test is what stops it from becoming
 * hand-kept, the same way `stateReference.test.ts` stops the state reference pages from
 * being hand-edited.
 *
 * Regenerate:
 *   npm run docs:versions
 *
 * Two directions are checked, and both matter:
 *
 * 1. **The generator's own output is well-formed** and its newest entry agrees with
 *    `package.json`. That runs on a bare checkout with nothing built, which is the state
 *    CI is in — so the contract is enforced even when no site exists.
 * 2. **A committed/built `versions.json`, if present, equals what the generator
 *    produces.** A stale file is the failure that actually reaches a reader: the switcher
 *    would offer versions that were never built, or hide the release they are on.
 *
 * The script is run as a subprocess rather than imported. It is a plain `.mjs` with no
 * type declarations, and running the real CLI also covers its argument handling — which
 * is what a human invokes.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');

/**
 * Site root to check. `docs/site` is where `npm run docs:version` puts a build;
 * `DOCS_SITE_ROOT` points the check at a build made somewhere else, which is how the
 * "built site" block below gets exercised without a full 2-version build in the repo.
 */
const SITE = process.env.DOCS_SITE_ROOT
  ? resolve(process.env.DOCS_SITE_ROOT)
  : join(REPO, 'docs/site');
const VERSIONS_JSON = join(SITE, 'versions.json');

interface VersionEntry {
  version: string;
  tag: string;
  path: string;
  current: boolean;
}

/** Runs `docs-versions.mjs --print` and parses its JSON. */
function generate(args: string[] = []): VersionEntry[] {
  const stdout = execFileSync(
    'node',
    [
      join(REPO, 'scripts/docs-versions.mjs'),
      '--print',
      '--out',
      SITE,
      ...args,
    ],
    { cwd: REPO, encoding: 'utf8' }
  );
  return JSON.parse(stdout) as VersionEntry[];
}

const packageVersion = (
  JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

/**
 * Every tag at or above the version floor, ignoring what happens to be built. The
 * built-only default would be empty on a fresh checkout, and an empty list cannot prove
 * anything about the shape.
 */
const eligible = generate(['--all']);

describe('docs site version index', () => {
  it('finds at least one release eligible for a versioned docs build', () => {
    // Zero here almost always means the checkout has no tags rather than that the
    // project has no releases — `actions/checkout` fetches none unless asked, which
    // failed this suite on every CI run until `fetch-tags: true` was added. The other
    // two cases in this file then fail with `undefined.version`, which says nothing
    // about the cause; say it here instead.
    expect(
      eligible.length,
      'no release tags visible — in CI check that actions/checkout runs with `fetch-tags: true`; locally check `git for-each-ref refs/tags`'
    ).toBeGreaterThan(0);
  });

  it('lists versions newest first', () => {
    for (let i = 1; i < eligible.length; i++) {
      const newer = eligible[i - 1];
      const older = eligible[i];
      expect(
        newer.version.localeCompare(older.version, undefined, {
          numeric: true,
        }),
        `${newer.tag} should sort above ${older.tag}`
      ).toBeGreaterThan(0);
    }
  });

  it('marks exactly one version current, and it is the newest', () => {
    const current = eligible.filter(entry => entry.current);
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(eligible[0]);
  });

  it.each(eligible)('$tag is well-formed', entry => {
    expect(entry.tag).toMatch(/^v\d+\.\d+\.\d+(-.+)?$/);
    expect(entry.version).toBe(entry.tag.slice(1));
    // The switcher builds `<siteRoot>/<path>/<page>`, so `path` must be a single
    // folder name — a slash or `..` in it would escape the version folder.
    expect(entry.path).toBe(entry.tag);
    expect(typeof entry.current).toBe('boolean');
  });

  /**
   * The version the SDK currently ships is the version whose docs `latest/` serves, so a
   * released `package.json` version that is missing from the index means readers on the
   * shipping SDK have no docs folder to land in.
   */
  it("includes package.json's version once it has a tag", () => {
    const tagged = eligible.some(entry => entry.version === packageVersion);
    const newest = eligible[0];
    if (tagged) {
      expect(
        newest.version,
        `package.json is ${packageVersion} but the newest eligible tag is ${newest.tag}`
      ).toBe(packageVersion);
    } else {
      // An unreleased version bump. Legitimate, but it must be ahead of every tag —
      // behind would mean package.json was reverted or a tag was pushed from elsewhere.
      expect(
        newest.version.localeCompare(packageVersion, undefined, {
          numeric: true,
        }),
        `package.json ${packageVersion} is older than the newest tag ${newest.tag}`
      ).toBeLessThan(0);
    }
  });
});

describe.runIf(existsSync(VERSIONS_JSON))(
  'built docs/site/versions.json',
  () => {
    it('matches what scripts/docs-versions.mjs generates', () => {
      const committed = readFileSync(VERSIONS_JSON, 'utf8');
      const expected = `${JSON.stringify(generate(), null, 2)}\n`;
      expect(
        committed,
        'docs/site/versions.json is stale — regenerate with: npm run docs:versions'
      ).toBe(expected);
    });

    it('points every entry at a folder that was actually built', () => {
      const versions = JSON.parse(
        readFileSync(VERSIONS_JSON, 'utf8')
      ) as VersionEntry[];
      for (const entry of versions) {
        expect(
          existsSync(join(SITE, entry.path)),
          `${SITE}/${entry.path} is missing`
        ).toBe(true);
      }
    });
  }
);

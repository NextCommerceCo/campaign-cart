#!/usr/bin/env node
/**
 * Builds the 0.4 docs into `<out>`: one folder per `v0.4.x` tag and a `latest/` copy of
 * the newest. The 0.4 tags use the pre-rewrite layout, so this runs the docs builder as
 * it stood before the rewrite, from a throwaway worktree. Needs the tags and `bun`.
 *
 *   node scripts/docs-legacy.mjs <out>
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Last commit before the rewrite, i.e. the 0.4 docs builder. */
export const LEGACY_BUILDER = '4c00ba067bfe8dc2ea884f75404592f6c629873f';

const out = process.argv[2];
if (!out) {
  process.stderr.write('Usage: node scripts/docs-legacy.mjs <out>\n');
  process.exit(1);
}

const worktree = join(mkdtempSync(join(tmpdir(), 'cc-docs-legacy-')), 'builder');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
try {
  run('git', ['worktree', 'add', '--detach', '--quiet', worktree, LEGACY_BUILDER]);
  run('bun', ['install'], worktree);
  run('bun', ['run', 'docs:publish', '--no-branch'], worktree);

  const site = join(worktree, 'docs/site');
  const target = resolve(out);
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(site).filter((n) => n === 'latest' || n.startsWith('v0.4.'))) {
    cpSync(join(site, name), join(target, name), { recursive: true });
  }
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', worktree], { stdio: 'inherit' });
}

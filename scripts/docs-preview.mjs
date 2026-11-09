#!/usr/bin/env node
/**
 * Assembles the docs site the way `.github/workflows/docs-deploy.yml` does and serves it
 * on :3500. The 0.4 folders are built from their tags once and cached in `docs/.legacy`;
 * delete that folder to rebuild them.
 *
 *   node scripts/docs-preview.mjs
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const LEGACY = 'docs/.legacy';
const SITE = 'docs/site';
const node = (...args) => execFileSync('node', args, { stdio: 'inherit' });

if (!existsSync(LEGACY)) node('scripts/docs-legacy.mjs', LEGACY);

rmSync(SITE, { recursive: true, force: true });
cpSync(LEGACY, SITE, { recursive: true });
node('scripts/docs-build.mjs', 'main');
node('scripts/docs-site.mjs', '--require-release');
node('scripts/docs-serve.mjs');

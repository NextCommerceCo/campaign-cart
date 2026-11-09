#!/usr/bin/env node
/**
 * Builds one folder of the docs site: `docs/site/<folder>` served under `/<folder>/`.
 *
 *   node scripts/docs-build.mjs latest     # what `npm run docs` builds
 *   node scripts/docs-build.mjs main       # the unreleased branch
 *   node scripts/docs-build.mjs v0.5.0     # a release; source links point at the tag
 *
 * `typedoc.json` fixes the output path and `basePath` to `latest/`, and the TypeDoc CLI
 * cannot override one key of the theme's object option, so this sets both through the API.
 */

import { spawnSync } from 'node:child_process';
import { Application, PackageJsonReader, TSConfigReader, TypeDocReader } from 'typedoc';

const folder = process.argv[2];
if (!folder || !/^[\w.-]+$/.test(folder)) {
  process.stderr.write('Usage: node scripts/docs-build.mjs <folder>\n');
  process.exit(1);
}

const stage = spawnSync('node', ['scripts/docs-stage.mjs'], { stdio: 'inherit' });
if (stage.status !== 0) process.exit(stage.status ?? 1);

const app = await Application.bootstrapWithPlugins({ treatWarningsAsErrors: true }, [
  new TypeDocReader(),
  new PackageJsonReader(),
  new TSConfigReader(),
]);
const cwd = process.cwd();
app.options.setValue('cleanJsdocTheme', { ...app.options.getValue('cleanJsdocTheme'), basePath: `/${folder}/` });
app.options.setValue('outputs', [{ name: 'clean-jsdoc-theme', path: `docs/site/${folder}` }], cwd);
if (folder.startsWith('v')) app.options.setValue('gitRevision', folder);

const failed = () => app.logger.hasErrors() || app.logger.hasWarnings();
const project = await app.convert();
if (!project || failed()) process.exit(1);
app.validate(project);
if (failed()) process.exit(1);
await app.generateOutputs(project);
if (failed()) process.exit(1);

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runScenarios, type Scenario } from './e2e/harness';

const dir = join(import.meta.dirname, 'e2e/scenarios');
const all = readdirSync(dir)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.slice(0, -3))
  .sort();
const asked = process.argv.slice(2).filter((arg) => arg !== '--');
const unknown = asked.filter((name) => !all.includes(name));
if (unknown.length) {
  console.error(`No scenario ${unknown.join(', ')}. There are: ${all.join(', ')}`);
  process.exit(2);
}

const scenarios: Record<string, Scenario> = {};
for (const name of asked.length ? asked : all) {
  scenarios[name] = ((await import(join(dir, `${name}.ts`))) as { scenario: Scenario }).scenario;
}
process.exit((await runScenarios(scenarios)) ? 1 : 0);

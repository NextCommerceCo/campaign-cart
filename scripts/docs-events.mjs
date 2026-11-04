// @ts-check
/**
 * Writes the Event Reference: one page per public event, from `EventMap` in
 * `src/engine/events.ts` (its TSDoc and `@group`) and the payloads `tests/event-examples.test.ts`
 * recorded in `docs/event-examples.json`. Pages land in `docs/.staged/event-reference/`, and the
 * index replaces `<!-- event-index -->` in the staged `events.md`. Nothing here is committed.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { slugifyPath } from '@clean-jsdoc-theme/utils';
import { Application, ReflectionKind, TSConfigReader } from 'typedoc';

const GROUP = 'Event Reference';
const MARKER = '<!-- event-index -->';

const text = (parts = []) =>
  parts
    .map((p) => p.text)
    .join('')
    .trim();
const firstSentence = (s) => s.match(/^.*?\.(?=\s|$)/s)?.[0] ?? s;
const cell = (s) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

/** A union alias such as `SelectorType` reads better spelled out. */
function typeText(type) {
  const target = type?.type === 'reference' ? type.reflection : undefined;
  if (target?.kindOf(ReflectionKind.TypeAlias) && target.type?.type === 'union') return target.type.toString();
  return type?.toString() ?? 'unknown';
}

/** Fields of a data type: a literal, an interface, or an intersection of them. */
function fieldsOf(type) {
  if (!type) return [];
  if (type.type === 'intersection') return type.types.flatMap(fieldsOf);
  if (type.type === 'reflection') return type.declaration.children ?? [];
  if (type.type === 'reference' && type.reflection) {
    const target = type.reflection;
    return target.children ?? fieldsOf(target.type);
  }
  return [];
}

async function events(root) {
  const app = await Application.bootstrap(
    {
      entryPoints: [join(root, 'src/engine/events.ts')],
      tsconfig: join(root, 'tsconfig.json'),
      excludeInternal: true,
      sort: ['source-order'],
      readme: 'none',
      logLevel: 'Error',
    },
    [new TSConfigReader()],
  );
  const project = await app.convert();
  const map = project?.getChildByName('EventMap');
  if (!map) throw new Error('docs-events: EventMap not found in src/engine/events.ts');
  return (map.children ?? [])
    .map((member) => ({
      name: member.name,
      group: text(member.comment?.getTag('@group')?.content),
      summary: text(member.comment?.summary),
      fields: fieldsOf(member.type).map((f) => ({
        name: f.name,
        optional: f.flags.isOptional,
        type: typeText(f.type),
        about: text(f.comment?.summary),
      })),
    }))
    .filter((e) => e.group);
}

function page(event, order, example, version) {
  const rows = event.fields.map(
    (f) => `| \`${f.name}\`${f.optional ? ' · optional' : ''} | \`${cell(f.type)}\` | ${cell(f.about)} |`,
  );
  const envelope = {
    event_id: 'evt_mhk2f1a00k3x',
    event_type: event.name,
    object: event.name.split('.')[0],
    data: example,
    created_at: '2026-11-04T08:30:00.000Z',
    sdk_version: version,
  };
  return `---
title: '${event.name}'
group: '${GROUP}/${event.group}'
order: ${order}
---

# ${event.name}

${event.summary}

\`\`\`js
next.on('${event.name}', (data, event) => {});
\`\`\`

## Data

${rows.length ? ['| Field | Type | |', '| --- | --- | --- |', ...rows].join('\n') : 'None.'}

## Example

The second argument, with \`data\` inside. See [Events](/events) for the envelope's fields.

\`\`\`json
${JSON.stringify(envelope, null, 2)}
\`\`\`
`;
}

const linkOf = (event) => `/${slugifyPath([GROUP, event.group, event.name])}`;

function index(list) {
  const groups = [...new Set(list.map((e) => e.group))];
  return groups
    .map((group) => {
      const rows = list
        .filter((e) => e.group === group)
        .map((e) => `| [\`${e.name}\`](${linkOf(e)}) | ${cell(firstSentence(e.summary))} |`);
      return [`### ${group}`, '', '| Event | When |', '| --- | --- |', ...rows].join('\n');
    })
    .join('\n\n');
}

/** @param {string} root  @param {string} out  staged docs root */
export async function stageEventReference(root, out) {
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const examples = JSON.parse(await readFile(join(root, 'docs/event-examples.json'), 'utf8'));
  const list = await events(root);
  const dir = join(out, slugifyPath([GROUP]));
  await rm(dir, { recursive: true, force: true });
  for (const [i, event] of list.entries()) {
    if (!(event.name in examples))
      throw new Error(`docs-events: no example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    const file = join(dir, slugifyPath([event.group]), `${event.name}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, page(event, i + 1, examples[event.name], version));
  }
  const overview = join(out, 'events.md');
  const staged = await readFile(overview, 'utf8');
  if (!staged.includes(MARKER)) throw new Error(`docs-events: ${MARKER} is missing from docs/guides/events.md`);
  await writeFile(overview, staged.replace(MARKER, index(list)));
  return list.length;
}

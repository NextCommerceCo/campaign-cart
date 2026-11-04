// @ts-check
/**
 * Writes the Event Reference: one page per public event, from `EventMap` in `src/engine/events.ts`
 * (its TSDoc and `@group`). An object a field carries (`Line`, `CartSummary`, `Order`, …) is spelled
 * out under that field as `field.child` rows, from the same types' TSDoc, the way the webhook
 * reference does. Examples are the payloads `tests/event-examples.test.ts` recorded in
 * `docs/event-examples.json`. Pages land in `docs/.staged/event-reference/`, and the index replaces
 * `<!-- event-index -->` in the staged `events.md`. Nothing here is committed.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { slugifyPath } from '@clean-jsdoc-theme/utils';
import { Application, ReflectionKind, TSConfigReader } from 'typedoc';

const GROUP = 'Event Reference';
const SOURCES = ['src/engine/events.ts', 'src/engine/cart/types.ts', 'src/engine/types.ts'];
const MARKER = '<!-- event-index -->';

const firstSentence = (s) => s.match(/^.*?\.(?=\s|$)/s)?.[0] ?? s;
const cell = (s) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const linkOf = (e) => `/${slugifyPath([GROUP, e.group, e.name])}`;

const text = (parts = []) =>
  parts
    .map((p) => (p.kind === 'inline-tag' ? `\`${p.text}\`` : p.text))
    .join('')
    .trim();

async function eventMap(root) {
  const app = await Application.bootstrap(
    {
      entryPoints: SOURCES.map((s) => join(root, s)),
      tsconfig: join(root, 'tsconfig.json'),
      excludeInternal: true,
      sort: ['source-order'],
      readme: 'none',
      logLevel: 'Error',
    },
    [new TSConfigReader()],
  );
  const project = await app.convert();
  const map = project?.getReflectionsByKind(ReflectionKind.Interface).find((r) => r.name === 'EventMap');
  if (!map) throw new Error('docs-events: EventMap not found in src/engine/events.ts');
  return map;
}

/** Fields of an event's data: a literal, an interface, or an intersection of them. */
function fieldsOf(type) {
  if (!type) return [];
  if (type.type === 'intersection') return type.types.flatMap(fieldsOf);
  if (type.type === 'reflection') return type.declaration.children ?? [];
  if (type.type === 'reference' && type.reflection) return type.reflection.children ?? fieldsOf(type.reflection.type);
  return [];
}

const objectOf = (type) =>
  type?.type === 'reference' && type.reflection?.kindOf(ReflectionKind.Interface) ? type.reflection : undefined;

/** The object a field holds, and how its rows are named: `a.b`, `a[].b`, or `a.<key>.b` for a map. */
function inner(type) {
  if (type?.type === 'array') return { type: type.elementType, step: '[].' };
  const value = type?.type === 'reference' && type.name === 'Record' ? type.typeArguments?.[1] : undefined;
  if (value) return { type: value, step: '.<key>.' };
  return { type, step: '.' };
}

function typeMd(type) {
  switch (type?.type) {
    case 'reference': {
      const r = type.reflection;
      if (r?.kindOf(ReflectionKind.TypeAlias) && r.type?.type === 'union') return typeMd(r.type);
      const args = type.typeArguments?.length ? `<${type.typeArguments.map(typeMd).join(', ')}>` : '';
      return `\`${type.name}\`${args}`;
    }
    case 'array':
      return `${typeMd(type.elementType)}[]`;
    case 'union':
      return type.types.map(typeMd).join(' | ');
    case 'reflection':
      return '`object`';
    default:
      return `\`${type?.toString() ?? 'unknown'}\``;
  }
}

/** Table rows for fields, each object's own fields under it. */
function rows(fields, prefix = '', seen = new Set()) {
  return fields.flatMap((f) => {
    const name = `${prefix}${f.name}`;
    const { type, step } = inner(f.type);
    const object = objectOf(type);
    const about = text(f.comment?.summary) || text(object?.comment?.summary);
    const row = `| \`${name}\`${f.flags.isOptional ? ' · optional' : ''} | ${cell(typeMd(f.type))} | ${cell(about)} |`;
    const children =
      type?.type === 'reflection'
        ? type.declaration.children
        : object && !seen.has(object)
          ? object.children
          : undefined;
    return [row, ...(children ? rows(children, `${name}${step}`, new Set([...seen, object])) : [])];
  });
}

function page(event, order, example, version) {
  const body = rows(fieldsOf(event.member.type));
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

${body.length ? ['| Field | Type | |', '| --- | --- | --- |', ...body].join('\n') : 'None.'}

## Example

The second argument, with \`data\` inside. See [Events](/events) for the envelope's fields.

\`\`\`json
${JSON.stringify(envelope, null, 2)}
\`\`\`
`;
}

function index(events) {
  return [...new Set(events.map((e) => e.group))]
    .map((group) => {
      const list = events
        .filter((e) => e.group === group)
        .map((e) => `| [\`${e.name}\`](${linkOf(e)}) | ${cell(firstSentence(e.summary))} |`);
      return [`### ${group}`, '', '| Event | When |', '| --- | --- |', ...list].join('\n');
    })
    .join('\n\n');
}

/** @param {string} root  @param {string} out  staged docs root */
export async function stageEventReference(root, out) {
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const examples = JSON.parse(await readFile(join(root, 'docs/event-examples.json'), 'utf8'));
  const events = ((await eventMap(root)).children ?? [])
    .map((member) => ({
      name: member.name,
      group: text(member.comment?.getTag('@group')?.content),
      summary: text(member.comment?.summary),
      member,
    }))
    .filter((e) => e.group);
  await rm(join(out, slugifyPath([GROUP])), { recursive: true, force: true });
  for (const [i, event] of events.entries()) {
    if (!(event.name in examples))
      throw new Error(`docs-events: no example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    const file = join(out, slugifyPath([GROUP, event.group]), `${event.name}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, page(event, i + 1, examples[event.name], version));
  }
  const overview = join(out, 'events.md');
  const staged = await readFile(overview, 'utf8');
  if (!staged.includes(MARKER)) throw new Error(`docs-events: ${MARKER} is missing from docs/guides/events.md`);
  await writeFile(overview, staged.replace(MARKER, index(events)));
  return events.length;
}

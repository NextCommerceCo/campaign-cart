// @ts-check
/**
 * Writes the Event Reference and the Objects pages: one page per public event, from `EventMap` in
 * `src/engine/events.ts` (its TSDoc and `@group`), and one per object an event carries (`Line`,
 * `CartSummary`, `Order`, …), from the same types' TSDoc. Examples are the payloads
 * `tests/event-examples.test.ts` recorded in `docs/event-examples.json`. Pages land in
 * `docs/.staged/`, and the indexes replace `<!-- event-index -->` and `<!-- object-index -->` in the
 * staged `events.md`. Nothing here is committed.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { slugifyPath } from '@clean-jsdoc-theme/utils';
import { Application, ReflectionKind, TSConfigReader } from 'typedoc';

const EVENTS = 'Event Reference';
const OBJECTS = 'Objects';
const SOURCES = ['src/engine/events.ts', 'src/engine/cart/types.ts', 'src/engine/types.ts'];

const firstSentence = (s) => s.match(/^.*?\.(?=\s|$)/s)?.[0] ?? s;
const cell = (s) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const objectLink = (r) => `/${slugifyPath([OBJECTS, r.name])}`;
const eventLink = (e) => `/${slugifyPath([EVENTS, e.group, e.name])}`;

async function convert(root) {
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

/** Walks every type an event carries, collecting the interfaces it names and where each first appears. */
function collect(map) {
  const objects = new Map();
  const events = [];
  const visit = (type, from, path) => {
    if (!type) return;
    if (type.type === 'array') return visit(type.elementType, from, [...path, '*']);
    if (type.type === 'union' || type.type === 'intersection') return type.types.forEach((t) => visit(t, from, path));
    if (type.type === 'reflection') {
      for (const f of type.declaration.children ?? []) visit(f.type, from, [...path, f.name]);
      return;
    }
    if (type.type !== 'reference') return;
    type.typeArguments?.forEach((t) => visit(t, from, [...path, '*']));
    const r = type.reflection;
    if (!r?.kindOf(ReflectionKind.Interface)) return;
    const seen = objects.get(r);
    if (seen) return void seen.usedBy.push({ from, field: path.findLast((p) => p !== '*') });
    objects.set(r, { reflection: r, usedBy: [{ from, field: path.findLast((p) => p !== '*') }], path });
    const owner = { name: r.name, link: objectLink(r) };
    for (const f of r.children ?? []) visit(f.type, owner, [...path, f.name]);
  };
  for (const member of map.children ?? []) {
    const group = text(member.comment?.getTag('@group')?.content);
    if (!group) continue;
    const event = { name: member.name, group, member, link: '' };
    event.link = eventLink(event);
    events.push(event);
    for (const f of fieldsOf(member.type)) visit(f.type, { name: event.name, link: event.link }, [event.name, f.name]);
  }
  return { events, objects };
}

/** Fields of an event's data: a literal, an interface, or an intersection of them. */
function fieldsOf(type) {
  if (!type) return [];
  if (type.type === 'intersection') return type.types.flatMap(fieldsOf);
  if (type.type === 'reflection') return type.declaration.children ?? [];
  if (type.type === 'reference' && type.reflection) return type.reflection.children ?? fieldsOf(type.reflection.type);
  return [];
}

let known = new Map();

function text(parts = []) {
  return parts
    .map((p) => {
      if (p.kind !== 'inline-tag') return p.text;
      const target = typeof p.target === 'object' && known.get(p.target);
      return target ? `[\`${p.target.name}\`](${target})` : `\`${p.text}\``;
    })
    .join('')
    .trim();
}

function typeMd(type) {
  switch (type?.type) {
    case 'reference': {
      const r = type.reflection;
      if (r && known.has(r)) return `[\`${r.name}\`](${known.get(r)})`;
      if (r?.kindOf(ReflectionKind.TypeAlias) && r.type?.type === 'union') return typeMd(r.type);
      const args = type.typeArguments?.length ? `<${type.typeArguments.map(typeMd).join(', ')}>` : '';
      return `\`${type.name}\`${args}`;
    }
    case 'array':
      return `${typeMd(type.elementType)}[]`;
    case 'union':
      return type.types.map(typeMd).join(' | ');
    case 'intersection':
      return type.types.map(typeMd).join(' & ');
    case 'reflection':
      return '`object`';
    default:
      return `\`${type?.toString() ?? 'unknown'}\``;
  }
}

/** Table rows for fields, with an inline object's fields under it as `parent.child`. */
function rows(fields, prefix = '') {
  return fields.flatMap((f) => {
    const name = `${prefix}${f.name}`;
    const row = `| \`${name}\`${f.flags.isOptional ? ' · optional' : ''} | ${cell(typeMd(f.type))} | ${cell(text(f.comment?.summary))} |`;
    const inner = f.type?.type === 'array' ? f.type.elementType : f.type;
    const nested =
      inner?.type === 'reflection'
        ? rows(inner.declaration.children ?? [], `${name}${inner === f.type ? '' : '[]'}.`)
        : [];
    return [row, ...nested];
  });
}

const table = (fields) => {
  const body = rows(fields);
  return body.length ? ['| Field | Type | |', '| --- | --- | --- |', ...body].join('\n') : 'None.';
};

function resolve(value, path) {
  for (const step of path) {
    if (value == null) return undefined;
    value = step === '*' ? (Array.isArray(value) ? value[0] : Object.values(value)[0]) : value[step];
  }
  return value;
}

const json = (value) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

function eventPage(event, order, example, version) {
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
group: '${EVENTS}/${event.group}'
order: ${order}
---

# ${event.name}

${text(event.member.comment?.summary)}

\`\`\`js
next.on('${event.name}', (data, event) => {});
\`\`\`

## Data

${table(fieldsOf(event.member.type))}

## Example

The second argument, with \`data\` inside. See [Events](/events) for the envelope's fields.

${json(envelope)}
`;
}

function objectPage(object, order, examples) {
  const r = object.reflection;
  const used = object.usedBy.map((u) => `- [\`${u.from.name}\`](${u.from.link})${u.field ? ` · \`${u.field}\`` : ''}`);
  const [event, ...path] = object.path;
  const example = resolve(examples[event], path);
  return `---
title: '${r.name}'
group: '${OBJECTS}'
order: ${order}
---

# ${r.name}

${text(r.comment?.summary)}

## Fields

${table(r.children ?? [])}

## Used by

${[...new Set(used)].join('\n')}
${example === undefined ? '' : `\n## Example\n\nFrom \`${event}\`.\n\n${json(example)}\n`}`;
}

function eventIndex(events) {
  return [...new Set(events.map((e) => e.group))]
    .map((group) => {
      const list = events
        .filter((e) => e.group === group)
        .map((e) => `| [\`${e.name}\`](${e.link}) | ${cell(firstSentence(text(e.member.comment?.summary)))} |`);
      return [`### ${group}`, '', '| Event | When |', '| --- | --- |', ...list].join('\n');
    })
    .join('\n\n');
}

function objectIndex(objects) {
  const list = [...objects.values()].map(
    ({ reflection: r }) => `| [\`${r.name}\`](${objectLink(r)}) | ${cell(firstSentence(text(r.comment?.summary)))} |`,
  );
  return ['| Object | |', '| --- | --- |', ...list].join('\n');
}

async function write(file, body) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
}

/** @param {string} root  @param {string} out  staged docs root */
export async function stageEventReference(root, out) {
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const examples = JSON.parse(await readFile(join(root, 'docs/event-examples.json'), 'utf8'));
  const { events, objects } = collect(await convert(root));
  known = new Map([...objects.keys()].map((r) => [r, objectLink(r)]));
  for (const dir of [EVENTS, OBJECTS]) await rm(join(out, slugifyPath([dir])), { recursive: true, force: true });
  for (const [i, event] of events.entries()) {
    if (!(event.name in examples))
      throw new Error(`docs-events: no example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    await write(
      join(out, slugifyPath([EVENTS, event.group]), `${event.name}.md`),
      eventPage(event, i + 1, examples[event.name], version),
    );
  }
  for (const [i, object] of [...objects.values()].entries()) {
    await write(join(out, slugifyPath([OBJECTS]), `${object.reflection.name}.md`), objectPage(object, i + 1, examples));
  }
  const overview = join(out, 'events.md');
  let staged = await readFile(overview, 'utf8');
  for (const [marker, body] of [
    ['<!-- event-index -->', eventIndex(events)],
    ['<!-- object-index -->', objectIndex(objects)],
  ]) {
    if (!staged.includes(marker)) throw new Error(`docs-events: ${marker} is missing from docs/guides/events.md`);
    staged = staged.replace(marker, body);
  }
  await writeFile(overview, staged);
  return { events: events.length, objects: objects.size };
}

// @ts-check
/**
 * Writes the Event Reference: one page per public event, from `EventMap` in `src/engine/events.ts`
 * (its TSDoc and `@group`). The page's Data table lists the event's own fields; every object they
 * carry (`CartItem`, `Order`, …) gets its own table further down the same page, once, from the same
 * types' TSDoc. A field tagged `@priced` or `@campaign`, or optional, says so in the Present column.
 * Examples are the payloads `tests/event-examples.test.ts` recorded in `docs/event-examples.json`.
 * Pages land in `docs/.staged/event-reference/`, and the index replaces `<!-- event-index -->` in the
 * staged `events.md`. A group's hand-written `lifecycle.md` is ordered just before its first event.
 * Nothing here is committed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { slugifyHeading, slugifyPath } from '@clean-jsdoc-theme/utils';
import { Application, OptionDefaults, ReflectionKind, TSConfigReader } from 'typedoc';

const GROUP = 'Event Reference';
const SOURCES = ['src/engine/events.ts', 'src/engine/cart/types.ts', 'src/engine/types.ts'];
const MARKER = '<!-- event-index -->';
const WHEN = ['@priced', '@campaign'];
const PRESENT =
  '**Present**: `always`; `optional` when it may be missing; `campaign` once the campaign is loaded; `priced` once the server priced the cart.';

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
      modifierTags: [...OptionDefaults.modifierTags, ...WHEN],
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

/** Fields of an event's data: a literal, an interface, or an intersection of them, the last of a name winning. */
function fieldsOf(type) {
  if (!type) return [];
  if (type.type === 'intersection') {
    const byName = new Map(type.types.flatMap(fieldsOf).map((f) => [f.name, f]));
    return [...byName.values()];
  }
  if (type.type === 'reflection') return type.declaration.children ?? [];
  if (type.type === 'reference' && type.reflection) return type.reflection.children ?? fieldsOf(type.reflection.type);
  return [];
}

const objectOf = (type) =>
  type?.type === 'reference' && type.reflection?.kindOf(ReflectionKind.Interface) ? type.reflection : undefined;

/** Writes one page's tables, collecting the objects its fields carry so each gets a table once. */
function tables() {
  const objects = [];
  const anchor = (r) => `#${slugifyHeading(r.name)}`;

  const typeMd = (type) => {
    switch (type?.type) {
      case 'reference': {
        const r = type.reflection;
        if (objectOf(type)) {
          if (!objects.includes(r)) objects.push(r);
          return `[\`${r.name}\`](${anchor(r)})`;
        }
        if (r?.kindOf(ReflectionKind.TypeAlias) && r.type?.type === 'union') return typeMd(r.type);
        const linked = (a) => objectOf(a.type === 'array' ? a.elementType : a);
        const args = type.typeArguments ?? [];
        if (!args.some(linked)) return `\`${type.toString()}\``;
        let md = '';
        let code = `${type.name}<`;
        args.forEach((a, i) => {
          if (i) code += ', ';
          if (!linked(a)) return void (code += a.toString());
          md += `\`${code}\`${typeMd(a)}`;
          code = '';
        });
        return `${md}\`${code}>\``;
      }
      case 'array':
        return objectOf(type.elementType) ? `${typeMd(type.elementType)}\`[]\`` : `\`${type.toString()}\``;
      case 'union':
        return type.types.map(typeMd).join(' | ');
      case 'reflection':
        return '`object`';
      default:
        return `\`${type?.toString() ?? 'unknown'}\``;
    }
  };

  const whenOf = (f) => WHEN.find((tag) => f.comment?.hasModifier(tag))?.slice(1);

  const rows = (fields, prefix = '') =>
    fields.flatMap((f) => {
      const name = `${prefix}${f.name}`;
      const present = whenOf(f) ?? (f.flags.isOptional ? 'optional' : 'always');
      const literal = f.type?.type === 'array' ? f.type.elementType : f.type;
      const row = { name, present, type: typeMd(f.type), about: text(f.comment?.summary) };
      const nested =
        literal?.type === 'reflection'
          ? rows(literal.declaration.children ?? [], `${name}${literal === f.type ? '.' : '[].'}`)
          : [];
      return [row, ...nested];
    });

  const table = (fields) => {
    const body = rows(fields);
    if (!body.length) return 'None.';
    const varies = body.some((r) => r.present !== 'always');
    const line = (r) => `| \`${r.name}\` | ${cell(r.type)} |${varies ? ` ${r.present} |` : ''} ${cell(r.about)} |`;
    const head = varies
      ? ['| Field | Type | Present | |', '| --- | --- | --- | --- |']
      : ['| Field | Type | |', '| --- | --- | --- |'];
    return [...head, ...body.map(line)].join('\n');
  };

  return (fields) => {
    const sections = [table(fields)];
    for (let i = 0; i < objects.length; i++) {
      const r = objects[i];
      sections.push(`### ${r.name}\n\n${text(r.comment?.summary)}\n\n${table(r.children ?? [])}`);
    }
    return sections.join('\n\n');
  };
}

function page(event, order, example, version) {
  const data = tables()(fieldsOf(event.member.type));
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

${data.includes('| Present |') ? `${PRESENT}\n\n` : ''}${data}

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
  for (const [i, event] of events.entries()) {
    if (!(event.name in examples))
      throw new Error(`docs-events: no example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    const file = join(out, slugifyPath([GROUP, event.group]), `${event.name}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, page(event, i + 1, examples[event.name], version));
  }
  for (const group of new Set(events.map((e) => e.group))) {
    const lifecycle = join(out, slugifyPath([GROUP, group]), 'lifecycle.md');
    const text = await readFile(lifecycle, 'utf8').catch(() => undefined);
    const first = events.findIndex((e) => e.group === group) + 1;
    if (text) await writeFile(lifecycle, text.replace(/^---\n/, `---\norder: ${first - 0.5}\n`));
  }
  const overview = join(out, 'events.md');
  const staged = await readFile(overview, 'utf8');
  if (!staged.includes(MARKER)) throw new Error(`docs-events: ${MARKER} is missing from docs/guides/events.md`);
  await writeFile(overview, staged.replace(MARKER, index(events)));
  return events.length;
}

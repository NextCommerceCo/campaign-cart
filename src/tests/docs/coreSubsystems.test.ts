import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { CORE_SUBSYSTEMS } from '@/docs/content/core-subsystems';
import type { CoreSubsystem } from '@/docs/content/core-manifest';

/**
 * Structural checks on the core subsystem inventory — the denominator
 * `npm run docs:coverage` measures `src/core` against.
 *
 * The split here follows what the rest of the programme established: **structural drift
 * fails a test, content gaps are ratcheted by the coverage gate.** A subsystem pointing
 * at a file that no longer exists, or promising a reference page that was never
 * generated, is a broken document rather than a missing one — so it belongs here, not in
 * a baseline that can be frozen.
 *
 * Prose is deliberately not checked for quality, only for the traps a check can see:
 * the forbidden words, and the orphan case that published a phantom feature once before
 * (see the same check for features in `featureReference.test.ts`).
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CORE = join(SRC, 'core');
const GUIDE = join(CORE, 'guide');

/** Words `.claude/rules/documentation.md` §2 forbids — they tell the reader nothing. */
const FORBIDDEN = ['simple', 'easy', 'just', 'straightforward'];

/**
 * Matches a forbidden word used as prose, not as part of an identifier.
 *
 * A plain `\b` boundary treats a hyphen as a word break, so `simple-exit-intent` — a real
 * feature name that appears in generated cross-links — read as the word "simple" and
 * failed pages that had done nothing wrong. Excluding hyphen-adjacent matches keeps the
 * check pointed at prose, which is the only place the rule is about.
 */
const forbiddenWord = (word: string) =>
  new RegExp(`(?<![\\w-])${word}(?![\\w-])`, 'i');

/** Prose only: fenced blocks and inline code quote real source, which may say anything. */
const proseOf = (markdown: string) =>
  markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

/** Every `.ts` file a subsystem owns, so a claim can be checked against real code. */
function sourceFilesOf(subsystem: CoreSubsystem): string[] {
  const out: string[] = [];
  for (const entry of subsystem.sources) {
    const full = join(SRC, entry);
    if (!existsSync(full)) continue;
    if (statSync(full).isDirectory()) {
      const walk = (dir: string) => {
        for (const item of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, item.name);
          if (item.isDirectory()) walk(p);
          else if (item.name.endsWith('.ts') && !item.name.endsWith('.test.ts'))
            out.push(p);
        }
      };
      walk(full);
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('core subsystem inventory', () => {
  it('has subsystems', () => {
    expect(CORE_SUBSYSTEMS.length).toBeGreaterThan(0);
  });

  it('gives every subsystem a unique kebab-case id', () => {
    const ids = CORE_SUBSYSTEMS.map(s => s.id);
    expect(new Set(ids).size, `duplicate ids in ${ids.join(', ')}`).toBe(
      ids.length
    );
    expect(ids.filter(id => !/^[a-z][a-z0-9-]*$/.test(id))).toEqual([]);
  });

  /**
   * A subsystem that survives the deletion of its own code is the failure mode this
   * catches: the page keeps describing behaviour the SDK no longer has, and nothing
   * else in the toolchain would notice.
   */
  it('points only at sources that exist', () => {
    const missing = CORE_SUBSYSTEMS.flatMap(s =>
      s.sources
        .filter(entry => !existsSync(join(SRC, entry)))
        .map(entry => `${s.id} → ${entry}`)
    );
    expect(missing, 'declared in core-subsystems.ts but not on disk').toEqual(
      []
    );
  });

  it('claims at least one way an author reaches each subsystem', () => {
    const silent = CORE_SUBSYSTEMS.filter(
      s => s.howAuthorsReachIt.length === 0
    ).map(s => s.id);
    expect(
      silent,
      'a subsystem with no author surface cannot be documented for one'
    ).toEqual([]);
  });

  /**
   * A declared event must really be emitted by that subsystem's own code. The type
   * already guarantees it is a real `EventMap` key; this guarantees the *attribution* is
   * right, which is what a reader debugging "why does nothing fire" depends on.
   */
  it('emits every event it declares', () => {
    const wrong: string[] = [];
    for (const subsystem of CORE_SUBSYSTEMS) {
      if (!subsystem.emits?.length) continue;
      const corpus = sourceFilesOf(subsystem)
        .map(f => readFileSync(f, 'utf8'))
        .join('\n');
      for (const event of subsystem.emits) {
        if (!corpus.includes(`'${event}'`))
          wrong.push(`${subsystem.id} declares ${event}`);
      }
    }
    expect(
      wrong,
      "declared in emits[] but not emitted anywhere in the subsystem's sources"
    ).toEqual([]);
  });

  /**
   * The inventory links to generated reference pages instead of restating them
   * (`.claude/rules/documentation.md` §4). A link it promises and does not have is the
   * off-by-one class of bug that produced 19 broken cross-links in an earlier phase.
   */
  it('has every reference page it links to', () => {
    const missing = new Set<string>();
    for (const subsystem of CORE_SUBSYSTEMS) {
      for (const page of subsystem.reference ?? []) {
        if (!existsSync(join(GUIDE, 'reference', `${page}.md`)))
          missing.add(page);
      }
    }
    expect(
      [...missing].sort(),
      "promised by a subsystem's reference[] but not generated under src/core/guide/reference/"
    ).toEqual([]);
  });

  /**
   * The orphan case, which has already happened once to features: a stale guide folder
   * published as a phantom feature with no overview. A page under `subsystems/` that
   * matches no id is the same defect one layer down.
   */
  it('has no orphaned subsystem pages', () => {
    const dir = join(GUIDE, 'subsystems');
    if (!existsSync(dir)) return;
    const ids = new Set(CORE_SUBSYSTEMS.map(s => s.id));
    const orphans = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))
      .filter(id => !ids.has(id));
    expect(
      orphans,
      'a page under guide/subsystems/ that matches no subsystem id'
    ).toEqual([]);
  });

  it('uses none of the forbidden words in the inventory prose', () => {
    const offenders: string[] = [];
    for (const subsystem of CORE_SUBSYSTEMS) {
      const prose = proseOf(
        [subsystem.summary, ...(subsystem.cautions ?? [])].join(' ')
      );
      for (const word of FORBIDDEN) {
        if (forbiddenWord(word).test(prose))
          offenders.push(`${subsystem.id}: "${word}"`);
      }
    }
    expect(offenders, 'see .claude/rules/documentation.md §2').toEqual([]);
  });

  it('uses none of the forbidden words in the generated or written core pages', () => {
    const dir = GUIDE;
    if (!existsSync(dir)) return;
    const pages: string[] = [];
    const walk = (d: string) => {
      for (const item of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, item.name);
        if (item.isDirectory()) walk(p);
        else if (item.name.endsWith('.md')) pages.push(p);
      }
    };
    walk(dir);

    const offenders: string[] = [];
    for (const page of pages) {
      const prose = proseOf(readFileSync(page, 'utf8'));
      for (const word of FORBIDDEN) {
        if (forbiddenWord(word).test(prose)) {
          offenders.push(`${relative(SRC, page)}: "${word}"`);
        }
      }
    }
    expect(offenders, 'see .claude/rules/documentation.md §2').toEqual([]);
  });
});

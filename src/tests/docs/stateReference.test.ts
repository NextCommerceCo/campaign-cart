import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative } from 'node:path';
import type { StateManifest } from '@/core/docs/state-manifest';
import {
  renderStateReference,
  type FieldTypes,
} from '@/core/docs/render-state-reference';
import { extractStateFields } from './extract-state-fields';

/**
 * Generates each store's `guide/reference/state-reference.md` from its
 * `*.state-manifest.ts`, and fails when the committed markdown drifts.
 *
 * Regenerate:
 *   UPDATE_DOCS=1 npm run docs:reference
 *
 * The store equivalent of `featureReference.test.ts`. Same reason it is a test rather
 * than a script: the manifests load through Vite, so TypeScript and `@/` resolve with
 * no extra build step.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

const modules = import.meta.glob<{ default: StateManifest }>(
  '../../state/**/*.state-manifest.ts',
  { eager: true }
);

const stores = Object.entries(modules)
  .map(([path, mod]) => {
    const file = join(dirname(fileURLToPath(import.meta.url)), path);
    const manifest = mod.default;
    // A store either has its own folder (`state/cart/`) or sits flat in `state/`
    // as a single file (`state/order.state.ts`). Its guide goes in a folder named
    // after it either way, matching how flat features are handled.
    const dir = dirname(file);
    const ownFolder = basename(dir) === manifest.id;
    return {
      file,
      manifest,
      guideDir: join(ownFolder ? dir : join(dir, manifest.id), 'guide'),
    };
  })
  .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));

describe('state reference docs', () => {
  it('finds at least one store manifest', () => {
    expect(stores.length).toBeGreaterThan(0);
  });

  describe.each(stores)('$manifest.id', ({ file, manifest, guideDir }) => {
    const interfaceFile = join(SRC, manifest.interfaceFile);

    /**
     * Base interfaces live in the shared type homes, so they have to be searched too:
     * `AttributionState extends Attribution`, and `Attribution` is in `types/api.ts`.
     * Without these the inherited half of a schema — every `utm_*` tag — is invisible.
     */
    const SHARED_TYPES = ['types/api.ts', 'types/global.ts', 'types/campaign.ts'].map(
      f => join(SRC, f)
    );

    const fields = existsSync(interfaceFile)
      ? extractStateFields(interfaceFile, manifest.stateInterface, SHARED_TYPES)
      : [];

    it('points at an interface that exists', () => {
      expect(
        existsSync(interfaceFile),
        `${manifest.interfaceFile} is missing`
      ).toBe(true);
      expect(
        fields.length,
        `found no state fields on ${manifest.stateInterface} — check the interface name`
      ).toBeGreaterThan(0);
    });

    /**
     * The forward direction: a field added to the store must be documented. Without
     * this the schema table silently describes an older version of the store, which is
     * worse than having no table — a reader trusts it.
     */
    it('documents every field on the interface', () => {
      const documented = new Set(manifest.fields.map(f => f.name));
      const missing = fields
        .map(f => f.name)
        .filter(name => !documented.has(name));
      expect(
        missing,
        `on ${manifest.stateInterface} but not in ${basename(file)} — add them to fields[]`
      ).toEqual([]);
    });

    /** The reverse: a field removed from the store must leave the docs. */
    it('documents no field that has been removed', () => {
      const real = new Set(fields.map(f => f.name));
      const phantom = manifest.fields
        .map(f => f.name)
        .filter(name => !real.has(name));
      expect(
        phantom,
        `documented in ${basename(file)} but not on ${manifest.stateInterface}`
      ).toEqual([]);
    });

    it('describes every field it documents', () => {
      const undescribed = manifest.fields
        .filter(f => !f.description?.trim())
        .map(f => f.name);
      expect(undescribed, 'every field needs a business meaning').toEqual([]);
    });

    /**
     * A store that claims a persist key must actually use one. This catches the
     * mistake that prompted the whole exercise: `CLAUDE.md` said the campaign store
     * used `persist`, and it does not — it writes sessionStorage by hand.
     */
    it('describes its persistence the way the store implements it', () => {
      // Where the store is *created*, which is not always where its state type lives.
      const storeFile = join(SRC, manifest.storeFile ?? manifest.interfaceFile);
      const source = readFileSync(storeFile, 'utf8');
      const usesPersist = /\bpersist\s*\(/.test(source);
      // Storage keys are usually constants in `core/storage.ts` (`CART_STORAGE_KEY`),
      // so the literal is not in the store file — look in both.
      const keyHomes =
        source + readFileSync(join(SRC, 'core/storage.ts'), 'utf8');

      if (manifest.persistence.mechanism === 'zustand-persist') {
        expect(
          usesPersist,
          `${manifest.id} claims Zustand persist but ${manifest.storeFile ?? manifest.interfaceFile} never calls persist()`
        ).toBe(true);
        expect(
          manifest.persistence.key &&
            keyHomes.includes(manifest.persistence.key.replace(/_\{.*\}$/, '')),
          `the persist key ${manifest.persistence.key} appears neither in ${manifest.storeFile ?? manifest.interfaceFile} nor in core/storage.ts — check the value you documented`
        ).toBeTruthy();
      }

      if (manifest.persistence.mechanism === 'none') {
        expect(
          usesPersist,
          `${manifest.id} claims no persistence but ${manifest.storeFile ?? manifest.interfaceFile} calls persist()`
        ).toBe(false);
      }
    });

    it('state-reference.md matches the manifest', () => {
      const types: FieldTypes = Object.fromEntries(
        fields.map(f => [f.name, { type: f.type, nullable: f.nullable }])
      );
      const expected = renderStateReference(manifest, types);
      const refDir = join(guideDir, 'reference');
      const out = join(refDir, 'state-reference.md');
      if (UPDATE) {
        mkdirSync(refDir, { recursive: true });
        writeFileSync(out, expected);
      }
      expect(existsSync(out), `${relative(SRC, out)} is missing`).toBe(true);
      expect(readFileSync(out, 'utf8')).toBe(expected);
    });
  });
});

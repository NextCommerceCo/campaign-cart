import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { META_TAGS, META_TAG_GROUPS } from '@/docs/content/meta-tags';
import {
  URL_PARAMETERS,
  URL_PARAMETER_GROUPS,
} from '@/docs/content/url-parameters';
import {
  renderMetaTags,
  renderUrlParameters,
  type ContractUsage,
} from '@/docs/render/render-core-contracts';
import {
  extractCoreContracts,
  coreContractSources,
  isReadAccess,
  type ExtractedContract,
} from '@/docs/extract/extract-core-contracts';

/**
 * Generates `core/guide/reference/meta-tags.md` and `url-parameters.md`, and fails when
 * either the committed markdown or the hand-written declarations drift from the code.
 *
 * Regenerate:
 *   UPDATE_DOCS=1 npm run docs:reference
 *
 * The core equivalent of `featureReference.test.ts` and `stateReference.test.ts`, and a
 * test rather than a script for the same reason: the declarations load through Vite, so
 * TypeScript and `@/` resolve with no extra build step.
 *
 * Both directions are checked on both contracts, because both failure modes have already
 * happened elsewhere in these docs: a name added to the code and never documented leaves
 * a page that quietly describes an older SDK, and a name documented that nothing reads
 * sends a reader off to configure something that cannot work.
 */

const UPDATE = process.env.UPDATE_DOCS === '1';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../..');
const REFERENCE_DIR = join(SRC, 'core/guide/reference');

const extracted = extractCoreContracts(coreContractSources());

const usage = (contracts: ExtractedContract[]): ContractUsage[] =>
  contracts.map(c => ({ name: c.name, sites: c.sites }));

describe('core contract docs', () => {
  it('finds the meta tags and URL parameters in the source', () => {
    // A resolver that silently stops working would otherwise turn both "documents
    // everything" checks into no-ops that pass.
    expect(extracted.metaTags.length).toBeGreaterThan(20);
    expect(extracted.urlParameters.length).toBeGreaterThan(20);
  });

  describe('meta tags', () => {
    const documented = new Set(META_TAGS.map(t => t.name));

    it('documents every meta tag the code reads', () => {
      const missing = extracted.metaTags
        .map(t => t.name)
        .filter(name => !documented.has(name));
      expect(
        missing,
        'read by the SDK but absent from src/docs/content/meta-tags.ts — add them to META_TAGS'
      ).toEqual([]);
    });

    it('documents no meta tag the code has stopped reading', () => {
      const real = new Set(extracted.metaTags.map(t => t.name));
      const phantom = META_TAGS.map(t => t.name).filter(
        name => !real.has(name)
      );
      expect(
        phantom,
        'documented in META_TAGS but read nowhere in src/ — remove them, or the page tells a reader to configure something that cannot work'
      ).toEqual([]);
    });

    it('describes and exemplifies every tag it documents', () => {
      const undescribed = META_TAGS.filter(t => !t.description?.trim()).map(
        t => t.name
      );
      expect(undescribed, 'every tag needs a plain-language purpose').toEqual(
        []
      );

      const unexemplified = META_TAGS.filter(
        t => !t.example.includes(`name="${t.name}"`)
      ).map(t => t.name);
      expect(
        unexemplified,
        'every example must be a copy-paste-ready tag carrying its own name'
      ).toEqual([]);
    });

    it('files every tag under a known group', () => {
      const groups = new Set<string>(META_TAG_GROUPS);
      const stray = META_TAGS.filter(t => !groups.has(t.group)).map(
        t => `${t.name} → ${t.group}`
      );
      expect(
        stray,
        'a group missing from META_TAG_GROUPS never renders, so the tag vanishes from the page'
      ).toEqual([]);
    });

    it('names the current spelling for every legacy tag', () => {
      const dangling = META_TAGS.filter(
        t =>
          t.status === 'legacy' &&
          (!t.supersededBy || !documented.has(t.supersededBy))
      ).map(t => t.name);
      expect(
        dangling,
        'a legacy tag must point at a documented current tag, or a reader has no way forward'
      ).toEqual([]);
    });

    /**
     * The claim that makes `inert` worth having: `next-analytics-disable` is parsed into
     * `MetaTagController`'s config and the only method that reads that config,
     * `shouldBlockEvent()`, has no caller. If someone wires it up, this fails and the
     * tag has to be re-documented as working — which is the point.
     */
    it('keeps the inert analytics tags inert', () => {
      const inert = META_TAGS.filter(t => t.status === 'inert').map(
        t => t.name
      );
      if (!inert.includes('next-analytics-disable')) return;

      const sources = coreContractSources();
      const callers = sources.filter(
        ([name, text]) =>
          !name.endsWith('meta-tag-controller.ts') &&
          /\.shouldBlockEvent\s*\(/.test(text)
      );
      expect(
        callers.map(([name]) => name),
        'shouldBlockEvent() now has a caller, so next-analytics-disable / -enable-only may work — re-check them and drop their `inert` status'
      ).toEqual([]);
    });

    it('meta-tags.md matches the declarations', () => {
      const expected = renderMetaTags(usage(extracted.metaTags));
      const out = join(REFERENCE_DIR, 'meta-tags.md');
      if (UPDATE) {
        mkdirSync(REFERENCE_DIR, { recursive: true });
        writeFileSync(out, expected);
      }
      expect(existsSync(out), `${relative(SRC, out)} is missing`).toBe(true);
      expect(readFileSync(out, 'utf8')).toBe(expected);
    });
  });

  describe('url parameters', () => {
    const documented = new Set(URL_PARAMETERS.map(p => p.name));

    it('documents every URL parameter the code touches', () => {
      const missing = extracted.urlParameters
        .map(p => p.name)
        .filter(name => !documented.has(name));
      expect(
        missing,
        'read or written by the SDK but absent from src/docs/content/url-parameters.ts — add them to URL_PARAMETERS'
      ).toEqual([]);
    });

    it('documents no URL parameter the code has stopped touching', () => {
      const real = new Set(extracted.urlParameters.map(p => p.name));
      const phantom = URL_PARAMETERS.map(p => p.name).filter(
        name => !real.has(name)
      );
      expect(
        phantom,
        'documented in URL_PARAMETERS but touched nowhere in src/ — remove them rather than leaving a switch that does nothing'
      ).toEqual([]);
    });

    it('describes and exemplifies every parameter it documents', () => {
      const undescribed = URL_PARAMETERS.filter(
        p => !p.description?.trim()
      ).map(p => p.name);
      expect(
        undescribed,
        'every parameter needs a plain-language purpose'
      ).toEqual([]);

      const unexemplified = URL_PARAMETERS.filter(
        p => !p.example.includes(`${p.name}=`)
      ).map(p => p.name);
      expect(
        unexemplified,
        'every example must be a copy-paste-ready query fragment carrying its own name'
      ).toEqual([]);
    });

    it('files every parameter under a known group', () => {
      const groups = new Set<string>(URL_PARAMETER_GROUPS);
      const stray = URL_PARAMETERS.filter(p => !groups.has(p.group)).map(
        p => `${p.name} → ${p.group}`
      );
      expect(
        stray,
        'a group missing from URL_PARAMETER_GROUPS never renders, so the parameter vanishes from the page'
      ).toEqual([]);
    });

    /**
     * `direction` is the one field a reader acts on directly — it decides whether they
     * put the parameter on a link or wait for the SDK to add it — so it is checked
     * against how the code actually accesses the parameter rather than trusted.
     */
    it('describes each parameter the way the code accesses it', () => {
      const byName = new Map(extracted.urlParameters.map(p => [p.name, p]));

      const wrong = URL_PARAMETERS.flatMap(param => {
        const sites = byName.get(param.name)?.sites ?? [];
        const reads = sites.some(s => isReadAccess(s.access));
        const writes = sites.some(s => s.access && !isReadAccess(s.access));

        if (param.direction === 'read' && writes) {
          return [
            `${param.name}: declared read-only, but the SDK also writes it`,
          ];
        }
        if (param.direction === 'written' && reads) {
          return [
            `${param.name}: declared write-only, but the SDK also reads it`,
          ];
        }
        if (param.direction === 'read+written' && !(reads && writes)) {
          return [
            `${param.name}: declared read+written, but the code only ${reads ? 'reads' : 'writes'} it`,
          ];
        }
        return [];
      });

      expect(
        wrong,
        'fix the `direction` field — see the access column the extractor reports'
      ).toEqual([]);
    });

    /**
     * Every hazard has to carry its own warning, because the reader who needs it is the
     * one skimming a table, not the one reading the preamble.
     */
    it('warns on the row of every parameter that is unsafe in production', () => {
      const silent = URL_PARAMETERS.filter(
        p => p.productionHazard && !p.notes?.trim()
      ).map(p => p.name);
      expect(
        silent,
        'a productionHazard parameter needs `notes` saying what breaks and what to do instead'
      ).toEqual([]);
    });

    it('url-parameters.md matches the declarations', () => {
      const expected = renderUrlParameters(usage(extracted.urlParameters));
      const out = join(REFERENCE_DIR, 'url-parameters.md');
      if (UPDATE) {
        mkdirSync(REFERENCE_DIR, { recursive: true });
        writeFileSync(out, expected);
      }
      expect(existsSync(out), `${relative(SRC, out)} is missing`).toBe(true);
      expect(readFileSync(out, 'utf8')).toBe(expected);
    });
  });
});

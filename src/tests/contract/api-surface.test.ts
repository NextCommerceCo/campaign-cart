import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractInterfaceCallables,
  extractPublicMembers,
} from '@/docs/extract/extract-next-methods';

/**
 * `ApiClient` and `IApiClient` describe the same surface.
 *
 * `class ApiClient implements IApiClient` gets checked by the compiler, but only in one
 * direction: it proves the class has everything the interface declares. **The reverse is
 * invisible.** Add an endpoint to `ApiClient` and forget the interface, and nothing
 * complains — `type-check` passes, every test passes, and the new call is simply
 * unreachable from any feature that depends on the seam. Someone eventually re-imports
 * the concrete class "because the interface doesn't have it", and the seam quietly rots.
 *
 * That is the failure this test exists for, so it asserts both directions. It reads both
 * files with the same AST helpers the documentation generators use, rather than
 * reflecting over the prototype: TypeScript's `private` leaves no runtime trace, so a
 * prototype scan cannot tell a public endpoint from an internal helper and would demand
 * `request` and `getErrorType` be published.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CLIENT = join(SRC, 'api/client.ts');
const TYPES = join(SRC, 'api/client.types.ts');

/** Public instance methods of the class. Statics are not part of the seam. */
const classMethods = extractPublicMembers(CLIENT, 'ApiClient')
  .filter(m => !m.isStatic && m.kind === 'method')
  .map(m => m.name)
  .sort();

const interfaceMethods = extractInterfaceCallables(TYPES, 'IApiClient')
  .map(m => m.name)
  .sort();

describe('campaign API surface', () => {
  it('reads both sides, so an empty list cannot pass by accident', () => {
    // Without this, a rename that made either extractor return nothing would turn the
    // two comparisons below into `[] vs []` — green, and checking nothing at all.
    expect(classMethods.length).toBeGreaterThan(10);
    expect(interfaceMethods.length).toBeGreaterThan(10);
  });

  it('declares every public ApiClient method on IApiClient', () => {
    const missing = classMethods.filter(m => !interfaceMethods.includes(m));
    expect(
      missing,
      'public on ApiClient but absent from IApiClient (src/api/client.types.ts) — ' +
        'features that depend on the interface cannot call these, which is how the ' +
        'seam gets bypassed'
    ).toEqual([]);
  });

  it('declares nothing on IApiClient that ApiClient no longer has', () => {
    const phantom = interfaceMethods.filter(m => !classMethods.includes(m));
    expect(
      phantom,
      'declared on IApiClient but not a public method of ApiClient — a removed or ' +
        'renamed endpoint left behind in the interface'
    ).toEqual([]);
  });
});

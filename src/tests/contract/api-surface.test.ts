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
 * That is the failure this test exists for, so it asserts both directions — with one named
 * exemption (`NOT_ON_THE_SEAM`) for a credential mutator that features must not have, which
 * is itself asserted to still exist on the class.
 *
 * It reads both
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

/**
 * Public on the class, deliberately absent from the seam.
 *
 * `setApiKey` re-keys one client, and there is one client per page — so through the
 * interface it would let any holder change the credentials every other holder is already
 * using, including holders that cached the instance and will never re-fetch it. Changing
 * the key is `src/client.ts`'s job (`getApiClient(newKey)` builds a client for that key),
 * and `api-client-instance.test.ts` proves the composition root cannot be desynced by a
 * direct call to it.
 *
 * This is an exemption for a *credential mutator*, not for an endpoint. Every endpoint
 * still has to appear on both sides, and the assertion below keeps this list honest.
 */
const NOT_ON_THE_SEAM = ['setApiKey'];

describe('campaign API surface', () => {
  it('exempts only members that are really there', () => {
    // An exemption for a method the class no longer has would silently absolve a *later*
    // method of the same name — so the list has to describe reality, not history.
    const stale = NOT_ON_THE_SEAM.filter(m => !classMethods.includes(m));
    expect(
      stale,
      'exempted from IApiClient but no longer a public method of ApiClient — drop it ' +
        'from NOT_ON_THE_SEAM'
    ).toEqual([]);
  });

  it('keeps the exempted members off the interface', () => {
    // The exemption is a decision, not a tolerance: putting `setApiKey` back on the seam
    // would hand every holder of the shared client the ability to re-key it for all the
    // others, which is the drift `api-client-instance.test.ts` exists to prevent.
    const leaked = NOT_ON_THE_SEAM.filter(m => interfaceMethods.includes(m));
    expect(
      leaked,
      'declared on IApiClient despite being listed in NOT_ON_THE_SEAM — either remove it ' +
        'from the interface, or remove it from that list and say why it is safe on a ' +
        'page-wide shared client'
    ).toEqual([]);
  });

  it('reads both sides, so an empty list cannot pass by accident', () => {
    // Without this, a rename that made either extractor return nothing would turn the
    // two comparisons below into `[] vs []` — green, and checking nothing at all.
    expect(classMethods.length).toBeGreaterThan(10);
    expect(interfaceMethods.length).toBeGreaterThan(10);
  });

  it('declares every public ApiClient method on IApiClient', () => {
    const missing = classMethods.filter(
      m => !interfaceMethods.includes(m) && !NOT_ON_THE_SEAM.includes(m)
    );
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

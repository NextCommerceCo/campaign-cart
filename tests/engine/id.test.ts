import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from '../../src/engine/id';

const UUID4_HEX = /^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/;

afterEach(() => vi.unstubAllGlobals());

describe('newId', () => {
  it('is a UUID v4 as 32 hex digits, also where randomUUID is missing (plain http)', () => {
    const ids = new Set(Array.from({ length: 50 }, newId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID4_HEX);
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect(newId()).toMatch(UUID4_HEX);
  });
});

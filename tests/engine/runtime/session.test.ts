import { describe, expect, it } from 'vitest';
import { type Cookies, campaignSession } from '../../../src/engine/runtime/session';
import { MemoryStorage } from '../../fixtures/storage';

const SERVER = '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d';
const jar = (initial: Record<string, string> = {}): Cookies & { values: Record<string, string> } => {
  const values = { ...initial };
  return { values, get: (name) => values[name], set: (name, value) => void (values[name] = value) };
};

describe('campaign session', () => {
  it('keeps the id the NEXT script or the server already gave, and follows it when it changes', () => {
    const cookies = jar({ ncsid: SERVER });
    const sessionId = campaignSession(cookies, new MemoryStorage());
    expect(sessionId()).toBe(SERVER);
    cookies.values.ncsid = 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d';
    expect(sessionId()).toBe('a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d');
  });

  it('makes one UUID v4 hex id when there is none or it is not one, and keeps it like the NEXT script', () => {
    const cookies = jar({ ncsid: 'not-a-session' });
    const local = new MemoryStorage();
    const sessionId = campaignSession(cookies, local);
    const id = sessionId();
    expect(id).toMatch(/^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/);
    expect(sessionId()).toBe(id);
    expect(cookies.values.ncsid).toBe(id);
    expect(local.getItem('ncsid')).toBe(id);
  });

  it('keeps the id for the page when cookies and storage are blocked', () => {
    const blocked: Cookies = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('blocked');
      },
    };
    const sessionId = campaignSession(blocked, new MemoryStorage('always'));
    expect(sessionId()).toBe(sessionId());
  });
});

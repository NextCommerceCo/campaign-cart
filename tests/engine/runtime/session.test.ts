import { beforeEach, describe, expect, it } from 'vitest';
import { type Cookies, campaignSession } from '../../../src/engine/runtime/session';
import { MemoryStorage } from '../../fixtures/storage';

const SERVER = '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d';
const jar = (initial: Record<string, string> = {}): Cookies & { values: Record<string, string> } => {
  const values = { ...initial };
  return { values, get: (name) => values[name], set: (name, value) => void (values[name] = value) };
};

let clock = 0;
const now = () => clock;

describe('campaign session', () => {
  beforeEach(() => {
    clock = 1_700_000_000_000;
  });

  it('keeps the id the NEXT script or the server already gave, and follows it when it changes', () => {
    const cookies = jar({ ncsid: SERVER });
    const sessionId = campaignSession(cookies, new MemoryStorage(), 'a', now);
    expect(sessionId()).toBe(SERVER);
    cookies.values.ncsid = 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d';
    expect(sessionId()).toBe('a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d');
  });

  it('makes one UUID v4 hex id when there is none or it is not one, and keeps it like the NEXT script', () => {
    const cookies = jar({ ncsid: 'not-a-session' });
    const local = new MemoryStorage();
    const sessionId = campaignSession(cookies, local, 'a', now);
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
    const sessionId = campaignSession(blocked, new MemoryStorage('always'), 'a', now);
    expect(sessionId()).toBe(sessionId());
  });

  it('gives each campaign of a domain its own id, and a campaign its id back', () => {
    const cookies = jar();
    const local = new MemoryStorage();
    const a = campaignSession(cookies, local, 'a', now)();
    const b = campaignSession(cookies, local, 'b', now)();
    expect(b).not.toBe(a);
    expect(cookies.values.ncsid).toBe(b);
    expect(campaignSession(cookies, local, 'a', now)()).toBe(a);
    expect(cookies.values.ncsid).toBe(a);
    expect(local.getItem('ncsid')).toBe(a);
  });

  it('keeps an id no campaign has taken, and the one the server changes it to', () => {
    const cookies = jar({ ncsid: SERVER });
    const local = new MemoryStorage();
    const sessionId = campaignSession(cookies, local, 'a', now);
    expect(sessionId()).toBe(SERVER);
    const rotated = 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d';
    cookies.values.ncsid = rotated;
    expect(sessionId()).toBe(rotated);
    expect(campaignSession(cookies, local, 'b', now)()).not.toBe(rotated);
    expect(campaignSession(cookies, local, 'a', now)()).toBe(rotated);
  });

  it('puts its id back when another campaign writes its own in another tab', () => {
    const cookies = jar();
    const local = new MemoryStorage();
    const sessionA = campaignSession(cookies, local, 'a', now);
    const a = sessionA();
    campaignSession(cookies, local, 'b', now)();
    expect(sessionA()).toBe(a);
    expect(cookies.values.ncsid).toBe(a);
  });

  it('keeps its id while it is used, and starts a new one after an hour unused', () => {
    const cookies = jar();
    const local = new MemoryStorage();
    const sessionId = campaignSession(cookies, local, 'a', now);
    const first = sessionId();
    for (let used = 0; used < 30; used++) {
      clock += 59 * 60_000;
      expect(sessionId()).toBe(first);
    }
    clock += 60 * 60_000;
    const second = sessionId();
    expect(second).not.toBe(first);
    expect(cookies.values.ncsid).toBe(second);
    expect(local.getItem('ncsid')).toBe(second);
    expect(campaignSession(cookies, local, 'a', now)()).toBe(second);
  });
});

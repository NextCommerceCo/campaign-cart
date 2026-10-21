import { Engine } from '../../src/engine/engine';
import type { Visit } from '../../src/engine/attribution';
import type { Campaign } from '../../src/engine/types';
import { fakeApi } from './api';
import { campaign } from './campaign';
import { MemoryStorage } from './storage';

export interface MakeEngine {
  local?: Storage;
  session?: Storage;
  fetch?: typeof fetch;
  campaign?: Promise<Campaign>;
  params?: Record<string, string>;
  visit?: Visit;
  now?: () => number;
  reset?: boolean;
}

export function makeEngine(opts: MakeEngine = {}) {
  const api = fakeApi();
  const local = opts.local ?? new MemoryStorage();
  const session = opts.session ?? new MemoryStorage();
  const engine = new Engine({
    apiKey: 'pk_test',
    apiBase: 'https://api.test',
    send: opts.fetch ?? api.fetch,
    campaign: opts.campaign ?? Promise.resolve(campaign),
    storagePrefix: 'next:test',
    storage: { local, session },
    params: opts.params,
    visit: opts.visit,
    now: opts.now,
    reset: opts.reset,
  });
  return { engine, api, local, session };
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

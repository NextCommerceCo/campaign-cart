import { StorageAdapter } from './storage';

/** `window.nextConfig`, as the page sets it. */
export type PageConfig = Record<string, unknown>;

/** Keys the loader reads before boot: the debug panel never tries them. */
export const LOADER_KEYS = ['apiKey', 'funnel'] as const;

/**
 * The nextConfig the debug panel tries on this tab (Page config → Try on this tab), saved with
 * the panel under `next:debug`; only while debug mode is on.
 */
export function triedConfig(session: Storage | null, debug: boolean | undefined): PageConfig | undefined {
  if (debug === false || !session) return undefined;
  const store = new StorageAdapter({ prefix: 'next', version: 1, backends: [session] });
  if (!debug && store.get<boolean>('debugging') !== true) return undefined;
  return store.get<{ config?: PageConfig }>('debug')?.config;
}

/** The page's nextConfig with the tried one over it; the loader's keys stay the page's. */
export function withTried(page: PageConfig, tried: PageConfig): PageConfig {
  const merged: PageConfig = { ...page, ...tried };
  for (const key of LOADER_KEYS) {
    if (key in page) merged[key] = page[key];
    else delete merged[key];
  }
  return merged;
}

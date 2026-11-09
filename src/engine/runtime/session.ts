import { newId } from './id';

export interface Cookies {
  get(name: string): string | undefined;
  set(name: string, value: string, days: number): void;
}

// `ncsid` is where the NEXT analytics script keeps the campaign session, so both send the same id.
const KEY = 'ncsid';
const DAYS = 30;
const UUID4_HEX = /^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/;

const attempt = <T>(read: () => T): T | undefined => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

export function campaignSession(cookies: Cookies | undefined, local: Storage | null): () => string {
  let memory: string | undefined;
  return () => {
    const kept = [attempt(() => cookies?.get(KEY)), attempt(() => local?.getItem(KEY)), memory].find(
      (id): id is string => !!id && UUID4_HEX.test(id),
    );
    if (kept) return kept;
    const id = (memory = newId());
    attempt(() => cookies?.set(KEY, id, DAYS));
    attempt(() => local?.setItem(KEY, id));
    return id;
  };
}

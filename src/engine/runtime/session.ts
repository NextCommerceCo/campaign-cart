import { newId } from './id';

export interface Cookies {
  get(name: string): string | undefined;
  set(name: string, value: string, days: number): void;
}

// `ncsid` is where the NEXT analytics script keeps the campaign session, so both send the same id.
const KEY = 'ncsid';
// One domain has one `ncsid`; each campaign's own id is kept beside it and put back when its page opens.
const OWN = 'ncsid__';
const DAYS = 30;
const UUID4_HEX = /^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/;

const attempt = <T>(read: () => T): T | undefined => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

const valid = (id: string | null | undefined): id is string => !!id && UUID4_HEX.test(id);

export function campaignSession(cookies: Cookies | undefined, local: Storage | null, campaign: string): () => string {
  const own = OWN + campaign;
  let memory: string | undefined;
  const ofAnotherCampaign = (id: string) =>
    !!attempt(() => {
      for (let i = 0; i < (local?.length ?? 0); i++) {
        const key = local!.key(i);
        if (key?.startsWith(OWN) && key !== own && local!.getItem(key) === id) return true;
      }
      return false;
    });
  const remember = (id: string) => {
    memory = id;
    attempt(() => local?.setItem(own, id));
    return id;
  };
  return () => {
    const shared = [attempt(() => cookies?.get(KEY)), attempt(() => local?.getItem(KEY))].find(valid);
    const mine = [attempt(() => local?.getItem(own)), memory].find(valid);
    if (shared && shared === mine) return shared;
    if (shared && !ofAnotherCampaign(shared)) return remember(shared);
    const id = remember(mine ?? newId());
    attempt(() => cookies?.set(KEY, id, DAYS));
    attempt(() => local?.setItem(KEY, id));
    return id;
  };
}

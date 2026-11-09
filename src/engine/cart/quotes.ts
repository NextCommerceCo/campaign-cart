import type { Api } from '../runtime/api';
import type { Context } from '../engine';
import type { keyedLatestWins } from '../runtime/flow';
import { hash } from '../visit/scope';
import type { Campaign } from '../types';
import type { CartSummary } from './types';

const QUOTES = 'quotes';
const QUOTE_MAX_AGE = 10 * 60 * 1000;
const QUOTE_LIMIT = 32;

export type QuoteBody = Parameters<Api['calculate']>[0];
type Run = ReturnType<ReturnType<typeof keyedLatestWins>['start']>;
type Saved = Record<string, { at: number; summary: CartSummary }>;
interface Pending {
  promise: Promise<CartSummary>;
  controller: AbortController;
  waiting: number;
}

export function createQuotes(ctx: Context) {
  const fetched: Saved = {};
  const pending = new Map<string, Pending>();
  let version: { campaign: Campaign; hash: string } | undefined;

  const campaignVersion = () => {
    const campaign = ctx.getState().campaign;
    if (!campaign) return undefined;
    if (version?.campaign !== campaign) version = { campaign, hash: hash(JSON.stringify(campaign)) };
    return version.hash;
  };

  const key = (body: QuoteBody, upsell = false) =>
    JSON.stringify([{ ...body, vouchers: [...new Set(body.vouchers)].sort() }, upsell, campaignVersion()]);

  const alive = (q: Saved[string] | undefined, now = ctx.now()) => (q && now - q.at < QUOTE_MAX_AGE ? q : undefined);

  const fresh = (body: QuoteBody, upsell?: boolean) => alive(fetched[key(body, upsell)])?.summary;

  const stored = (body: QuoteBody, upsell?: boolean) => {
    const k = key(body, upsell);
    return (alive(fetched[k]) ?? alive(ctx.local.get<Saved>(QUOTES)?.[k]))?.summary;
  };

  const save = (k: string, summary: CartSummary) => {
    const at = ctx.now();
    fetched[k] = { at, summary };
    const newest = Object.entries({ ...ctx.local.get<Saved>(QUOTES), [k]: fetched[k] })
      .filter(([, q]) => alive(q, at))
      .sort(([, a], [, b]) => b.at - a.at);
    ctx.local.set(QUOTES, Object.fromEntries(newest.slice(0, QUOTE_LIMIT)));
  };

  const request = (k: string, body: QuoteBody, upsell: boolean): Pending => {
    const controller = new AbortController();
    const entry: Pending = {
      controller,
      waiting: 0,
      promise: ctx.api
        .calculate(body, { signal: controller.signal, upsell })
        .then((summary) => {
          save(k, summary);
          return summary;
        })
        .finally(() => {
          if (pending.get(k) === entry) pending.delete(k);
        }),
    };
    entry.promise.catch(() => undefined);
    pending.set(k, entry);
    return entry;
  };

  const calculate = (
    body: QuoteBody,
    { signal, upsell = false }: { signal?: AbortSignal; upsell?: boolean } = {},
  ): Promise<CartSummary> => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const k = key(body, upsell);
    const known = alive(fetched[k]);
    if (known) return Promise.resolve(known.summary);
    const entry = pending.get(k) ?? request(k, body, upsell);
    entry.waiting++;
    if (!signal) return entry.promise;
    return new Promise((resolve, reject) => {
      const abort = () => {
        reject(signal.reason);
        if (--entry.waiting) return;
        pending.delete(k);
        entry.controller.abort(signal.reason);
      };
      signal.addEventListener('abort', abort, { once: true });
      entry.promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  };

  /**
   * One price run of a selector's or a toggle's `bodies`: stored prices settle at once and, when fresh, end the run;
   * otherwise the unchecked ones are calculated, after `pricing` when nothing was stored. Latest wins.
   */
  const reprice = async (
    run: Run,
    bodies: QuoteBody[],
    upsell: boolean,
    settle: () => void,
    pricing: () => void,
    failed: (err: unknown) => void,
  ): Promise<void> => {
    const known = bodies.every((body) => stored(body, upsell));
    const unchecked = bodies.filter((body) => !fresh(body, upsell));
    if (known) settle();
    if (!unchecked.length) {
      run.finish();
      return run.dropPrevious();
    }
    const request = Promise.all(unchecked.map((body) => calculate(body, { signal: run.signal, upsell })));
    run.dropPrevious();
    if (!known) pricing();
    try {
      await request;
      if (!run.stale()) settle();
    } catch (err) {
      if (!run.stale()) failed(err);
    } finally {
      run.finish();
    }
  };

  return { key, fresh, stored, calculate, campaignVersion, reprice };
}

export type Quotes = ReturnType<typeof createQuotes>;

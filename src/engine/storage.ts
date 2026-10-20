export type Tier = 'local' | 'session';

interface Envelope<T> {
  v: number;
  t: number;
  d: T;
}

export interface StorageOptions {
  prefix: string;
  version: number;
  local?: globalThis.Storage | null;
  session?: globalThis.Storage | null;
  now?: () => number;
  onDegrade?: (tier: Tier, reason: string) => void;
}

function probe(store: globalThis.Storage | null | undefined): globalThis.Storage | null {
  if (!store) return null;
  try {
    const key = '__next_probe__';
    store.setItem(key, '1');
    const ok = store.getItem(key) === '1';
    store.removeItem(key);
    return ok ? store : null;
  } catch {
    return null;
  }
}

export class StorageAdapter {
  private memory = new Map<string, Envelope<unknown>>();
  private tiers: Record<Tier, globalThis.Storage | null>;
  private now: () => number;

  constructor(private options: StorageOptions) {
    this.now = options.now ?? Date.now;
    this.tiers = { local: probe(options.local), session: probe(options.session) };
    for (const tier of ['local', 'session'] as const) {
      if (options[tier] !== undefined && !this.tiers[tier]) options.onDegrade?.(tier, 'unavailable');
    }
  }

  get available(): Record<Tier, boolean> {
    return { local: !!this.tiers.local, session: !!this.tiers.session };
  }

  private key(name: string): string {
    return `${this.options.prefix}:${name}`;
  }

  get<T>(name: string, tier: Tier, maxAgeMs?: number): T | undefined {
    const key = this.key(name);
    let env = this.memory.get(key) as Envelope<T> | undefined;
    if (!env) {
      const raw = this.read(tier, key);
      if (raw) {
        try {
          env = JSON.parse(raw) as Envelope<T>;
        } catch {
          env = undefined;
        }
      }
    }
    if (!env || env.v !== this.options.version) return undefined;
    if (maxAgeMs !== undefined && this.now() - env.t > maxAgeMs) return undefined;
    this.memory.set(key, env);
    return env.d;
  }

  set<T>(name: string, value: T, tier: Tier): void {
    const key = this.key(name);
    const env: Envelope<T> = { v: this.options.version, t: this.now(), d: value };
    this.memory.set(key, env);
    this.write(tier, key, JSON.stringify(env));
  }

  remove(name: string): void {
    const key = this.key(name);
    this.memory.delete(key);
    for (const store of Object.values(this.tiers)) {
      try {
        store?.removeItem(key);
      } catch {}
    }
  }

  clear(): void {
    this.memory.clear();
    for (const store of Object.values(this.tiers)) {
      if (!store) continue;
      try {
        const doomed: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k?.startsWith(`${this.options.prefix}:`)) doomed.push(k);
        }
        doomed.forEach((k) => store.removeItem(k));
      } catch {}
    }
  }

  private read(tier: Tier, key: string): string | null {
    try {
      return this.tiers[tier]?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(tier: Tier, key: string, raw: string): void {
    const order: Tier[] = tier === 'local' ? ['local', 'session'] : ['session'];
    for (const t of order) {
      const store = this.tiers[t];
      if (!store) continue;
      try {
        store.setItem(key, raw);
        return;
      } catch (err) {
        this.options.onDegrade?.(t, err instanceof Error ? err.name : 'write failed');
      }
    }
  }
}

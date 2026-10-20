interface Envelope<T> {
  v: number;
  t: number;
  d: T;
}

export interface StorageOptions {
  prefix: string;
  version: number;
  backends: Array<globalThis.Storage | null | undefined>;
  now?: () => number;
  onDegrade?: (reason: string) => void;
}

function usable(store: globalThis.Storage | null | undefined): store is globalThis.Storage {
  if (!store) return false;
  try {
    store.setItem('__next_probe__', '1');
    store.removeItem('__next_probe__');
    return true;
  } catch {
    return false;
  }
}

export class StorageAdapter {
  private memory = new Map<string, Envelope<unknown>>();
  private backends: globalThis.Storage[];
  private now: () => number;

  constructor(private options: StorageOptions) {
    this.now = options.now ?? Date.now;
    this.backends = options.backends.filter(usable);
    if (this.backends.length < options.backends.length) options.onDegrade?.('unavailable');
  }

  get<T>(name: string, maxAgeMs?: number): T | undefined {
    const key = this.key(name);
    const env = (this.memory.get(key) ?? this.read(key)) as Envelope<T> | undefined;
    if (!env || env.v !== this.options.version) return undefined;
    if (maxAgeMs !== undefined && this.now() - env.t > maxAgeMs) return undefined;
    this.memory.set(key, env);
    return env.d;
  }

  set<T>(name: string, value: T): void {
    const key = this.key(name);
    const env: Envelope<T> = { v: this.options.version, t: this.now(), d: value };
    this.memory.set(key, env);
    const raw = JSON.stringify(env);
    for (const store of this.backends) {
      try {
        store.setItem(key, raw);
        return;
      } catch (err) {
        this.options.onDegrade?.(err instanceof Error ? err.name : 'write failed');
      }
    }
  }

  clear(): void {
    this.memory.clear();
    for (const store of this.backends) {
      try {
        const keys = Array.from({ length: store.length }, (_, i) => store.key(i));
        keys.filter((k) => k?.startsWith(`${this.options.prefix}:`)).forEach((k) => store.removeItem(k!));
      } catch {}
    }
  }

  private key(name: string): string {
    return `${this.options.prefix}:${name}`;
  }

  private read(key: string): Envelope<unknown> | undefined {
    for (const store of this.backends) {
      try {
        const raw = store.getItem(key);
        if (raw) return JSON.parse(raw) as Envelope<unknown>;
      } catch {}
    }
    return undefined;
  }
}

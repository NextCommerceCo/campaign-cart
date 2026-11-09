export class MemoryStorage implements Storage {
  data = new Map<string, string>();
  constructor(public failWrites: 'never' | 'always' | 'after-probe' = 'never') {}
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    const probe = k === '__next_probe__';
    if (this.failWrites === 'always' || (this.failWrites === 'after-probe' && !probe)) {
      throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    }
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

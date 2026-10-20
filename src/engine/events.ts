import type { EventMap, EventName } from './types';

export interface EngineEvent<K extends EventName = EventName> {
  name: K;
  data: EventMap[K];
  at: number;
}

type Listener = (event: EngineEvent) => void;

const BUFFER_SIZE = 100;

export class Events {
  private listeners = new Map<string, Set<Listener>>();
  private buffer: EngineEvent[] = [];

  emit<K extends EventName>(name: K, data: EventMap[K]): void {
    const event: EngineEvent = { name, data, at: Date.now() };
    this.buffer.push(event);
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();
    for (const key of [name, '*']) {
      this.listeners.get(key)?.forEach((fn) => {
        try {
          fn(event);
        } catch (err) {
          console.error('[next] subscriber failed on', name, err);
        }
      });
    }
  }

  on(name: EventName | '*', fn: Listener, options: { replay?: boolean } = {}): () => void {
    if (options.replay) {
      for (const event of this.buffer) if (name === '*' || event.name === name) fn(event);
    }
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }

  history(): readonly EngineEvent[] {
    return this.buffer;
  }
}

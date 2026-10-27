import type { Logger } from './log';
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
  private queue: EngineEvent[] = [];
  private emitting = false;

  constructor(private log: Logger) {}

  emit<K extends EventName>(name: K, data: EventMap[K]): void {
    const event: EngineEvent = { name, data, at: Date.now() };
    this.buffer.push(event);
    if (this.buffer.length > BUFFER_SIZE)
      this.buffer.splice(
        this.buffer.findIndex((e) => e.name !== 'ready'),
        1,
      );
    this.queue.push(event);
    if (this.emitting) return;
    this.emitting = true;
    try {
      for (let next = this.queue.shift(); next; next = this.queue.shift()) {
        const current = next;
        for (const key of [current.name, '*'])
          [...(this.listeners.get(key) ?? [])].forEach((fn) => this.deliver(fn, current));
      }
    } finally {
      this.emitting = false;
    }
  }

  on<K extends EventName>(
    name: K | '*',
    fn: (event: EngineEvent<K>) => void,
    options: { replay?: boolean } = {},
  ): () => void {
    const listener = fn as Listener;
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(listener);
    if (options.replay)
      this.buffer.filter((e) => name === '*' || e.name === name).forEach((e) => this.deliver(listener, e));
    return () => set.delete(listener);
  }

  private deliver(fn: Listener, event: EngineEvent): void {
    try {
      fn(event);
    } catch (err) {
      this.log.error(`subscriber failed on ${event.name}`, err);
    }
  }
}

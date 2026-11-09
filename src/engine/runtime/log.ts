export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogEntry {
  level: Exclude<LogLevel, 'silent'>;
  message: string;
  data?: unknown;
  at: number;
}

const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
const BUFFER_SIZE = 200;

export class Logger {
  private buffer: LogEntry[] = [];
  private listeners = new Set<(entry: LogEntry) => void>();

  constructor(
    public level: LogLevel = 'warn',
    private now: () => number = Date.now,
  ) {}

  debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.write('error', message, data);
  }

  entries(): LogEntry[] {
    return [...this.buffer];
  }

  stream(fn: (entry: LogEntry) => void, options: { replay?: boolean } = {}): () => void {
    this.listeners.add(fn);
    if (options.replay) this.buffer.forEach((entry) => deliver(fn, entry));
    return () => this.listeners.delete(fn);
  }

  private write(level: LogEntry['level'], message: string, data: unknown): void {
    const entry: LogEntry = { level, message, at: this.now(), ...(data !== undefined && { data }) };
    this.buffer.push(entry);
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();
    if (RANK[level] >= RANK[this.level]) console[level](`[next] ${message}`, ...(data !== undefined ? [data] : []));
    [...this.listeners].forEach((fn) => deliver(fn, entry));
  }
}

function deliver(fn: (entry: LogEntry) => void, entry: LogEntry): void {
  try {
    fn(entry);
  } catch {
    // a failing log listener must not log again, or it would loop
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { type LogEntry, Logger } from '../../src/engine/log';

afterEach(() => vi.restoreAllMocks());

describe('Logger', () => {
  it('prints at or above its level and keeps every entry', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = new Logger('warn', () => 7);
    log.debug('hidden');
    log.warn('shown', { id: 1 });
    expect(debug).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[next] shown', { id: 1 });
    expect(log.entries()).toEqual([
      { level: 'debug', message: 'hidden', at: 7 },
      { level: 'warn', message: 'shown', data: { id: 1 }, at: 7 },
    ]);
  });

  it('changes what it prints when the level changes, and prints nothing when silent', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = new Logger();
    log.level = 'debug';
    log.debug('now shown');
    log.level = 'silent';
    log.error('still recorded');
    expect(debug).toHaveBeenCalledWith('[next] now shown');
    expect(error).not.toHaveBeenCalled();
    expect(log.entries().map((e) => e.message)).toEqual(['now shown', 'still recorded']);
  });

  it('keeps the last 200 entries', () => {
    const log = new Logger('silent');
    for (let i = 0; i < 205; i++) log.info(`m${i}`);
    expect(log.entries()).toHaveLength(200);
    expect(log.entries()[0]!.message).toBe('m5');
  });

  it('streams new entries, replays earlier ones on request, and stops after unsubscribe', () => {
    const log = new Logger('silent');
    log.info('before');
    const seen: string[] = [];
    const stop = log.stream((e) => seen.push(e.message), { replay: true });
    log.warn('during');
    stop();
    log.warn('after');
    expect(seen).toEqual(['before', 'during']);
  });

  it('survives a throwing stream listener without logging it again', () => {
    const log = new Logger('silent');
    const seen: LogEntry[] = [];
    log.stream(() => {
      throw new Error('boom');
    });
    log.stream((e) => seen.push(e));
    log.info('one');
    expect(seen.map((e) => e.message)).toEqual(['one']);
    expect(log.entries()).toHaveLength(1);
  });
});

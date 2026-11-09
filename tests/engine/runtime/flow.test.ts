import { describe, expect, it } from 'vitest';
import { latestWins, serialize } from '../../../src/engine/runtime/flow';

describe('latestWins', () => {
  it('makes every earlier run stale and aborts its signal', () => {
    const latest = latestWins();
    const first = latest.start();
    const second = latest.start();
    expect(first.stale()).toBe(true);
    expect(first.signal.aborted).toBe(true);
    expect(second.stale()).toBe(false);
    expect(latest.current()).toBe(second.run);
  });

  it('cancels the running one without starting another', () => {
    const latest = latestWins();
    const run = latest.start();
    latest.cancel();
    expect(run.stale()).toBe(true);
    expect(run.signal.aborted).toBe(true);
  });
});

describe('serialize', () => {
  it('starts each task once the one before has settled, even when it failed', async () => {
    const inTurn = serialize();
    const order: string[] = [];
    let release!: () => void;
    const first = inTurn(
      () =>
        new Promise<void>((done) => {
          order.push('first started');
          release = () => done();
        }),
    );
    const failing = inTurn(async () => {
      order.push('failing started');
      throw new Error('no');
    });
    const last = inTurn(async () => {
      order.push('last started');
      return 'done';
    });
    await Promise.resolve();
    expect(order).toEqual(['first started']);
    release();
    await first;
    await expect(failing).rejects.toThrow('no');
    await expect(last).resolves.toBe('done');
    expect(order).toEqual(['first started', 'failing started', 'last started']);
  });
});

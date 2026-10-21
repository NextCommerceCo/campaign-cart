import { describe, expect, it } from 'vitest';
import { format, resolve } from '../../src/engine/values';
import { makeEngine } from '../fixtures/engine';

describe('display values', () => {
  it('formats by type in the campaign currency', async () => {
    const { engine } = makeEngine();
    await engine.load();
    await engine.addItem(2);
    expect(format(resolve(engine, 'cart.total')!, 'USD', 'en')).toBe('$89.00');
    expect(format(resolve(engine, 'cart.savingsPercentage')!, 'USD', 'en')).toBe('55%');
    expect(format(resolve(engine, 'package.2.savingsPercentage')!, 'USD', 'en')).toBe('55%');
    expect(format(resolve(engine, 'package.price', { packageId: 1 })!, 'USD', 'en')).toBe('$49.00');
    expect(resolve(engine, 'shipping.isFree')).toEqual({ type: 'bool', value: true });
    expect(resolve(engine, 'campaign.name')).toEqual({ type: 'text', value: 'Olympus' });
  });

  it('shows the local dollar sign, not CA$ or A$', () => {
    expect(format({ type: 'money', value: 10 }, 'CAD', 'en')).toBe('$10.00');
    expect(format({ type: 'money', value: 10 }, 'AUD', 'en')).toBe('$10.00');
  });

  it('knows a path from a typo', () => {
    const { engine } = makeEngine();
    expect(resolve(engine, 'cart.totl')).toBeUndefined();
    expect(resolve(engine, 'cart.total')).toEqual({ type: 'money', value: undefined });
  });
});

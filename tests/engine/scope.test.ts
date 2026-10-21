import { describe, expect, it } from 'vitest';
import { funnelFromPath, storageScope } from '../../src/engine/scope';

describe('storage scope', () => {
  it('keeps a funnel together at any depth and separates top folders', () => {
    expect(funnelFromPath('/helloweenA/landing')).toBe('helloweena');
    expect(funnelFromPath('/helloweenA/checkout/step2')).toBe('helloweena');
    expect(funnelFromPath('/sleep/')).toBe('sleep');
    expect(funnelFromPath('/landing')).toBe('');
    expect(funnelFromPath('/presell.html')).toBe('');
  });

  it('gives two funnels on one key different scopes', () => {
    expect(storageScope('pk_1', 'helloweena')).not.toBe(storageScope('pk_1', 'helloweenb'));
    expect(storageScope('pk_1', 'a')).toBe(storageScope('pk_1', 'a'));
    expect(storageScope('pk_x', 'hu')).not.toBe(storageScope('pk_xhu', ''));
  });
});

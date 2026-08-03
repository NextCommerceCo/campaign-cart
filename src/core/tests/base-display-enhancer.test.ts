/**
 * `BaseDisplayEnhancer` is the base class of every display enhancer, so anything it
 * registers on `document` is registered once per element carrying a
 * `data-next-display` attribute. `setupCurrencyChangeListener()` used to register an
 * inline arrow on `document` with no teardown path at all: the listener could not be
 * removed even deliberately, and a re-enhance added another one on top of every
 * listener the previous pass had left behind (finding 149 in `docs/code-findings.md`).
 *
 * These tests pin both halves of the fix — the listener still drives a re-render
 * while the enhancer is alive, and it is gone once `destroy()` has run.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDisplayEnhancer } from '@/core/base/base-display-enhancer';

/**
 * Minimal concrete display enhancer: no store, one value the test controls, and a
 * record of every string written to the element so a re-render is countable.
 */
class ProbeDisplayEnhancer extends BaseDisplayEnhancer {
  public readonly rendered: string[] = [];
  public value: unknown = 12.5;

  protected setupStoreSubscriptions(): void {
    // No store — the currency listener is the only thing driving updates here.
  }

  protected getPropertyValue(): unknown {
    return this.value;
  }

  protected override updateElementContent(value: string): void {
    this.rendered.push(value);
    super.updateElementContent(value);
  }
}

function createProbe(displayPath = 'package.price'): ProbeDisplayEnhancer {
  const element = document.createElement('div');
  element.setAttribute('data-next-display', displayPath);
  document.body.appendChild(element);
  return new ProbeDisplayEnhancer(element);
}

const fireCurrencyChanged = (): void => {
  document.dispatchEvent(new CustomEvent('next:currency-changed'));
};

describe('BaseDisplayEnhancer currency-change listener', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('re-renders a live enhancer when the currency changes', async () => {
    const enhancer = createProbe();
    await enhancer.initialize();
    expect(enhancer.rendered).toEqual(['$12.50']);

    enhancer.value = 20;
    fireCurrencyChanged();

    // Not just "it fired": the new value reached the element.
    expect(enhancer.rendered).toEqual(['$12.50', '$20.00']);
  });

  it('re-renders even when the underlying value is unchanged', async () => {
    // The symbol changes with the currency even when the number does not, so the
    // listener clears `lastValue` to defeat the unchanged-value short-circuit.
    const enhancer = createProbe();
    await enhancer.initialize();

    fireCurrencyChanged();

    expect(enhancer.rendered).toEqual(['$12.50', '$12.50']);
  });

  it('stops reacting once destroyed', async () => {
    const enhancer = createProbe();
    await enhancer.initialize();
    const renderedWhileAlive = enhancer.rendered.length;

    enhancer.destroy();
    enhancer.value = 99;
    fireCurrencyChanged();

    expect(enhancer.rendered).toHaveLength(renderedWhileAlive);
  });

  it('leaves nothing behind when a page of display elements is re-enhanced', async () => {
    // The accumulation case: three elements enhanced, destroyed, and enhanced again.
    // Before the fix the first generation's three listeners survived and kept firing.
    const firstPass = [createProbe(), createProbe(), createProbe()];
    await Promise.all(firstPass.map(e => e.initialize()));
    firstPass.forEach(e => e.destroy());

    const renderedAfterDestroy = firstPass.map(e => e.rendered.length);
    fireCurrencyChanged();

    expect(firstPass.map(e => e.rendered.length)).toEqual(renderedAfterDestroy);
  });
});

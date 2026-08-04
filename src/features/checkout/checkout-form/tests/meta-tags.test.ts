import { afterEach, describe, expect, it } from 'vitest';

import { getSuccessUrl } from '../../utils/url-utils';
import { applyFailureUrlMetaTags, applySuccessUrlMetaTags } from '../meta-tags';

/**
 * The programmatic door to the destination meta tags — what `next.setSuccessUrl(...)`
 * writes.
 *
 * The point of writing every spelling is that some *other* piece of the SDK reads it back,
 * so the last test reads it through `getSuccessUrl`, not through the DOM.
 */

function contentOf(name: string): string | null {
  return (
    document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ??
    null
  );
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('applySuccessUrlMetaTags', () => {
  it('writes all three accepted success-URL tag names', () => {
    applySuccessUrlMetaTags('/thank-you/');

    expect(contentOf('next-success-url')).toBe('/thank-you/');
    expect(contentOf('next-next-url')).toBe('/thank-you/');
    expect(contentOf('os-next-page')).toBe('/thank-you/');
  });

  it('updates the tag a page already carried instead of adding a second', () => {
    const existing = document.createElement('meta');
    existing.name = 'next-success-url';
    existing.content = '/old/';
    document.head.appendChild(existing);

    applySuccessUrlMetaTags('/new/');

    expect(
      document.querySelectorAll('meta[name="next-success-url"]')
    ).toHaveLength(1);
    expect(existing.content).toBe('/new/');
  });

  it('is what getSuccessUrl reads back', () => {
    applySuccessUrlMetaTags('/thank-you/');

    expect(getSuccessUrl()).toBe(`${window.location.origin}/thank-you/`);
  });
});

describe('applyFailureUrlMetaTags', () => {
  it('writes both accepted failure-URL tag names', () => {
    applyFailureUrlMetaTags('/checkout/?failed=1');

    expect(contentOf('next-failure-url')).toBe('/checkout/?failed=1');
    expect(contentOf('os-failure-url')).toBe('/checkout/?failed=1');
  });

  it('leaves the success tags alone', () => {
    applySuccessUrlMetaTags('/thank-you/');
    applyFailureUrlMetaTags('/checkout/?failed=1');

    expect(contentOf('next-success-url')).toBe('/thank-you/');
  });
});

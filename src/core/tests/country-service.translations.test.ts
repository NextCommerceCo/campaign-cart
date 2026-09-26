import { afterEach, describe, expect, it } from 'vitest';

import { translatedText } from '@/core/country-service';
import { useConfigStore } from '@/state/config';

afterEach(() => useConfigStore.setState({ translations: undefined }));

describe('translatedText', () => {
  it("takes the page's translation before the service's", () => {
    useConfigStore.setState({ translations: { th: { k: 'ของหน้า' } } });
    expect(translatedText('k', 'th', { k: 'ของ service' })).toBe('ของหน้า');
  });

  it("reads the page's translation for th-TH from th", () => {
    useConfigStore.setState({ translations: { th: { k: 'ของหน้า' } } });
    expect(translatedText('k', 'th-TH')).toBe('ของหน้า');
  });

  it("takes the service's texts when the page has none", () => {
    expect(translatedText('k', 'th-TH', { k: 'ไทย' })).toBe('ไทย');
  });

  it('answers nothing when neither has the key, for the caller to keep its own', () => {
    expect(translatedText('missing', 'th', {})).toBeUndefined();
    expect(translatedText('missing', 'th')).toBeUndefined();
  });
});

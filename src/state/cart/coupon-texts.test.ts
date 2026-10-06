import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConfigStore } from '@/state/config';
import type { TextSource } from '@/core/i18n-rules';
import { couponTexts } from './coupon-texts';

/** A service whose texts in every language are `texts`, or that never loads any. */
const service = (texts?: Record<string, string>): TextSource => ({
  getTexts: () => texts,
  loadTexts: vi.fn(() => Promise.resolve()),
});

describe('couponTexts', () => {
  beforeEach(() => {
    useConfigStore.setState({ locale: 'th', translations: {} });
  });

  it('reads the service’s text in the form’s language, with the code filled in', async () => {
    const texts = await couponTexts(
      'SAVE10',
      service({
        'coupon.errors.invalid': 'คูปอง {{code}} ใช้กับคำสั่งซื้อนี้ไม่ได้',
      })
    );

    expect(texts('coupon.errors.invalid')).toBe(
      'คูปอง SAVE10 ใช้กับคำสั่งซื้อนี้ไม่ได้'
    );
  });

  it('puts the page’s own translation ahead of the service’s', async () => {
    useConfigStore.setState({
      translations: { th: { 'coupon.applied': 'ได้ส่วนลด {{code}} แล้ว' } },
    });

    const texts = await couponTexts(
      'SAVE10',
      service({ 'coupon.applied': 'ใช้คูปอง {{code}} แล้ว' })
    );

    expect(texts('coupon.applied')).toBe('ได้ส่วนลด SAVE10 แล้ว');
  });

  it('answers in English when neither the page nor the service has the text', async () => {
    const texts = await couponTexts('SAVE10', service(undefined));

    expect(texts('coupon.errors.already_applied')).toBe(
      'Coupon SAVE10 is already applied.'
    );
  });
});

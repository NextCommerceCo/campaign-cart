import { describe, it, expect, vi } from 'vitest';
import {
  findEmailField,
  findPhoneField,
  getFormattedPhoneNumber,
} from '../field-discovery';
import type { Logger } from '@/core/logger';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function buildContainer(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('findEmailField', () => {
  it('prefers data-next-checkout-field over the legacy and name-based fallbacks', () => {
    const logger = createMockLogger();
    const container = buildContainer(`
      <input name="email_legacy" />
      <input data-next-checkout-field="email" id="the-one" />
    `);
    const field = findEmailField(
      { element: container, logger: logger as unknown as Logger },
      'email'
    );
    expect(field?.id).toBe('the-one');
  });

  it('falls back to input[name*="email"] when nothing more specific matches', () => {
    const logger = createMockLogger();
    const container = buildContainer('<input name="customer_email_address" />');
    const field = findEmailField(
      { element: container, logger: logger as unknown as Logger },
      'email'
    );
    expect(field).toBe(container.querySelector('input'));
  });

  it('warns and returns undefined when no email field exists', () => {
    const logger = createMockLogger();
    const container = buildContainer('<div></div>');
    const field = findEmailField(
      { element: container, logger: logger as unknown as Logger },
      'email'
    );
    expect(field).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Email field not found for prospect cart'
    );
  });
});

describe('findPhoneField', () => {
  it('finds a legacy os-checkout-field phone input', () => {
    const logger = createMockLogger();
    const container = buildContainer('<input os-checkout-field="phone" />');
    const field = findPhoneField(
      { element: container, logger: logger as unknown as Logger },
      'phone'
    );
    expect(field).toBe(container.querySelector('input'));
  });

  it('warns and returns undefined when no phone field exists', () => {
    const logger = createMockLogger();
    const container = buildContainer('<div></div>');
    const field = findPhoneField(
      { element: container, logger: logger as unknown as Logger },
      'phone'
    );
    expect(field).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Phone field not found for prospect cart'
    );
  });
});

describe('getFormattedPhoneNumber', () => {
  it('returns empty string when no phone field is present', () => {
    const logger = createMockLogger();
    const result = getFormattedPhoneNumber({
      element: buildContainer('<div></div>'),
      logger: logger as unknown as Logger,
    });
    expect(result).toBe('');
  });

  it('prefers the intlTelInput instance E.164 number when available', () => {
    const logger = createMockLogger();
    const container = buildContainer(
      '<input data-next-checkout-field="phone" type="tel" />'
    );
    const phoneField = container.querySelector('input') as any;
    phoneField.iti = { getNumber: vi.fn().mockReturnValue('+15551234567') };

    const result = getFormattedPhoneNumber({
      element: container,
      logger: logger as unknown as Logger,
    });
    expect(result).toBe('+15551234567');
  });

  it('falls back to the raw input value when intlTelInput throws', () => {
    const logger = createMockLogger();
    const container = buildContainer(
      '<input data-next-checkout-field="phone" type="tel" value="5551234567" />'
    );
    const phoneField = container.querySelector('input') as any;
    phoneField.iti = {
      getNumber: vi.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    };

    const result = getFormattedPhoneNumber({
      element: container,
      logger: logger as unknown as Logger,
    });
    expect(result).toBe('5551234567');
  });
});

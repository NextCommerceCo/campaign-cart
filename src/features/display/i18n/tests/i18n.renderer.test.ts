import { describe, expect, it } from 'vitest';

import { parseI18n } from '@/utils/i18n-spec';

import { applyTranslations, readOriginals } from '../i18n.renderer';

const element = (html: string): Element => {
  document.body.innerHTML = html;
  return document.body.firstElementChild as Element;
};

describe('applyTranslations', () => {
  const thai: Record<string, string> = {
    'checkout.contact.title': 'ข้อมูลติดต่อ',
    'checkout.secure': 'ชำระเงินอย่างปลอดภัย',
  };

  it('writes the text and the attribute from their keys', () => {
    const el = element('<h2 title="Secure">Contact</h2>');
    const { targets } = parseI18n(
      'checkout.contact.title;[title]checkout.secure'
    );
    applyTranslations(
      el,
      targets,
      readOriginals(el, targets),
      key => thai[key]
    );
    expect(el.textContent).toBe('ข้อมูลติดต่อ');
    expect(el.getAttribute('title')).toBe('ชำระเงินอย่างปลอดภัย');
  });

  it("keeps the page's own text where the language has no translation", () => {
    const el = element('<h2>Contact</h2>');
    const { targets } = parseI18n('checkout.subtitle');
    applyTranslations(el, targets, readOriginals(el, targets), () => undefined);
    expect(el.textContent).toBe('Contact');
  });

  it('puts the original back when a later language has no translation', () => {
    const el = element('<h2>Contact</h2>');
    const { targets } = parseI18n('checkout.contact.title');
    const originals = readOriginals(el, targets);
    applyTranslations(el, targets, originals, key => thai[key]);
    applyTranslations(el, targets, originals, () => undefined);
    expect(el.textContent).toBe('Contact');
  });

  it('adds an attribute the page did not write, and takes it away again', () => {
    const el = element('<button>Go</button>');
    const { targets } = parseI18n('[aria-label]checkout.secure');
    const originals = readOriginals(el, targets);
    applyTranslations(el, targets, originals, key => thai[key]);
    expect(el.getAttribute('aria-label')).toBe('ชำระเงินอย่างปลอดภัย');
    applyTranslations(el, targets, originals, () => undefined);
    expect(el.hasAttribute('aria-label')).toBe(false);
  });

  it('never replaces the children of an element that has any', () => {
    const el = element('<button><svg></svg>Pay</button>');
    const { targets } = parseI18n('checkout.contact.title');
    applyTranslations(
      el,
      targets,
      readOriginals(el, targets),
      key => thai[key]
    );
    expect(el.innerHTML).toBe('<svg></svg>Pay');
  });

  it('writes a translation as text, never as markup', () => {
    const el = element('<p>Hi</p>');
    const { targets } = parseI18n('x');
    applyTranslations(
      el,
      targets,
      readOriginals(el, targets),
      () => '<b>bold</b>'
    );
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<b>bold</b>');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderPackageTemplate } from '../package-selector.renderer';
import type { PackageDef } from '../package-selector.types';
import { useCampaignStore } from '@/state/campaign';

vi.mock('@/state/campaign', () => ({ useCampaignStore: { getState: vi.fn() } }));

const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any;

beforeEach(() => {
  vi.clearAllMocks();
  (useCampaignStore.getState as any).mockReturnValue({
    packages: [
      { ref_id: 2, name: 'Pro', image: 'p.png', price: '9.99', price_retail: '19.99', price_total: '9.99' },
    ],
  });
});

describe('renderPackageTemplate', () => {
  it('substitutes package fields and marks the card', () => {
    const def: PackageDef = { packageId: 2 };
    const card = renderPackageTemplate('<div class="card">{package.name} — {package.price}</div>', def, logger);
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain('Pro — 9.99');
    expect(card!.hasAttribute('data-next-selector-card')).toBe(true);
    expect(card!.getAttribute('data-next-package-id')).toBe('2');
    expect(card!.hasAttribute('data-next-selected')).toBe(false);
  });

  it('marks a pre-selected card', () => {
    const card = renderPackageTemplate('<div>{package.name}</div>', { packageId: 2, selected: true }, logger);
    expect(card!.getAttribute('data-next-selected')).toBe('true');
  });

  it('lets a def value override the campaign field', () => {
    const card = renderPackageTemplate('<div>{package.name}</div>', { packageId: 2, name: 'Custom' }, logger);
    expect(card!.textContent).toBe('Custom');
  });

  it('substitutes empty string for unknown tokens', () => {
    const card = renderPackageTemplate('<div>[{package.unknown}]</div>', { packageId: 2 }, logger);
    expect(card!.textContent).toBe('[]');
  });

  it('returns null and warns when the template has no root element', () => {
    const card = renderPackageTemplate('   ', { packageId: 2 }, logger);
    expect(card).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('honors an explicit data-next-selector-card element over the first child', () => {
    const tpl = '<div class="wrap"><article data-next-selector-card>{package.name}</article></div>';
    const card = renderPackageTemplate(tpl, { packageId: 2 }, logger);
    expect(card!.tagName).toBe('ARTICLE');
    expect(card!.getAttribute('data-next-package-id')).toBe('2');
  });
});

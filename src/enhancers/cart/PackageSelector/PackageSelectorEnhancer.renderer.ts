import { useCampaignStore } from '@/stores/campaignStore';
import type { Logger } from '@/utils/logger';
import type { PackageDef } from './PackageSelectorEnhancer.types';

export function renderPackageTemplate(
  template: string,
  def: PackageDef,
  logger: Logger,
): HTMLElement | null {
  const allPackages = useCampaignStore.getState().packages ?? [];
  const pkg = allPackages.find(p => p.ref_id === def.packageId);

  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(def)) {
    vars[`package.${key}`] = value != null ? String(value) : '';
  }
  if (pkg) {
    vars['package.packageId'] ??= String(pkg.ref_id);
    vars['package.name'] ??= pkg.name ?? '';
    vars['package.image'] ??= pkg.image ?? '';
    vars['package.price'] ??= pkg.price ?? '';
    vars['package.priceRetail'] ??= pkg.price_retail ?? '';
    vars['package.priceTotal'] ??= pkg.price_total ?? '';
  }

  const html = template.replace(/\{([^}]+)\}/g, (_, k: string) => vars[k] ?? '');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();

  const firstChild = wrapper.firstElementChild;
  const cardEl =
    wrapper.querySelector<HTMLElement>('[data-next-selector-card]') ??
    (firstChild instanceof HTMLElement ? firstChild : null);

  if (!cardEl) {
    logger.warn('Package template produced no root element for packageId', def.packageId);
    return null;
  }

  cardEl.setAttribute('data-next-selector-card', '');
  cardEl.setAttribute('data-next-package-id', String(def.packageId));
  if (def.selected) {
    cardEl.setAttribute('data-next-selected', 'true');
  }

  return cardEl;
}

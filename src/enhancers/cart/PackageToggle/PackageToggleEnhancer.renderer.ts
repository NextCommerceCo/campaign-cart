import { useCampaignStore } from '@/stores/campaignStore';
import { formatCurrency } from '@/utils/currencyFormatter';
import { TemplateRenderer } from '@/shared/utils/TemplateRenderer';
import type { Logger } from '@/utils/logger';
import type { SummaryLine } from '@/types/api';
import type { PackageDef, ToggleCard } from './PackageToggleEnhancer.types';

export function renderToggleTemplate(
  template: string,
  def: PackageDef,
  logger: Logger,
): HTMLElement | null {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
  const pkg = allPackages.find(p => p.ref_id === def.packageId);

  const toggleData: Record<string, string> = {};
  for (const [key, value] of Object.entries(def)) {
    toggleData[key] = value != null ? String(value) : '';
  }
  if (pkg) {
    toggleData['packageId'] ??= String(pkg.ref_id);
    toggleData['name'] ??= pkg.name ?? '';
    toggleData['image'] ??= pkg.image ?? '';
    toggleData['price'] ??= pkg.price ?? '';
    toggleData['priceRetail'] ??= pkg.price_retail ?? '';
    toggleData['priceRetailTotal'] ??= pkg.price_retail_total ?? '';
  }

  const html = TemplateRenderer.render(template, { data: { toggle: toggleData } });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();

  const firstChild = wrapper.firstElementChild;
  const cardEl =
    wrapper.querySelector<HTMLElement>('[data-next-toggle-card]') ??
    (firstChild instanceof HTMLElement ? firstChild : null);

  if (!cardEl) {
    logger.warn('Toggle template produced no root element for packageId', def.packageId);
    return null;
  }

  cardEl.setAttribute('data-next-toggle-card', '');
  cardEl.setAttribute('data-next-package-id', String(def.packageId));
  if (def.selected) {
    cardEl.setAttribute('data-next-selected', 'true');
  }

  return cardEl;
}

export function renderToggleImage(card: ToggleCard): void {
  const slots = card.element.querySelectorAll<HTMLImageElement>('[data-next-toggle-image]');
  if (slots.length === 0) return;

  const pkg = (useCampaignStore.getState().data?.packages ?? []).find(
    p => p.ref_id === card.packageId,
  );
  if (!pkg?.image) return;

  slots.forEach(el => {
    el.src = pkg.image;
    if (!el.alt) el.alt = pkg.name ?? '';
  });
}

export function renderTogglePrice(card: ToggleCard, line: SummaryLine | null): void {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
  const pkg = allPackages.find(p => p.ref_id === card.packageId);
  const qty = card.quantity || 1;

  const scale = (price: string | undefined): string => {
    if (!price) return '';
    const num = parseFloat(price);
    return isNaN(num) ? '' : formatCurrency(num * qty);
  };

  const comparePrice = line?.original_package_price ?? pkg?.price_total;
  const basePrice = line?.package_price ?? pkg?.price_total ?? '0';
  const savings = comparePrice && basePrice
    ? (parseFloat(comparePrice) - parseFloat(basePrice))
    : 0;

  card.element.querySelectorAll<HTMLElement>('[data-next-toggle-price]').forEach(el => {
    const field = el.getAttribute('data-next-toggle-price') || 'total';

    switch (field) {
      case 'compare':
        el.textContent = scale(comparePrice);
        break;
      case 'savings':
        el.textContent = savings > 0 ? formatCurrency(savings) : '';
        break;
      case 'savingsPercentage':
        el.textContent = savings > 0 && comparePrice
          ? `${Math.round((savings / parseFloat(comparePrice)) * 100)}%`
          : '';
        break;
      case 'subtotal':
        el.textContent = line?.subtotal ?? pkg?.price_total ?? '';
        break;
      default:
        el.textContent = scale(basePrice);
        break;
    }
  });

  // Store raw numeric values for PackageToggleDisplayEnhancer
  const baseNum = parseFloat(basePrice) * qty;
  const compareNum = comparePrice ? parseFloat(comparePrice) * qty : null;
  const savingsPct =
    savings > 0 && compareNum ? (savings / compareNum) * 100 : 0;
  card.element.setAttribute('data-toggle-price-total', isNaN(baseNum) ? '' : baseNum.toString());
  card.element.setAttribute('data-toggle-price-compare', compareNum !== null ? compareNum.toString() : '');
  card.element.setAttribute('data-toggle-price-savings', savings > 0 ? savings.toString() : '0');
  card.element.setAttribute('data-toggle-price-savings-pct', savingsPct.toString());
  card.element.dispatchEvent(
    new CustomEvent('toggle:price-updated', {
      bubbles: true,
      detail: { packageId: card.packageId },
    }),
  );
}

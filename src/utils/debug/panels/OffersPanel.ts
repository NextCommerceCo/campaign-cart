/**
 * Offers & Discounts Panel
 * Displays applied offers, coupons, discount breakdown, and a live
 * coupon-attempt log. Renders gracefully when offer state is absent.
 */

import { formatCurrency } from '../../currencyFormatter';
import { useCartStore } from '../../../stores/cartStore';
import { useCampaignStore } from '../../../stores/campaignStore';
import { EventBus } from '../../events';
import type { Offer } from '../../../types/campaign';
import { DebugPanel, PanelAction, PanelTab } from '../DebugPanels';
import { RawDataHelper } from './RawDataHelper';

type AttemptResult = 'applied' | 'failed' | 'removed';

interface CouponAttempt {
  timestamp: number;
  code: string;
  result: AttemptResult;
  message?: string;
}

const ATTEMPT_LIMIT = 20;

export class OffersPanel implements DebugPanel {
  id = 'offers';
  title = 'Offers & Discounts';
  icon = '🏷️';

  private attempts: CouponAttempt[] = [];

  constructor() {
    const bus = EventBus.getInstance();

    bus.on('coupon:applied', payload => {
      const code = 'code' in payload ? payload.code : payload.coupon.code;
      this.record({ code, result: 'applied' });
    });

    bus.on('coupon:validation-failed', payload => {
      this.record({
        code: payload.code,
        result: 'failed',
        message: payload.message,
      });
    });

    bus.on('coupon:removed', payload => {
      this.record({ code: payload.code, result: 'removed' });
    });

    // React to actual store changes instead of relying on DebugOverlay's
    // 1-second setInterval. Zustand fires only on mutation, so this is
    // both cheaper and lag-free.
    useCartStore.subscribe(
      (state, prev) => {
        if (
          state.vouchers !== prev.vouchers ||
          state.offerDiscounts !== prev.offerDiscounts ||
          state.voucherDiscounts !== prev.voucherDiscounts ||
          state.totalDiscount !== prev.totalDiscount ||
          state.hasDiscounts !== prev.hasDiscounts
        ) {
          this.requestRefresh();
        }
      }
    );

    useCampaignStore.subscribe((state, prev) => {
      if (state.data?.offers !== prev.data?.offers) {
        this.requestRefresh();
      }
    });
  }

  private requestRefresh(): void {
    document.dispatchEvent(new CustomEvent('debug:update-content'));
  }

  getContent(): string {
    return this.getTabs()[0]?.getContent() ?? '';
  }

  getTabs(): PanelTab[] {
    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: '📊',
        getContent: () => this.getOverviewContent(),
      },
      {
        id: 'offers',
        label: 'Offers',
        icon: '🎁',
        getContent: () => this.getOffersContent(),
      },
      {
        id: 'coupons',
        label: 'Coupons',
        icon: '🎟️',
        getContent: () => this.getCouponsContent(),
      },
      {
        id: 'raw',
        label: 'Raw Data',
        icon: '🔧',
        getContent: () => this.getRawDataContent(),
      },
    ];
  }

  getActions(): PanelAction[] {
    return [
      {
        label: 'Apply Coupon',
        action: this.promptApplyCoupon,
        variant: 'primary',
      },
    ];
  }

  private record(entry: Omit<CouponAttempt, 'timestamp'>): void {
    this.attempts.unshift({ ...entry, timestamp: Date.now() });
    if (this.attempts.length > ATTEMPT_LIMIT) {
      this.attempts.length = ATTEMPT_LIMIT;
    }
    this.requestRefresh();
  }

  private promptApplyCoupon = async (): Promise<void> => {
    const input = window.prompt('Coupon code to apply:');
    if (!input) return;
    const code = input.trim();
    if (!code) return;
    const result = await useCartStore.getState().applyCoupon(code);
    if (!result.success) {
      window.alert(`Coupon failed: ${result.message}`);
    }
  };

  private getOverviewContent(): string {
    const state = useCartStore.getState();
    const offerCount = state.offerDiscounts?.length ?? 0;
    const couponCount = state.vouchers.length;
    const totalDiscount = state.totalDiscount.toNumber();
    const discountPct = state.totalDiscountPercentage.toNumber();

    const breakdown = [
      ...(state.offerDiscounts ?? []).map(d => ({ ...d, kind: 'Offer' })),
      ...(state.voucherDiscounts ?? []).map(d => ({ ...d, kind: 'Coupon' })),
    ];

    return `
      <div class="enhanced-panel">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">💸</div>
            <div class="metric-content">
              <div class="metric-value">${formatCurrency(totalDiscount)}</div>
              <div class="metric-label">Total Discount</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📉</div>
            <div class="metric-content">
              <div class="metric-value">${discountPct.toFixed(2)}%</div>
              <div class="metric-label">Discount %</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🎟️</div>
            <div class="metric-content">
              <div class="metric-value">${couponCount}</div>
              <div class="metric-label">Active Coupons</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🎁</div>
            <div class="metric-content">
              <div class="metric-value">${offerCount}</div>
              <div class="metric-label">Active Offers</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">Discount Breakdown</h3>
          ${
            breakdown.length === 0
              ? `
                <div class="empty-state">
                  <div class="empty-icon">🏷️</div>
                  <div class="empty-text">No discounts applied</div>
                </div>
              `
              : `
                <div class="cart-items-list">
                  ${breakdown
                    .map(
                      d => `
                    <div class="cart-item-card">
                      <div class="item-info">
                        <div class="item-title">${escapeHtml(d.name ?? '(unnamed)')}</div>
                        <div class="item-details">
                          ${d.kind}${d.description ? ` • ${escapeHtml(d.description)}` : ''}
                        </div>
                      </div>
                      <div class="item-total">${escapeHtml(d.amount)}</div>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              `
          }
        </div>
      </div>
    `;
  }

  private getOffersContent(): string {
    const cartState = useCartStore.getState();
    const campaign = useCampaignStore.getState().data;
    const applied = cartState.offerDiscounts ?? [];
    const allOffers = campaign?.offers ?? [];
    const automaticOffers = allOffers.filter(o => o.type === 'offer');
    const appliedIds = new Set(
      applied.map(d => d.offer_id).filter((id): id is number => id !== undefined)
    );
    const offersByRefId = new Map(allOffers.map(o => [o.ref_id, o]));

    const appliedSection =
      applied.length === 0
        ? `
          <div class="empty-state">
            <div class="empty-icon">🎁</div>
            <div class="empty-text">No offers currently applied</div>
          </div>
        `
        : `
          <div class="cart-items-list">
            ${applied
              .map(offer => {
                const detail =
                  offer.offer_id !== undefined ? offersByRefId.get(offer.offer_id) : undefined;
                return `
              <div class="cart-item-card">
                <div class="item-info">
                  <div class="item-title">${escapeHtml(offer.name ?? '(unnamed offer)')}</div>
                  ${
                    offer.offer_id !== undefined
                      ? `<div class="item-details" style="opacity: 0.65; font-size: 11px;">Offer ID: ${offer.offer_id}</div>`
                      : ''
                  }
                  ${
                    detail
                      ? `
                        <div class="item-details">
                          <strong>Condition:</strong> ${escapeHtml(formatCondition(detail))}
                        </div>
                        <div class="item-details">
                          <strong>Benefit:</strong> ${escapeHtml(formatBenefit(detail))}
                        </div>
                      `
                      : offer.description
                        ? `<div class="item-details">${escapeHtml(offer.description)}</div>`
                        : ''
                  }
                </div>
                <div class="item-total">${escapeHtml(offer.amount)}</div>
              </div>
            `;
              })
              .join('')}
          </div>
        `;

    const availableSection =
      automaticOffers.length === 0
        ? `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-text">No automatic offers declared on this campaign</div>
          </div>
        `
        : `
          <div class="cart-items-list">
            ${automaticOffers.map(o => renderAvailableOffer(o, appliedIds.has(o.ref_id))).join('')}
          </div>
        `;

    return `
      <div class="enhanced-panel">
        <div class="section">
          <h3 class="section-title">Applied Offers (${applied.length})</h3>
          ${appliedSection}
        </div>
        <div class="section">
          <h3 class="section-title">Available Offers (${automaticOffers.length})</h3>
          ${availableSection}
        </div>
      </div>
    `;
  }

  private getCouponsContent(): string {
    const state = useCartStore.getState();
    const campaign = useCampaignStore.getState().data;
    const applied = state.vouchers;
    const voucherDiscounts = state.voucherDiscounts ?? [];
    const appliedLower = new Set(applied.map(c => c.toLowerCase()));
    const availableVouchers = (campaign?.offers ?? []).filter(
      o => o.type === 'voucher'
    );

    const appliedSection =
      applied.length === 0
        ? `
          <div class="empty-state">
            <div class="empty-icon">🎟️</div>
            <div class="empty-text">No coupons applied</div>
          </div>
        `
        : `
          <div class="cart-items-list">
            ${applied
              .map(code => {
                const match = voucherDiscounts.find(
                  d => d.name?.toLowerCase() === code.toLowerCase()
                );
                const amount = match?.amount ?? '—';
                const detail = availableVouchers.find(
                  v => (v.code ?? '').toLowerCase() === code.toLowerCase()
                );
                return `
                  <div class="cart-item-card">
                    <div class="item-info">
                      <div class="item-title">${escapeHtml(code)}</div>
                      ${
                        detail
                          ? `
                            <div class="item-details">
                              <strong>Condition:</strong> ${escapeHtml(formatCondition(detail))}
                            </div>
                            <div class="item-details">
                              <strong>Benefit:</strong> ${escapeHtml(formatBenefit(detail))}
                            </div>
                          `
                          : match?.description
                            ? `<div class="item-details">${escapeHtml(match.description)}</div>`
                            : ''
                      }
                    </div>
                    <div class="item-total">${escapeHtml(amount)}</div>
                    <button
                      class="remove-btn"
                      onclick="window.__nextDebugRemoveCoupon &amp;&amp; window.__nextDebugRemoveCoupon('${escapeAttr(code)}')"
                      title="Remove ${escapeAttr(code)}">×</button>
                  </div>
                `;
              })
              .join('')}
          </div>
        `;

    const attemptsSection =
      this.attempts.length === 0
        ? `
          <div class="empty-state">
            <div class="empty-icon">📜</div>
            <div class="empty-text">No coupon activity this session</div>
          </div>
        `
        : `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="text-align: left; opacity: 0.7;">
                <th style="padding: 6px 4px;">Time</th>
                <th style="padding: 6px 4px;">Code</th>
                <th style="padding: 6px 4px;">Result</th>
                <th style="padding: 6px 4px;">Message</th>
              </tr>
            </thead>
            <tbody>
              ${this.attempts
                .map(
                  a => `
                <tr style="border-top: 1px solid rgba(255,255,255,0.08);">
                  <td style="padding: 6px 4px; opacity: 0.7;">${formatTime(a.timestamp)}</td>
                  <td style="padding: 6px 4px; font-family: monospace;">${escapeHtml(a.code)}</td>
                  <td style="padding: 6px 4px;">${resultBadge(a.result)}</td>
                  <td style="padding: 6px 4px; opacity: 0.85;">${escapeHtml(a.message ?? '')}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `;

    const availableSection =
      availableVouchers.length === 0
        ? `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-text">No voucher codes declared on this campaign</div>
          </div>
        `
        : `
          <div class="cart-items-list">
            ${availableVouchers
              .map(v => {
                const code = v.code ?? '';
                const hasCode = !!code;
                const isApplied = hasCode && appliedLower.has(code.toLowerCase());
                const disabled = !hasCode || isApplied;
                const label = !hasCode ? 'No code' : isApplied ? 'Applied' : 'Apply';
                return `
                  <div class="cart-item-card">
                    <div class="item-info">
                      <div class="item-title">
                        <code style="font-family: monospace;">${hasCode ? escapeHtml(code) : '<em style="opacity: 0.6;">(no code)</em>'}</code>
                        ${isApplied ? '<span style="color: #4caf50; font-size: 11px; margin-left: 8px;">● applied</span>' : ''}
                      </div>
                      <div class="item-details" style="opacity: 0.85;">${escapeHtml(v.name)}</div>
                      <div class="item-details">
                        <strong>Condition:</strong> ${escapeHtml(formatCondition(v))}
                      </div>
                      <div class="item-details">
                        <strong>Benefit:</strong> ${escapeHtml(formatBenefit(v))}
                      </div>
                    </div>
                    <button
                      class="qty-btn"
                      style="padding: 8px 14px; font-size: 12px; min-width: 76px; white-space: nowrap;"
                      onclick="window.__nextDebugApplyCoupon &amp;&amp; window.__nextDebugApplyCoupon('${escapeAttr(code)}')"
                      ${disabled ? 'disabled' : ''}
                      title="${hasCode ? `Apply ${escapeAttr(code)}` : 'Voucher has no code'}">${label}</button>
                  </div>
                `;
              })
              .join('')}
          </div>
        `;

    return `
      <div class="enhanced-panel">
        <div class="section">
          <h3 class="section-title">Applied Coupons (${applied.length})</h3>
          ${appliedSection}
        </div>
        <div class="section">
          <h3 class="section-title">Available Voucher Codes (${availableVouchers.length})</h3>
          ${availableSection}
        </div>
        <div class="section">
          <h3 class="section-title">Recent Attempts</h3>
          ${attemptsSection}
        </div>
      </div>
    `;
  }

  private getRawDataContent(): string {
    const s = useCartStore.getState();
    return RawDataHelper.generateRawDataContent({
      vouchers: s.vouchers,
      offerDiscounts: s.offerDiscounts,
      voucherDiscounts: s.voucherDiscounts,
      hasDiscounts: s.hasDiscounts,
      totalDiscount: s.totalDiscount.toString(),
      totalDiscountPercentage: s.totalDiscountPercentage.toString(),
      summary: s.summary,
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function formatBenefit(o: Offer): string {
  const b = o.benefit;
  if (!b) return '';
  if (b.description) return b.description;
  const labelMap: Record<string, string> = {
    package_percentage: 'Package',
    shipping_percentage: 'Shipping',
    order_percentage: 'Order',
  };
  const label = labelMap[b.type] ?? b.type;
  return b.value ? `${label} − ${b.value}%` : label;
}

function formatCondition(o: Offer): string {
  const c = o.condition;
  if (!c) return '';
  if (c.description) return c.description;
  if (c.type === 'any') return 'Always active';
  if (c.type === 'count') return `Requires ≥ ${c.value} items in cart`;
  return c.type;
}

function renderAvailableOffer(o: Offer, isApplied: boolean): string {
  return `
    <div class="cart-item-card">
      <div class="item-info">
        <div class="item-title">
          ${escapeHtml(o.name)}
          ${isApplied ? '<span style="color: #4caf50; font-size: 11px; margin-left: 8px;">● applied</span>' : ''}
        </div>
        <div class="item-details">
          <strong>Condition:</strong> ${escapeHtml(formatCondition(o))}
        </div>
        <div class="item-details">
          <strong>Benefit:</strong> ${escapeHtml(formatBenefit(o))}
        </div>
        <div class="item-details" style="opacity: 0.65; font-size: 11px;">
          ref_id: ${o.ref_id} • ${o.packages.length} package(s) • ${o.shipping_methods.length} shipping method(s)
        </div>
      </div>
    </div>
  `;
}

function resultBadge(result: AttemptResult): string {
  switch (result) {
    case 'applied':
      return '<span style="color: #4caf50;">✅ applied</span>';
    case 'failed':
      return '<span style="color: #ff5252;">❌ failed</span>';
    case 'removed':
      return '<span style="color: #ffa726;">🗑️ removed</span>';
  }
}

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __nextDebugRemoveCoupon?: (code: string) => void;
    __nextDebugApplyCoupon?: (code: string) => Promise<void>;
  };
  w.__nextDebugRemoveCoupon = (code: string) => {
    void useCartStore.getState().removeCoupon(code);
  };
  w.__nextDebugApplyCoupon = async (code: string) => {
    const result = await useCartStore.getState().applyCoupon(code);
    if (!result.success) {
      window.alert(`Coupon failed: ${result.message}`);
    }
  };
}

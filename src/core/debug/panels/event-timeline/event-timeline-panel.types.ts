import type { DeliveryStatus } from '@/core/analytics/debug/analytics-debug-tracker';
import type { IconName } from '../../icons';

/** Which detail tab is shown in the event modal. */
export type DetailTab = 'flow' | 'validation';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'dataLayer' | 'internal' | 'dom' | 'performance';
  name: string;
  data: any;
  source: string;
  duration?: number;
  relativeTime: string;
  isInternal?: boolean;
}

/**
 * Delivery status → icon/colour, shared by the row chips (main file) and the
 * flow-graph nodes (`event-timeline-panel.flow.ts`).
 */
export const DELIVERY_STATUS_ICON: Record<DeliveryStatus, IconName> = {
  sent: 'check-circle',
  blocked: 'ban',
  skipped: 'minus-circle',
  failed: 'x-circle',
  pending: 'clock',
};

export const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  sent: '#1f9d55',
  blocked: '#9aa0a6',
  skipped: '#6b7280',
  failed: '#e3342f',
  pending: '#d6a700',
};

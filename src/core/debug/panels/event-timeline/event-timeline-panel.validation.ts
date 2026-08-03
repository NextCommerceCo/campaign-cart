/**
 * The Validation tab of the event detail modal: the pass/fail/skip checklist
 * for a dataLayer event's ecommerce payload. Extracted verbatim from
 * `event-timeline-panel.ts` (see docs/code-findings.md #137) — the other seam
 * the finding notes as moving no cited symbol. Both functions were already
 * pure; the caller computes the checks (`auditDataLayerEvent`, in the main
 * file) and passes the result in, so this module only renders.
 */
import { lucide, type IconName } from '../../icons';
import type { CheckStatus, EventCheck } from '../ecommerce-event-validator';

const CHECK_ICON: Record<CheckStatus, IconName> = {
  pass: 'check-circle',
  warning: 'alert',
  error: 'x-circle',
  skipped: 'minus-circle',
};

/** Pure helpers the validation checklist needs, supplied by the panel. */
export interface ValidationRenderDeps {
  escapeHtml(value: string): string;
}

export function renderCheckRow(
  check: EventCheck,
  deps: ValidationRenderDeps
): string {
  const icon = CHECK_ICON[check.status];
  return `
    <li class="event-check event-check-${check.status}">
      <span class="event-check-status">${lucide(icon, { size: 14 })}</span>
      <div class="event-check-body">
        <div class="event-check-head">
          <span class="event-check-label">${deps.escapeHtml(check.label)}</span>
          <code class="event-check-field">${deps.escapeHtml(check.field)}</code>
        </div>
        <div class="event-check-detail">${deps.escapeHtml(check.detail)}</div>
      </div>
    </li>`;
}

export function renderValidationSection(
  checks: EventCheck[],
  deps: ValidationRenderDeps
): string {
  if (checks.length === 0) return '';

  const errors = checks.filter(c => c.status === 'error').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const passed = checks.filter(c => c.status === 'pass').length;
  const checked = checks.filter(c => c.status !== 'skipped').length;

  const summaryClass = errors
    ? 'event-validation-fail'
    : warnings
      ? 'event-validation-warn'
      : 'event-validation-ok';
  const summaryIcon = errors
    ? 'x-circle'
    : warnings
      ? 'alert'
      : 'check-circle';
  const summaryText = errors
    ? `${errors} failed, ${warnings} warning${warnings === 1 ? '' : 's'} of ${checked} checks`
    : warnings
      ? `${warnings} warning${warnings === 1 ? '' : 's'} of ${checked} checks`
      : `All ${passed} checks passed`;

  const rows = checks.map(c => renderCheckRow(c, deps)).join('');
  return `
    <div class="event-validation ${summaryClass}">
      <div class="event-validation-summary">
        <span class="event-validation-icon">${lucide(summaryIcon, { size: 14 })}</span>
        <span class="event-validation-summary-text">${summaryText}</span>
      </div>
      <ul class="event-check-list">${rows}</ul>
    </div>`;
}

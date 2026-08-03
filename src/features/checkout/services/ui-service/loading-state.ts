/**
 * Whether the checkout, or one section of it, is busy.
 *
 * Several things can be in flight at once — the order call, a shipping-rate lookup, an
 * address lookup — and each names itself when it starts and finishes. The form as a whole
 * carries `next-processing` while **any** of them is running, which is what a "disable the
 * page while we work" style hooks onto; a section named in the markup as
 * `[data-section="…"]` also carries `next-loading` of its own.
 *
 * The per-section map is the reason both exist: without it, the first thing to finish
 * would clear the form's busy state while the order call was still going.
 *
 * Extracted verbatim from `ui-service.ts`. It needs three things from the service
 * ({@link LoadingStateContext}) and calls none of its methods.
 */

import type { Logger } from '@/core/logger';

/** What this module needs from `UIService`. */
export interface LoadingStateContext {
  /** The checkout form. Carries `next-processing`; sections are looked up inside it. */
  form: HTMLFormElement;
  /**
   * Section name → busy. Owned by the service because `destroy()` clears it.
   *
   * Sections stay in the map with `false` once finished rather than being deleted; only
   * the values are read.
   */
  loadingStates: Map<string, boolean>;
  logger: Logger;
}

/**
 * Marks one section busy, and the form with it.
 *
 * @param section Name of the work starting — matches `[data-section="…"]` in the markup
 * when a section should show its own spinner.
 *
 * @example
 * ```ts
 * showLoading(ctx, 'checkout');
 * ```
 */
export function showLoading(ctx: LoadingStateContext, section: string): void {
  ctx.loadingStates.set(section, true);

  // Add loading class to form
  ctx.form.classList.add('next-processing');

  // Add loading class to specific section if it exists
  const sectionElement = ctx.form.querySelector(`[data-section="${section}"]`);
  if (sectionElement instanceof HTMLElement) {
    sectionElement.classList.add('next-loading');
  }

  ctx.logger.debug(`Showing loading state for section: ${section}`);
}

/**
 * Marks one section finished, and the form with it only if nothing else is still running.
 */
export function hideLoading(ctx: LoadingStateContext, section: string): void {
  ctx.loadingStates.set(section, false);

  // Check if any sections are still loading
  const hasActiveLoading = Array.from(ctx.loadingStates.values()).some(
    isLoading => isLoading
  );

  if (!hasActiveLoading) {
    ctx.form.classList.remove('next-processing');
  }

  // Remove loading class from specific section
  const sectionElement = ctx.form.querySelector(`[data-section="${section}"]`);
  if (sectionElement instanceof HTMLElement) {
    sectionElement.classList.remove('next-loading');
  }

  ctx.logger.debug(`Hiding loading state for section: ${section}`);
}

/**
 * Fills a multi-step checkout's progress bar to the given step.
 *
 * Does nothing when the markup has no `.next-progress-bar`, so a single-step form needs
 * no guard at the call site.
 *
 * @param step 1-based step number. Assumes four steps, and clamps to the bar's ends.
 */
export function updateProgress(ctx: LoadingStateContext, step: number): void {
  const progressBar = ctx.form.querySelector('.next-progress-bar');
  if (progressBar instanceof HTMLElement) {
    const progressFill = progressBar.querySelector('.next-progress-fill');
    if (progressFill instanceof HTMLElement) {
      const percentage = Math.min(100, Math.max(0, step * 25)); // Assuming 4 steps
      progressFill.style.width = `${percentage}%`;
      progressFill.setAttribute('aria-valuenow', percentage.toString());
    }
  }

  ctx.logger.debug(`Updated progress to step: ${step}`);
}

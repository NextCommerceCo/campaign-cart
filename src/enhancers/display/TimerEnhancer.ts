/**
 * Timer Enhancer
 * Handles persistent countdown timers with localStorage persistence
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';

/**
 * Drives a persistent countdown timer that survives page reloads.
 *
 * Activated by `data-next-timer`. On initialize it reads a required duration (in
 * seconds), records a start time in `localStorage` keyed by a persistence id, and
 * ticks once per second. On each tick it computes the remaining time from the
 * stored start time — so the countdown resumes correctly after a reload — and
 * writes the formatted value into a child `[data-next-timer-display]` element if
 * present, otherwise into the bound element itself.
 *
 * When the countdown reaches zero it clears the interval, removes the persisted
 * start time, hides the timer element, reveals any
 * `[data-next-timer-expired][data-persistence-id="{id}"]` elements, and emits the
 * `timer:expired` event with the persistence id.
 *
 * ## Attributes
 *
 * | Attribute | Type | Required | Default | Description |
 * |---|---|---|---|---|
 * | `data-next-timer` | boolean (presence) | yes | — | Activation attribute that marks the element as a timer. |
 * | `data-duration` | `number` (seconds) | yes | — | Countdown length in seconds. |
 * | `data-persistence-id` | `string` | no | `"default-timer"` | `localStorage` key suffix; also links the timer to matching `data-next-timer-expired` elements. |
 * | `data-format` | `"hh:mm:ss" \| "mm:ss" \| "ss"` | no | `"mm:ss"` | Output format for the remaining time. |
 *
 * @example
 * ```html
 * <div data-next-timer data-duration="600" data-persistence-id="sale" data-format="mm:ss">
 *   <span data-next-timer-display></span>
 * </div>
 * <div data-next-timer-expired data-persistence-id="sale" style="display:none">
 *   This offer has expired.
 * </div>
 * ```
 */
export class TimerEnhancer extends BaseEnhancer {
  private duration: number = 0;
  private persistenceId: string = '';
  private format: string = 'mm:ss';
  private interval?: number | undefined;
  private startTime: number = 0;

  public async initialize(): Promise<void> {
    this.validateElement();
    
    // Get timer configuration
    const durationAttr = this.getRequiredAttribute('data-duration');
    this.duration = parseInt(durationAttr, 10);
    
    this.persistenceId = this.getAttribute('data-persistence-id') || 'default-timer';
    this.format = this.getAttribute('data-format') || 'mm:ss';
    
    // Load or initialize start time
    this.loadStartTime();
    
    // Start the timer
    this.startTimer();
    
    this.logger.debug(`Initialized timer: ${this.duration}s, persistence: ${this.persistenceId}`);
  }

  public update(): void {
    // Timer updates automatically via interval
  }

  private loadStartTime(): void {
    const stored = localStorage.getItem(`next-timer-${this.persistenceId}`);
    
    if (stored) {
      this.startTime = parseInt(stored, 10);
    } else {
      this.startTime = Date.now();
      localStorage.setItem(`next-timer-${this.persistenceId}`, this.startTime.toString());
    }
  }

  private startTimer(): void {
    this.updateDisplay();
    
    this.interval = window.setInterval(() => {
      this.updateDisplay();
    }, 1000);
  }

  private updateDisplay(): void {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const remaining = Math.max(0, this.duration - elapsed);
    
    if (remaining === 0) {
      this.handleTimerExpired();
      return;
    }
    
    const formatted = this.formatTime(remaining);
    
    // Update display elements
    const displayElement = this.element.querySelector('[data-next-timer-display]') || this.element;
    displayElement.textContent = formatted;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    switch (this.format) {
      case 'hh:mm:ss':
        return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
      case 'mm:ss':
        return `${pad(minutes)}:${pad(secs)}`;
      case 'ss':
        return pad(secs);
      default:
        return `${pad(minutes)}:${pad(secs)}`;
    }
  }

  private handleTimerExpired(): void {
    // Clear interval
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    
    // Remove from localStorage
    localStorage.removeItem(`next-timer-${this.persistenceId}`);
    
    // Hide timer element
    this.element.style.display = 'none';
    
    // Show expired message elements
    const expiredElements = document.querySelectorAll(`[data-next-timer-expired][data-persistence-id="${this.persistenceId}"]`);
    expiredElements.forEach(el => {
      (el as HTMLElement).style.display = '';
    });
    
    // Emit timer expired event
    this.emit('timer:expired', { persistenceId: this.persistenceId });
    
    this.logger.debug(`Timer expired: ${this.persistenceId}`);
  }

  public override destroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    super.destroy();
  }
}
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Logger } from '@/core/logger';

import { EventHandlerManager } from '../../../utils/event-handler-utils';
import {
  handleResponsiveUI,
  handleSpreedlyFieldBlur,
  handleSpreedlyFieldFocus,
  handleSpreedlyFieldInput,
  initializeFloatingLabels,
  setupFloatingLabel,
  updateLabelsForPopulatedData,
  type FloatingLabelContext,
} from '../floating-labels';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

interface Harness {
  ctx: FloatingLabelContext;
  logger: ReturnType<typeof createMockLogger>;
  events: EventHandlerManager;
}

function createHarness(html: string): Harness {
  const form = document.createElement('form');
  form.innerHTML = html;
  document.body.appendChild(form);

  const logger = createMockLogger();
  const events = new EventHandlerManager();
  return {
    logger,
    events,
    ctx: {
      form,
      labels: new Map(),
      events,
      periodicCheck: { value: undefined },
      logger: logger as unknown as Logger,
    },
  };
}

/** The markup shape the SDK styles: a `.form-group` holding a label and one input. */
function group(
  name: string,
  attrs = '',
  tag: 'input' | 'select' = 'input'
): string {
  const field =
    tag === 'select'
      ? `<select data-next-checkout-field="${name}" ${attrs}><option value="">Choose</option><option value="us">United States</option></select>`
      : `<input data-next-checkout-field="${name}" ${attrs}>`;
  return `<div class="form-group"><label class="label-checkout">Label</label><div class="form-input">${field}</div></div>`;
}

function fieldOf(ctx: FloatingLabelContext, name: string): HTMLInputElement {
  return ctx.form.querySelector(
    `[data-next-checkout-field="${name}"]`
  ) as HTMLInputElement;
}

function labelOf(ctx: FloatingLabelContext, name: string): HTMLLabelElement {
  return ctx.labels.get(fieldOf(ctx, name)) as HTMLLabelElement;
}

function stopPoll(ctx: FloatingLabelContext): void {
  if (ctx.periodicCheck.value) clearInterval(ctx.periodicCheck.value);
  ctx.periodicCheck.value = undefined;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('initializeFloatingLabels', () => {
  it('pairs every labelled field with its label and starts the autofill poll', () => {
    const { ctx } = createHarness(group('email') + group('fname'));

    initializeFloatingLabels(ctx);

    expect(ctx.labels.size).toBe(2);
    expect(ctx.periodicCheck.value).toBeDefined();
    stopPoll(ctx);
  });

  it('floats the label of a field that already holds a value', () => {
    const { ctx } = createHarness(group('email', 'value="a@b.com"'));

    initializeFloatingLabels(ctx);

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(true);
    expect(fieldOf(ctx, 'email').style.paddingTop).toBe('14px');
    stopPoll(ctx);
  });

  it('leaves the label of an empty field alone', () => {
    const { ctx } = createHarness(group('email'));

    initializeFloatingLabels(ctx);

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(false);
    stopPoll(ctx);
  });

  it('gives the label a transition so the float animates', () => {
    const { ctx } = createHarness(group('email'));

    initializeFloatingLabels(ctx);

    expect(labelOf(ctx, 'email').style.transition).toBe(
      'all 0.15s ease-in-out'
    );
    stopPoll(ctx);
  });

  it('registers the hosted card containers so Spreedly events can find them', () => {
    const { ctx } = createHarness(
      '<div class="form-group"><label class="label-checkout">Card</label><div id="spreedly-number"></div></div>'
    );

    initializeFloatingLabels(ctx);

    expect(
      ctx.labels.has(document.getElementById('spreedly-number') as HTMLElement)
    ).toBe(true);
    stopPoll(ctx);
  });

  /**
   * **Defect, left as found.** Each call starts a fresh 500 ms interval and overwrites the
   * id of the previous one, so a second `UIService.initialize()` orphans the first: it
   * keeps polling every field for the life of the page and `destroy()` can only ever clear
   * the last. Nothing calls `initialize()` twice today, which is why it has not bitten.
   *
   * Not fixed here: clearing the previous interval first is a behaviour change, small as
   * it is, and this extraction is a move.
   */
  it('orphans the previous poll when run twice (known defect)', () => {
    vi.useFakeTimers();
    const { ctx } = createHarness(group('email'));

    initializeFloatingLabels(ctx);
    const first = ctx.periodicCheck.value;
    initializeFloatingLabels(ctx);
    const second = ctx.periodicCheck.value;

    expect(first).not.toBe(second);

    // Clear the only id anyone can reach, then prove the orphan is still running: a value
    // written with no event still gets its label floated 500 ms later.
    stopPoll(ctx);
    fieldOf(ctx, 'email').value = 'a@b.com';
    vi.advanceTimersByTime(500);

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(true);
    if (first) clearInterval(first);
  });
});

describe('the autofill poll', () => {
  it('floats a label over a value that arrived with no event', () => {
    vi.useFakeTimers();
    const { ctx } = createHarness(group('email'));
    initializeFloatingLabels(ctx);

    fieldOf(ctx, 'email').value = 'a@b.com';
    vi.advanceTimersByTime(500);

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(true);
    stopPoll(ctx);
  });
});

describe('setupFloatingLabel', () => {
  it('floats the label as the shopper types and drops it when they clear the field', () => {
    const { ctx } = createHarness(group('email'));
    const field = fieldOf(ctx, 'email');
    setupFloatingLabel(ctx, field);

    field.value = 'a@b.com';
    field.dispatchEvent(new Event('input'));
    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(true);

    field.value = '';
    field.dispatchEvent(new Event('input'));
    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(false);
  });

  it('finds the label itself when none is passed', () => {
    const { ctx } = createHarness(group('email'));

    setupFloatingLabel(ctx, fieldOf(ctx, 'email'));

    expect(ctx.labels.size).toBe(1);
  });

  it('warns and gives up when the field has no label near it', () => {
    const { ctx, logger } = createHarness(
      '<input data-next-checkout-field="email">'
    );

    setupFloatingLabel(ctx, fieldOf(ctx, 'email'));

    expect(logger.warn).toHaveBeenCalledWith(
      'No label found for floating label setup'
    );
    expect(ctx.labels.size).toBe(0);
  });

  it('hides and restores the placeholder for a placeholder-behavior field', () => {
    const { ctx } = createHarness(
      group(
        'email',
        'data-label-behavior="placeholder" placeholder="you@example.com"'
      )
    );
    const field = fieldOf(ctx, 'email');
    setupFloatingLabel(ctx, field);

    field.dispatchEvent(new Event('focus'));
    expect(labelOf(ctx, 'email').classList.contains('is-focused')).toBe(true);
    expect(field.placeholder).toBe('');

    field.dispatchEvent(new Event('blur'));
    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(false);
    expect(field.placeholder).toBe('you@example.com');
  });

  it('does not float a default-behavior field on focus alone', () => {
    const { ctx } = createHarness(group('email'));
    const field = fieldOf(ctx, 'email');
    setupFloatingLabel(ctx, field);

    field.dispatchEvent(new Event('focus'));

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(false);
  });

  it('reacts to a change event, which is how a select and a password manager arrive', () => {
    const { ctx } = createHarness(group('country', '', 'select'));
    const field = ctx.form.querySelector(
      '[data-next-checkout-field="country"]'
    ) as HTMLSelectElement;
    setupFloatingLabel(ctx, field);

    field.value = 'us';
    field.dispatchEvent(new Event('change'));

    expect(
      (ctx.labels.get(field) as HTMLLabelElement).classList.contains(
        'has-value'
      )
    ).toBe(true);
  });

  it('treats a select still showing its first option as empty', () => {
    const { ctx } = createHarness(group('country', '', 'select'));
    const field = ctx.form.querySelector(
      '[data-next-checkout-field="country"]'
    ) as HTMLSelectElement;

    setupFloatingLabel(ctx, field);

    expect(
      (ctx.labels.get(field) as HTMLLabelElement).classList.contains(
        'has-value'
      )
    ).toBe(false);
  });

  it('picks up a Chrome autofill announced only by its animation', () => {
    vi.useFakeTimers();
    const { ctx } = createHarness(group('email'));
    const field = fieldOf(ctx, 'email');
    setupFloatingLabel(ctx, field);

    field.value = 'a@b.com';
    field.dispatchEvent(
      new AnimationEvent('animationstart', { animationName: 'autofill' })
    );
    vi.advanceTimersByTime(100);

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(true);
  });

  it('ignores an unrelated animation on the field', () => {
    vi.useFakeTimers();
    const { ctx } = createHarness(group('email'));
    const field = fieldOf(ctx, 'email');
    setupFloatingLabel(ctx, field);

    field.value = 'a@b.com';
    field.dispatchEvent(
      new AnimationEvent('animationstart', { animationName: 'shake' })
    );
    vi.advanceTimersByTime(100);

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(false);
  });
});

describe('updateLabelsForPopulatedData', () => {
  it('catches up every label after the SDK writes values into the form', () => {
    const { ctx } = createHarness(group('email') + group('fname'));
    setupFloatingLabel(ctx, fieldOf(ctx, 'email'));
    setupFloatingLabel(ctx, fieldOf(ctx, 'fname'));

    fieldOf(ctx, 'email').value = 'a@b.com';
    fieldOf(ctx, 'fname').value = 'Ada';
    updateLabelsForPopulatedData(ctx);

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(true);
    expect(labelOf(ctx, 'fname').classList.contains('has-value')).toBe(true);
  });
});

describe('the Spreedly bridge', () => {
  function cardHarness(behavior = 'placeholder'): Harness {
    const harness = createHarness(
      `<div class="form-group"><label class="label-checkout">Card</label><div id="spreedly-number" data-label-behavior="${behavior}"></div></div>`
    );
    initializeFloatingLabels(harness.ctx);
    stopPoll(harness.ctx);
    return harness;
  }

  it('floats the card label on focus', () => {
    const { ctx } = cardHarness();

    handleSpreedlyFieldFocus(ctx, 'number');

    const label = ctx.labels.get(
      document.getElementById('spreedly-number') as HTMLElement
    ) as HTMLLabelElement;
    expect(label.classList.contains('has-value')).toBe(true);
    expect(label.classList.contains('is-focused')).toBe(true);
  });

  it('drops the card label on blur when the iframe reports it empty', () => {
    const { ctx } = cardHarness();
    handleSpreedlyFieldFocus(ctx, 'number');

    handleSpreedlyFieldBlur(ctx, 'number', false);

    const label = ctx.labels.get(
      document.getElementById('spreedly-number') as HTMLElement
    ) as HTMLLabelElement;
    expect(label.classList.contains('has-value')).toBe(false);
  });

  it('keeps the card label floating on blur when the iframe reports a value', () => {
    const { ctx } = cardHarness();
    handleSpreedlyFieldFocus(ctx, 'number');

    handleSpreedlyFieldBlur(ctx, 'number', true);

    const label = ctx.labels.get(
      document.getElementById('spreedly-number') as HTMLElement
    ) as HTMLLabelElement;
    expect(label.classList.contains('has-value')).toBe(true);
  });

  it('floats on input for a default-behavior card field that has a value', () => {
    const { ctx } = cardHarness('default');

    handleSpreedlyFieldInput(ctx, 'number', true);

    const label = ctx.labels.get(
      document.getElementById('spreedly-number') as HTMLElement
    ) as HTMLLabelElement;
    expect(label.classList.contains('has-value')).toBe(true);
  });

  it('warns when the hosted field is not on the page', () => {
    const { ctx, logger } = createHarness('');

    handleSpreedlyFieldFocus(ctx, 'cvv');
    handleSpreedlyFieldBlur(ctx, 'cvv', false);
    handleSpreedlyFieldInput(ctx, 'cvv', false);

    expect(logger.warn).toHaveBeenCalledWith('Spreedly field not found: cvv');
    expect(logger.warn).toHaveBeenCalledTimes(3);
  });
});

describe('handleResponsiveUI', () => {
  function setViewport(width: number): void {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      configurable: true,
      writable: true,
    });
  }

  it('tags the form with the viewport it is on', () => {
    const { ctx } = createHarness(group('email'));

    setViewport(375);
    handleResponsiveUI(ctx);
    expect(ctx.form.classList.contains('next-mobile')).toBe(true);

    setViewport(900);
    handleResponsiveUI(ctx);
    expect(ctx.form.classList.contains('next-tablet')).toBe(true);
    expect(ctx.form.classList.contains('next-mobile')).toBe(false);

    setViewport(1400);
    handleResponsiveUI(ctx);
    expect(ctx.form.classList.contains('next-desktop')).toBe(true);
  });

  it('floats every label on focus on a phone, even an empty field', () => {
    setViewport(375);
    const { ctx } = createHarness(group('email'));
    setupFloatingLabel(ctx, fieldOf(ctx, 'email'));

    handleResponsiveUI(ctx);
    fieldOf(ctx, 'email').dispatchEvent(new Event('focus'));

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(true);
  });

  /**
   * The mobile rule is a branch inside the one `focus` handler `setupFloatingLabel`
   * registers, not a second handler of its own — so `UIService.destroy()` removes it
   * along with everything else it tracks (finding 169 in `docs/code-findings.md`).
   */
  it('stops floating labels on focus once every tracked listener is removed', () => {
    setViewport(375);
    const { ctx, events } = createHarness(group('email'));
    setupFloatingLabel(ctx, fieldOf(ctx, 'email'));
    handleResponsiveUI(ctx);

    events.removeAllHandlers();
    fieldOf(ctx, 'email').dispatchEvent(new Event('focus'));

    expect(labelOf(ctx, 'email').classList.contains('has-value')).toBe(false);
  });

  /**
   * A resize handler calls this on every crossing of the mobile breakpoint. It used to
   * attach a fresh `focus` handler to every tracked field each time, so the count grew
   * without bound; now it registers nothing at all.
   */
  it('registers no listener of its own, however often it runs', () => {
    setViewport(375);
    const { ctx } = createHarness(group('email'));
    setupFloatingLabel(ctx, fieldOf(ctx, 'email'));

    const field = fieldOf(ctx, 'email');
    const added = vi.spyOn(field, 'addEventListener');

    handleResponsiveUI(ctx);
    handleResponsiveUI(ctx);
    handleResponsiveUI(ctx);

    expect(added).not.toHaveBeenCalled();
  });
});

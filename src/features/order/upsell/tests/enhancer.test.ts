/**
 * Lifecycle tests for UpsellEnhancer, driven through the real DOM and the real
 * interaction handlers — only the stores, the API client and the modal/overlay
 * are mocked. These exist because the money path (what quantity actually
 * reaches `addUpsell`) was never exercised end to end; see findings 97–99 in
 * `docs/code-findings.md`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import type { IApiClient } from '@/api/client.types';
import { UpsellEnhancer } from '../upsell.enhancer';
import { useOrderStore } from '@/state/order';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';

vi.mock('@/state/order', () => ({
  useOrderStore: { getState: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));
vi.mock('@/state/campaign', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/state/config', () => ({
  useConfigStore: { getState: vi.fn() },
}));
/**
 * The enhancer never calls the API itself — it hands the client to
 * `orderStore.addUpsell`, which is mocked. So the only member this double owes is
 * the one `getApiClient()` reads back off the instance it memoizes. Typing it
 * `Pick<IApiClient, 'getApiKey'>` rather than `Partial<IApiClient>` is what makes
 * that a promise: `Partial` would still compile with the method gone.
 */
vi.mock('@/api/client', () => ({
  ApiClient: class implements Pick<IApiClient, 'getApiKey'> {
    public constructor(private readonly apiKey: string) {}
    public getApiKey(): string {
      return this.apiKey;
    }
  },
}));
vi.mock('@/core/ui/loading-overlay', () => ({
  LoadingOverlay: class {
    public show(): void {}
    public hide(_immediate?: boolean): void {}
  },
}));
vi.mock('@/core/ui/general-modal', () => ({
  GeneralModal: { showDuplicateUpsell: vi.fn().mockResolvedValue(true) },
}));

// ─── Harness ──────────────────────────────────────────────────────────────────

/** The shape of the order payload the enhancer is expected to submit. */
interface SubmittedPayload {
  lines: { package_id: number; quantity: number }[];
  currency: string;
}
type AddUpsell = (
  payload: SubmittedPayload,
  apiClient: IApiClient
) => Promise<unknown>;

/** Stand-in store objects: only the members the enhancer actually reads. */
function asOrderState(
  store: object
): ReturnType<typeof useOrderStore.getState> {
  return store as ReturnType<typeof useOrderStore.getState>;
}
function asCampaignState(
  store: object
): ReturnType<typeof useCampaignStore.getState> {
  return store as ReturnType<typeof useCampaignStore.getState>;
}
function asConfigState(
  store: object
): ReturnType<typeof useConfigStore.getState> {
  return store as ReturnType<typeof useConfigStore.getState>;
}

let addUpsell: Mock<AddUpsell>;
let enhancers: UpsellEnhancer[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  addUpsell = vi
    .fn<AddUpsell>()
    .mockResolvedValue({ ref_id: 'ord-9', lines: [] });
  vi.mocked(useOrderStore.getState).mockReturnValue(
    asOrderState({
      order: {
        ref_id: 'ord-9',
        supports_post_purchase_upsells: true,
        lines: [],
      },
      isProcessingUpsell: false,
      upsellError: null,
      completedUpsells: [],
      upsellJourney: [],
      canAddUpsells: () => true,
      addUpsell,
      setProcessingUpsell: vi.fn(),
      markUpsellViewed: vi.fn(),
      markUpsellPageViewed: vi.fn(),
      markUpsellSkipped: vi.fn(),
    })
  );
  vi.mocked(useOrderStore.subscribe).mockReturnValue(() => {});
  vi.mocked(useCampaignStore.getState).mockReturnValue(
    asCampaignState({ currency: 'USD', getPackage: () => undefined })
  );
  vi.mocked(useConfigStore.getState).mockReturnValue(
    asConfigState({ apiKey: 'test-key', getCurrency: () => 'USD' })
  );
});

afterEach(() => {
  enhancers.forEach(e => e.destroy());
  enhancers = [];
  document.body.innerHTML = '';
});

async function mount(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html;
  const el = document.body.querySelector<HTMLElement>('[data-next-upsell]');
  if (!el) throw new Error('test DOM has no [data-next-upsell] container');
  const enhancer = new UpsellEnhancer(el);
  enhancers.push(enhancer);
  await enhancer.initialize();
  return el;
}

function enhancerFor(el: HTMLElement): UpsellEnhancer {
  const found = enhancers[enhancers.length - 1];
  if (!found || (found as unknown as { element: HTMLElement }).element !== el)
    throw new Error('mount() and enhancerFor() are out of step');
  return found;
}

/** Lets the click handler's `await addUpsell(...)` chain settle. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function click(el: Element | null): void {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function submittedQuantity(): number {
  const call = addUpsell.mock.calls[0];
  if (!call) throw new Error('addUpsell was never called');
  const line = call[0].lines[0];
  if (!line) throw new Error('addUpsell was called with no lines');
  return line.quantity;
}

function displayText(el: HTMLElement): string | null {
  return (
    el.querySelector('[data-next-upsell-quantity="display"]')?.textContent ??
    null
  );
}

const ACCEPT = '[data-next-upsell-action="add"]';
const INCREASE = '[data-next-upsell-quantity="increase"]';

/** Selector-mode offer: one pre-selected option, quantity widgets, accept. */
function selectorHtml(quantityAttr?: string): string {
  return `
    <div data-next-upsell="offer" data-next-selector-id="s1"${
      quantityAttr ? ` data-next-quantity="${quantityAttr}"` : ''
    }>
      <div data-next-upsell-option data-next-package-id="10"
           data-next-selected="true"></div>
      <div data-next-upsell-option data-next-package-id="20"></div>
      <span data-next-upsell-quantity="display">1</span>
      <button data-next-upsell-quantity="decrease">-</button>
      <button data-next-upsell-quantity="increase">+</button>
      <button data-next-upsell-quantity-toggle="1">1x</button>
      <button data-next-upsell-quantity-toggle="3">3x</button>
      <button data-next-upsell-action="add">Add</button>
    </div>`;
}

/** Direct-mode offer: one package, quantity widgets, accept. */
function directHtml(quantityAttr?: string): string {
  return `
    <div data-next-upsell="offer" data-next-package-id="10"${
      quantityAttr ? ` data-next-quantity="${quantityAttr}"` : ''
    }>
      <span data-next-upsell-quantity="display">1</span>
      <button data-next-upsell-quantity="decrease">-</button>
      <button data-next-upsell-quantity="increase">+</button>
      <button data-next-upsell-quantity-toggle="1">1x</button>
      <button data-next-upsell-quantity-toggle="3">3x</button>
      <button data-next-upsell-action="add">Add</button>
    </div>`;
}

// ─── Finding 97: the submitted quantity must follow every input path ─────────

describe('UpsellEnhancer quantity — data-next-quantity attribute', () => {
  it('submits the attribute quantity in selector mode', async () => {
    const el = await mount(selectorHtml('3'));

    click(el.querySelector(ACCEPT));
    await flush();

    expect(submittedQuantity()).toBe(3);
  });

  it('submits the attribute quantity in direct mode', async () => {
    const el = await mount(directHtml('3'));

    click(el.querySelector(ACCEPT));
    await flush();

    expect(submittedQuantity()).toBe(3);
  });

  it('shows the attribute quantity in selector mode', async () => {
    const el = await mount(selectorHtml('3'));

    expect(displayText(el)).toBe('3');
  });

  it('marks the toggle matching the attribute quantity', async () => {
    const el = await mount(selectorHtml('3'));

    const toggle = el.querySelector('[data-next-upsell-quantity-toggle="3"]');
    expect(toggle?.classList.contains('next-selected')).toBe(true);
  });
});

describe('UpsellEnhancer quantity — +/- buttons', () => {
  it('steps up from the attribute quantity in selector mode', async () => {
    const el = await mount(selectorHtml('3'));

    click(el.querySelector(INCREASE));
    await flush();
    expect(displayText(el)).toBe('4');

    click(el.querySelector(ACCEPT));
    await flush();
    expect(submittedQuantity()).toBe(4);
  });

  it('steps up from the attribute quantity in direct mode', async () => {
    const el = await mount(directHtml('3'));

    click(el.querySelector(INCREASE));
    await flush();
    expect(displayText(el)).toBe('4');

    click(el.querySelector(ACCEPT));
    await flush();
    expect(submittedQuantity()).toBe(4);
  });

  it('steps up from the default quantity in selector mode', async () => {
    const el = await mount(selectorHtml());

    click(el.querySelector(INCREASE));
    click(el.querySelector(INCREASE));
    await flush();

    click(el.querySelector(ACCEPT));
    await flush();
    expect(submittedQuantity()).toBe(3);
  });

  it('steps up from the default quantity in direct mode', async () => {
    const el = await mount(directHtml());

    click(el.querySelector(INCREASE));
    click(el.querySelector(INCREASE));
    await flush();

    click(el.querySelector(ACCEPT));
    await flush();
    expect(submittedQuantity()).toBe(3);
  });

  it('moves the toggle highlight in selector mode', async () => {
    const el = await mount(selectorHtml());

    click(el.querySelector(INCREASE));
    click(el.querySelector(INCREASE));
    await flush();

    const toggles = el.querySelectorAll('[data-next-upsell-quantity-toggle]');
    expect(toggles[0]?.classList.contains('next-selected')).toBe(false);
    expect(toggles[1]?.classList.contains('next-selected')).toBe(true);
  });
});

describe('UpsellEnhancer quantity — quantity toggles', () => {
  it('submits the toggled quantity in selector mode', async () => {
    const el = await mount(selectorHtml());

    click(el.querySelector('[data-next-upsell-quantity-toggle="3"]'));
    await flush();
    expect(displayText(el)).toBe('3');

    click(el.querySelector(ACCEPT));
    await flush();
    expect(submittedQuantity()).toBe(3);
  });

  it('submits the toggled quantity in direct mode', async () => {
    const el = await mount(directHtml());

    click(el.querySelector('[data-next-upsell-quantity-toggle="3"]'));
    await flush();
    expect(displayText(el)).toBe('3');

    click(el.querySelector(ACCEPT));
    await flush();
    expect(submittedQuantity()).toBe(3);
  });

  it('lets a later +/- press step from the toggled quantity', async () => {
    const el = await mount(selectorHtml());

    click(el.querySelector('[data-next-upsell-quantity-toggle="3"]'));
    click(el.querySelector(INCREASE));
    await flush();
    expect(displayText(el)).toBe('4');

    click(el.querySelector(ACCEPT));
    await flush();
    expect(submittedQuantity()).toBe(4);
  });
});

// ─── Finding 98: destroy() must actually remove the listeners ────────────────

describe('UpsellEnhancer.destroy', () => {
  it('removes the action-button click listener', async () => {
    const el = await mount(directHtml());
    const accept = el.querySelector(ACCEPT);

    enhancerFor(el).destroy();
    enhancers = [];
    click(accept);
    await flush();

    expect(addUpsell).not.toHaveBeenCalled();
  });

  it('removes the quantity-button click listener', async () => {
    const el = await mount(directHtml());

    enhancerFor(el).destroy();
    enhancers = [];
    click(el.querySelector(INCREASE));
    await flush();

    expect(displayText(el)).toBe('1');
  });
});

// ─── Finding 99: update() must not double-wire ───────────────────────────────

describe('UpsellEnhancer.update', () => {
  it('leaves one quantity step per press after repeated updates', async () => {
    const el = await mount(directHtml());
    const enhancer = enhancerFor(el);

    enhancer.update();
    enhancer.update();
    click(el.querySelector(INCREASE));
    await flush();

    expect(displayText(el)).toBe('2');
  });

  it('leaves one submit per press after repeated updates', async () => {
    const el = await mount(directHtml());
    const enhancer = enhancerFor(el);

    enhancer.update();
    enhancer.update();
    click(el.querySelector(ACCEPT));
    await flush();

    expect(addUpsell).toHaveBeenCalledTimes(1);
  });

  it('wires an action button added after initialize', async () => {
    const el = await mount(directHtml());
    const late = document.createElement('button');
    late.setAttribute('data-next-upsell-action', 'add');
    el.appendChild(late);

    enhancerFor(el).update();
    click(late);
    await flush();

    expect(addUpsell).toHaveBeenCalledTimes(1);
  });
});

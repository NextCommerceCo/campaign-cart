/**
 * Builds and re-renders the debug overlay's shadow-DOM chrome: the host element,
 * its injected styles, the panel markup, and the 1-second auto-update poll.
 * Extracted verbatim from `debug-overlay.ts` — logic unchanged, only `this.foo`
 * became an explicit parameter (a `deps` object, or a plain value) and calls
 * between these functions are now direct calls instead of `this.foo()`.
 *
 * None of these functions touch `localStorage` — the overlay's persisted state
 * (expanded/active-panel/active-tab) is read and written by the methods that
 * stayed on `DebugOverlay` (see debug-overlay.ts for why).
 */
import { EnhancedDebugUI } from '../enhanced-debug-ui';
import { RawDataHelper } from '../panels';
import type { DebugPanel } from '../debug-panels';
import type { OverlayRenderDeps, AutoUpdateDeps } from './debug-overlay.types';

async function injectShadowStyles(shadowRoot: ShadowRoot): Promise<void> {
  // Load debug styles
  const { DebugStyleLoader } = await import('../debug-style-loader');
  const styles = await DebugStyleLoader.getDebugStyles();

  // Create style element in shadow DOM
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  shadowRoot.appendChild(styleElement);

  // Add reset styles to prevent inheritance
  const resetStyles = document.createElement('style');
  resetStyles.textContent = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #e0e0e0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    * {
      box-sizing: border-box;
    }

    /* Ensure debug overlay is always on top */
    .debug-overlay {
      position: fixed;
      z-index: 2147483647;
    }
  `;
  shadowRoot.appendChild(resetStyles);
}

export function updateOverlay(
  shadowRoot: ShadowRoot | null,
  deps: OverlayRenderDeps
): void {
  if (!shadowRoot) return;

  const overlayContainer = shadowRoot.querySelector('.debug-overlay');
  if (!overlayContainer) return;

  overlayContainer.innerHTML = EnhancedDebugUI.createOverlayHTML(
    deps.panels,
    deps.activePanel,
    deps.isExpanded,
    deps.activePanelTab
  );

  RawDataHelper.bindCopyHandlers(overlayContainer);
  deps.addEventListeners();

  // Restore button states
  deps.updateButtonStates();
}

export async function createOverlay(deps: OverlayRenderDeps): Promise<{
  container: HTMLDivElement;
  shadowRoot: ShadowRoot;
}> {
  // Create host container
  const container = document.createElement('div');
  container.id = 'next-debug-overlay-host';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2147483647;
    pointer-events: none;
  `;

  // Create Shadow DOM
  const shadowRoot = container.attachShadow({ mode: 'open' });

  // Load and inject styles into Shadow DOM
  await injectShadowStyles(shadowRoot);

  // Create overlay container inside shadow DOM
  const overlayContainer = document.createElement('div');
  overlayContainer.className = 'debug-overlay';
  overlayContainer.style.pointerEvents = 'auto';

  shadowRoot.appendChild(overlayContainer);

  // Render initial content
  updateOverlay(shadowRoot, deps);

  // Add event listeners
  deps.addEventListeners();

  document.body.appendChild(container);

  return { container, shadowRoot };
}

export function updateContent(
  shadowRoot: ShadowRoot | null,
  panels: DebugPanel[],
  activePanel: string,
  activePanelTab: string | undefined
): void {
  if (!shadowRoot) return;

  const panelContent = shadowRoot.querySelector('.panel-content');
  if (!panelContent) return;
  const active = panels.find(p => p.id === activePanel);
  if (!active) return;

  // A panel that re-renders on every keystroke (e.g. the Analytics search
  // box) would otherwise lose focus and caret position. Capture them before
  // swapping innerHTML and restore afterwards.
  const focused = shadowRoot.activeElement as HTMLInputElement | null;
  const search =
    focused && focused.matches?.('[data-debug-search]')
      ? { start: focused.selectionStart, end: focused.selectionEnd }
      : null;

  const tabs = active.getTabs?.() || [];
  if (tabs.length > 0) {
    // Panel has horizontal tabs - get content from active tab
    const activeTabId = activePanelTab || tabs[0]?.id;
    const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
    if (activeTab) {
      panelContent.innerHTML = activeTab.getContent();
      RawDataHelper.bindCopyHandlers(panelContent);
    }
  } else {
    // Panel doesn't have horizontal tabs - use regular content
    panelContent.innerHTML = active.getContent();
    RawDataHelper.bindCopyHandlers(panelContent);
  }

  if (search) {
    const input = panelContent.querySelector<HTMLInputElement>(
      '[data-debug-search]'
    );
    if (input) {
      input.focus();
      const end = input.value.length;
      try {
        input.setSelectionRange(search.start ?? end, search.end ?? end);
      } catch {
        // Some input types don't support selection ranges; focus is enough.
      }
    }
  }
}

export function startAutoUpdate(deps: AutoUpdateDeps): number {
  return window.setInterval(() => {
    // Only update quick stats, not the full content to avoid losing focus
    deps.updateQuickStats();

    // Only update content for specific panels that need real-time updates
    // Skip updates if viewing raw data tab to prevent constant re-renders.
    // Provider panels are intentionally excluded — they refresh on tracker
    // changes via scheduleProviderPanelRefresh(), not on this poll.
    const activePanel = deps.getActivePanel();
    if (
      (activePanel === 'cart' ||
        activePanel === 'config' ||
        activePanel === 'campaign') &&
      deps.getActivePanelTab() !== 'raw'
    ) {
      deps.updateContent();
    }
  }, 1000);
}

export function stopAutoUpdate(
  updateInterval: number | null,
  providerRefreshTimer: number | null
): { updateInterval: null; providerRefreshTimer: null } {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  if (providerRefreshTimer !== null) {
    clearTimeout(providerRefreshTimer);
  }
  return { updateInterval: null, providerRefreshTimer: null };
}

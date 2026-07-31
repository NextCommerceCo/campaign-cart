/**
 * Helper for generating raw data content with copy functionality.
 *
 * Renders syntax-highlighted JSON via highlight.js (core + json language only,
 * to keep the debug chunk small). Lives in the debug chunk via the manualChunks
 * override in vite.config.ts, so it never reaches the customer bundle.
 */

import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('json', json);

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Inline sunburst theme (by Vasily Polovnyov) — scoped to .raw-data-wrapper so
// it can't leak. The debug overlay lives in a shadow root anyway, but being
// explicit here means the helper is self-contained.
const HLJS_THEME_CSS = `
  .raw-data-wrapper .hljs { color: #f8f8f8; background: transparent; }
  .raw-data-wrapper .hljs-comment,
  .raw-data-wrapper .hljs-quote { color: #aeaeae; font-style: italic; }
  .raw-data-wrapper .hljs-keyword,
  .raw-data-wrapper .hljs-selector-tag,
  .raw-data-wrapper .hljs-type { color: #e28964; }
  .raw-data-wrapper .hljs-string { color: #65b042; }
  .raw-data-wrapper .hljs-subst { color: #daefa3; }
  .raw-data-wrapper .hljs-regexp,
  .raw-data-wrapper .hljs-link { color: #e9c062; }
  .raw-data-wrapper .hljs-title,
  .raw-data-wrapper .hljs-section,
  .raw-data-wrapper .hljs-tag,
  .raw-data-wrapper .hljs-name,
  .raw-data-wrapper .hljs-attr { color: #89bdff; }
  .raw-data-wrapper .hljs-symbol,
  .raw-data-wrapper .hljs-bullet,
  .raw-data-wrapper .hljs-number,
  .raw-data-wrapper .hljs-literal { color: #3387cc; }
  .raw-data-wrapper .hljs-attribute { color: #cda869; }
  .raw-data-wrapper .hljs-meta { color: #8996a8; }
  .raw-data-wrapper .hljs-punctuation { color: #cccccc; }
`;

export class RawDataHelper {
  public static generateRawDataContent(data: unknown): string {
    const dataStr = JSON.stringify(data, null, 2) ?? 'null';
    const highlighted = hljs.highlight(dataStr, { language: 'json' }).value;
    const copyPayload = escapeAttr(dataStr);

    return `
      <style>
        .raw-data-wrapper {
          position: relative;
          height: 100%;
          background: #0f0f0f;
          display: flex;
          flex-direction: column;
        }
        .copy-button {
          position: absolute;
          top: 10px;
          right: 24px;
          z-index: 10;
          width: 28px;
          height: 28px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          color: #c5c8c6;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .copy-button:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.18);
        }
        .copy-button:active { background: rgba(255, 255, 255, 0.16); }
        .copy-button.copied {
          background: rgba(76, 175, 80, 0.18);
          color: #98c379;
          border-color: rgba(152, 195, 121, 0.4);
        }
        .copy-button .icon-copied { display: none; }
        .copy-button.copied .icon-copy { display: none; }
        .copy-button.copied .icon-copied { display: inline; }
        .copy-button .copy-label {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
        .json-pre {
          flex: 1;
          margin: 0;
          padding: 16px 20px 24px;
          overflow: auto;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre;
        }
        ${HLJS_THEME_CSS}
      </style>
      <div class="raw-data-wrapper">
        <button
          type="button"
          class="copy-button"
          data-raw-copy="${copyPayload}"
          title="Copy JSON"
          aria-label="Copy JSON"
        >
          <svg class="icon-copy" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg class="icon-copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span class="copy-label">Copy</span>
        </button>
        <pre class="json-pre"><code class="hljs language-json">${highlighted}</code></pre>
      </div>
    `;
  }

  /**
   * Wire up the "Copy" button for any raw-data viewers inside `root`.
   * Idempotent — calling repeatedly is safe; existing listeners are not re-bound.
   */
  public static bindCopyHandlers(root: ParentNode): void {
    const buttons = root.querySelectorAll<HTMLButtonElement>('button[data-raw-copy]');
    buttons.forEach(btn => {
      if (btn.dataset.rawCopyBound === '1') return;
      btn.dataset.rawCopyBound = '1';
      btn.addEventListener('click', () => {
        const payload = btn.getAttribute('data-raw-copy') ?? '';
        const label = btn.querySelector<HTMLElement>('.copy-label');
        const originalLabel = label?.textContent ?? 'Copy';
        navigator.clipboard
          .writeText(payload)
          .then(() => {
            btn.classList.add('copied');
            if (label) label.textContent = 'Copied!';
            window.setTimeout(() => {
              btn.classList.remove('copied');
              if (label) label.textContent = originalLabel;
            }, 2000);
          })
          .catch(() => {
            if (label) label.textContent = 'Copy failed';
          });
      });
    });
  }
}

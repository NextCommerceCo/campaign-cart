import LZString from 'lz-string';
import type { Config } from './types';
import { LAYOUT_STYLES } from './constants';

export function normalizeApiHost(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return trimmed;
  }
}

export function sdkHostLabel(sdkHost: string): string {
  try {
    return new URL(sdkHost).hostname;
  } catch {
    return sdkHost;
  }
}

export function encodeCode(code: string): string {
  return LZString.compressToEncodedURIComponent(code);
}

export function decodeCode(encoded: string): string | null {
  return LZString.decompressFromEncodedURIComponent(encoded);
}

export function pushPresetParam(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('preset', id);
  url.searchParams.delete('code');
  window.history.pushState({}, '', url.toString());
}

export function wrapLayout(html: string, layout: string): string {
  const style = LAYOUT_STYLES[layout];
  if (!style) return html;
  return `<div class="playground-wrapper" style="${style}">${html}</div>`;
}

export function buildIframeHtml(userHtml: string, config: Config, layout = ''): string {
  if (layout === 'full_page') {
    return userHtml;
  }

  const sdkUrl = config.sdkHost
    ? `${config.sdkHost.replace(/\/$/, '')}/loader.js`
    : config.sdkVersion === 'latest' || !config.sdkVersion
      ? 'https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@latest/dist/loader.js'
      : `https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v${config.sdkVersion}/dist/loader.js`;

  const nextConfig = {
    sdkHost: config.sdkHost,
    debug: !!config.sdkHost,
    debugger: config.debugger,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(config.apiHost ? { apiHost: config.apiHost } : {}),
  };

  return `<!DOCTYPE html>
<html lang="en" style="background: transparent !important;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark">
  <style>
    body { background: transparent !important; margin: 0; }
  </style>
  <script>
    window.nextConfig = ${JSON.stringify(nextConfig, null, 2)};
  </script>
  <script type="module" src="${sdkUrl}"></script>
</head>
<body data-next-sdk-loading="true">
  ${wrapLayout(userHtml, layout)}
</body>
</html>`;
}

'use client';

import type { Config, Viewport } from './types';

export const DEFAULT_CONFIG: Config = {
  apiKey: 'kLGpgEfCX3iUZG16hpI5zrCH9qxcOdahDY1im6ud',
  apiHost: 'https://campaigns.apps.29next.com/',
  sdkHost: '',
  sdkVersion: 'latest',
  debugger: false,
};

export const LAYOUT_STYLES: Record<string, string> = {
  center: 'display: flex; align-items: center; justify-content: center; min-height: 100vh;',
};

export const VIEWPORTS: Record<Viewport, { label: string; width: number | null }> = {
  mobile:  { label: 'Mobile',  width: 390 },
  tablet:  { label: 'Tablet',  width: 768 },
  desktop: { label: 'Desktop', width: null },
};

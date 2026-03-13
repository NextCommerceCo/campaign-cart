export interface Config {
  apiKey: string;
  apiHost: string;
  sdkHost: string;
  sdkVersion: string;
  debugger: boolean;
}

export type Viewport = 'mobile' | 'tablet' | 'desktop';

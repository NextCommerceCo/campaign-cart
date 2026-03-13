import { useState, useEffect } from 'react';
import { decodeCode, normalizeApiHost } from '@/lib/playground/utils';
import { DEFAULT_CONFIG } from '@/lib/playground/constants';
import type { Config, Viewport } from '@/lib/playground/types';
import type { PlaygroundExample } from '@/lib/playground';

export interface PlaygroundState {
  currentExample: PlaygroundExample;
  code: string;
  layout: string;
  config: Config;
  showConfig: boolean;
  iframeSrc: string;
  viewport: Viewport;
  previewExpanded: boolean;
  editorWidthPct: number;
  isDragging: boolean;
  copied: boolean;
}

export interface PlaygroundStateActions {
  setCurrentExample: (e: PlaygroundExample) => void;
  setCode: (c: string) => void;
  setLayout: (l: string) => void;
  setConfig: (c: Config) => void;
  setShowConfig: (s: boolean) => void;
  setIframeSrc: (s: string) => void;
  setViewport: (v: Viewport) => void;
  setPreviewExpanded: (e: boolean) => void;
  setEditorWidthPct: (p: number) => void;
  setIsDragging: (d: boolean) => void;
  setCopied: (c: boolean) => void;
}

export function usePlaygroundState(
  examples: PlaygroundExample[],
): [PlaygroundState, PlaygroundStateActions] {
  const [currentExample, setCurrentExample] = useState<PlaygroundExample>(examples[0]);
  const [code, setCode] = useState(examples[0].code);
  const [layout, setLayout] = useState(examples[0].layout);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [iframeSrc, setIframeSrc] = useState('');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [editorWidthPct, setEditorWidthPct] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize from URL params and localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Resolve example + code from URL
    const preset = params.get('preset');
    const found = preset ? examples.find((e) => e.id === preset) : null;
    const example = found ?? examples[0];
    const encoded = params.get('code');
    const decoded = encoded ? decodeCode(encoded) : null;
    const initialCode = decoded ?? example.code;

    setCurrentExample(example);
    setCode(initialCode);
    setLayout(example.layout);

    // Resolve config from localStorage + query-string overrides
    try {
      const stored = localStorage.getItem('next-playground-config');
      const base: Config = stored ? JSON.parse(stored) : DEFAULT_CONFIG;

      const qs: Partial<Config> = {};
      if (params.has('apiKey')) qs.apiKey = params.get('apiKey')!;
      if (params.has('apiHost')) qs.apiHost = normalizeApiHost(params.get('apiHost')!);
      if (params.has('sdkHost')) qs.sdkHost = normalizeApiHost(params.get('sdkHost')!);
      if (params.has('sdkVersion')) qs.sdkVersion = params.get('sdkVersion')!;
      if (params.has('debugger')) qs.debugger = params.get('debugger') === 'true';

      // ?debug=true → enable debug and default sdkHost to localhost:3000 if not set
      if (params.get('debug') === 'true') {
        if (!qs.sdkHost && !base.sdkHost) qs.sdkHost = 'http://localhost:3000/';
      }

      const resolvedConfig = { ...base, ...qs };
      setConfig(resolvedConfig);
      localStorage.setItem('next-playground-config', JSON.stringify(resolvedConfig));

      // Remove config params from URL after applying them
      if (Object.keys(qs).length > 0) {
        const clean = new URL(window.location.href);
        for (const key of ['apiKey', 'apiHost', 'sdkHost', 'sdkVersion', 'debugger', 'debug']) {
          clean.searchParams.delete(key);
        }
        window.history.replaceState({}, '', clean.toString());
      }
    } catch {
      // fallback to default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state: PlaygroundState = {
    currentExample,
    code,
    layout,
    config,
    showConfig,
    iframeSrc,
    viewport,
    previewExpanded,
    editorWidthPct,
    isDragging,
    copied,
  };

  const actions: PlaygroundStateActions = {
    setCurrentExample,
    setCode,
    setLayout,
    setConfig,
    setShowConfig,
    setIframeSrc,
    setViewport,
    setPreviewExpanded,
    setEditorWidthPct,
    setIsDragging,
    setCopied,
  };

  return [state, actions];
}

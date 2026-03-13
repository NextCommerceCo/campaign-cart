import { useCallback, useRef } from 'react';
import { buildIframeHtml } from '@/lib/playground/utils';
import type { Config } from '@/lib/playground/types';

export function usePreviewUpdater(
  onIframeSrcChange: (src: string) => void,
): {
  runPreview: (html: string, cfg: Config, lyt: string) => void;
  handleCodeChange: (value: string | undefined, cfg: Config, lyt: string) => void;
} {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPreview = useCallback(
    (html: string, cfg: Config, lyt: string) => {
      const full = buildIframeHtml(html, cfg, lyt);
      const blob = new Blob([full], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      onIframeSrcChange(url);
    },
    [onIframeSrcChange],
  );

  const handleCodeChange = useCallback(
    (value: string | undefined, cfg: Config, lyt: string) => {
      const html = value ?? '';
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runPreview(html, cfg, lyt), 600);
    },
    [runPreview],
  );

  return { runPreview, handleCodeChange };
}

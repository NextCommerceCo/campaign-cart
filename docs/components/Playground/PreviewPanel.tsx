'use client';

import { ExternalLink, Maximize2, Minimize2, Smartphone, Tablet, Monitor } from 'lucide-react';
import React from 'react';
import { buildIframeHtml, sdkHostLabel } from '@/lib/playground/utils';
import { VIEWPORTS } from '@/lib/playground/constants';
import type { Viewport, Config } from '@/lib/playground/types';

interface PreviewPanelProps {
  iframeSrc: string;
  isDark: boolean;
  isDragging: boolean;
  viewport: Viewport;
  onViewportChange: (vp: Viewport) => void;
  onExpandToggle: () => void;
  expanded: boolean;
  config: Config;
  code: string;
  layout: string;
}

const VIEWPORT_ICONS: Record<Viewport, React.ReactNode> = {
  mobile: <Smartphone size={13} />,
  tablet: <Tablet size={13} />,
  desktop: <Monitor size={13} />,
};

export function PreviewPanel({
  iframeSrc,
  isDark,
  isDragging,
  viewport,
  onViewportChange,
  onExpandToggle,
  expanded,
  config,
  code,
  layout,
}: PreviewPanelProps) {
  return (
    <div className="flex-1 min-w-0 flex flex-col bg-fd-muted/20">
      <div className="px-3 py-1.5 border-b border-fd-border bg-fd-muted/30 flex items-center gap-2">
        {/* Left: label */}
        <span className="text-xs text-fd-muted-foreground font-mono w-16">Preview</span>
        {/* Center: viewport toggles */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1 rounded-md border border-fd-border bg-fd-background p-0.5">
            {(Object.keys(VIEWPORTS) as Viewport[]).map((vp) => {
              const { label } = VIEWPORTS[vp];
              return (
                <button
                  key={vp}
                  type="button"
                  title={label}
                  onClick={() => onViewportChange(vp)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    viewport === vp
                      ? 'bg-blue-600 text-white'
                      : 'text-fd-muted-foreground hover:text-fd-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1">{VIEWPORT_ICONS[vp]} {label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Right: expand toggle */}
        <div className="flex items-center gap-2 justify-end">
          {config.sdkHost && (
            <span
              title={`SDK Host: ${config.sdkHost}`}
              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-mono hidden xl:inline truncate max-w-[6rem]"
            >
              {sdkHostLabel(config.sdkHost)}
            </span>
          )}
          <button
            type="button"
            title="Open preview in new tab"
            onClick={() => {
              const html = buildIframeHtml(code, config, layout);
              const blob = new Blob([html], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            }}
            className="text-fd-muted-foreground hover:text-fd-foreground transition-colors"
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            title="Expand preview"
            onClick={onExpandToggle}
            className="text-fd-muted-foreground hover:text-fd-foreground transition-colors"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      {/* Scrollable container that centres a constrained iframe */}
      <div
        className="flex-1 min-h-0 overflow-auto flex justify-center"
        style={{
          backgroundColor: isDark ? '#0f1117' : '#f1f5f9',
          backgroundImage: isDark
            ? 'radial-gradient(circle, #2d3748 1px, transparent 1px)'
            : 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div
          className="h-full transition-all duration-200 rounded overflow-hidden"
          style={{
            width: VIEWPORTS[viewport].width ? `${VIEWPORTS[viewport].width}px` : '100%',
            minWidth: 0,
          }}
        >
          {iframeSrc && (
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              title="Preview"
              className="w-full h-full border-0 rounded"
              // sandbox="allow-same-origin allow-popups-to-escape-sandbox allow-scripts allow-popups allow-forms allow-pointer-lock allow-top-navigation allow-modals"
              style={isDragging ? { pointerEvents: 'none' } : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

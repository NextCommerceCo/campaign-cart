'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { PlaygroundExample } from '@/lib/playground';
import { ConfigModal } from '@/components/Playground/ConfigModal';
import { Sidebar } from '@/components/Playground/Sidebar';
import { TopBar } from '@/components/Playground/TopBar';
import { EditorPanel } from '@/components/Playground/EditorPanel';
import { PreviewPanel } from '@/components/Playground/PreviewPanel';
import { encodeCode, pushPresetParam } from '@/lib/playground/utils';
import { useDarkMode } from '@/hooks/useDarkMode';
import { usePlaygroundState } from '@/hooks/usePlaygroundState';
import { usePreviewUpdater } from '@/hooks/usePreviewUpdater';
import type { Config } from '@/lib/playground/types';

export function PlaygroundClient({ examples }: { examples: PlaygroundExample[] }) {
  const isDark = useDarkMode();
  const [state, actions] = usePlaygroundState(examples);
  const contentRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const prevIframeSrcRef = useRef<string>('');

  // Preview updater with debouncing
  const { runPreview, handleCodeChange } = usePreviewUpdater((url) => {
    // Revoke previous blob URL if exists
    if (prevIframeSrcRef.current) {
      URL.revokeObjectURL(prevIframeSrcRef.current);
    }
    prevIframeSrcRef.current = url;
    actions.setIframeSrc(url);
  });

  // Handle code changes with debouncing
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      actions.setCode(value ?? '');
      handleCodeChange(value, state.config, state.layout);
    },
    [state.config, state.layout, actions, handleCodeChange],
  );

  // Handle example selection
  const handleSelectExample = useCallback(
    (example: PlaygroundExample) => {
      actions.setCurrentExample(example);
      actions.setCode(example.code);
      actions.setLayout(example.layout);
      runPreview(example.code, state.config, example.layout);
      pushPresetParam(example.id);
    },
    [state.config, actions, runPreview],
  );

  // Handle share button
  const handleShare = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('preset', state.currentExample.id);
    if (state.code !== state.currentExample.code) {
      url.searchParams.set('code', encodeCode(state.code));
    } else {
      url.searchParams.delete('code');
    }
    if (state.config.apiKey) url.searchParams.set('apiKey', state.config.apiKey);
    if (state.config.apiHost) url.searchParams.set('apiHost', state.config.apiHost);
    if (state.config.sdkHost) url.searchParams.set('sdkHost', state.config.sdkHost);
    if (state.config.sdkVersion) url.searchParams.set('sdkVersion', state.config.sdkVersion);
    navigator.clipboard.writeText(url.toString()).then(() => {
      actions.setCopied(true);
      setTimeout(() => actions.setCopied(false), 2000);
    });
  }, [state.currentExample, state.code, state.config, actions]);

  // Handle config save
  const handleSaveConfig = useCallback(
    (newConfig: Config) => {
      actions.setConfig(newConfig);
      localStorage.setItem('next-playground-config', JSON.stringify(newConfig));
      runPreview(state.code, newConfig, state.layout);
    },
    [state.code, state.layout, actions, runPreview],
  );

  // Run preview when code/config/layout changes
  useEffect(() => {
    runPreview(state.code, state.config, state.layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.code, state.config, state.layout]);

  // Drag handle for editor/preview splitter
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    actions.setIsDragging(true);

    const container = contentRef.current;
    if (!container) return;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      actions.setEditorWidthPct(Math.min(80, Math.max(20, pct)));
    };

    const onUp = () => {
      isDraggingRef.current = false;
      actions.setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [actions]);

  return (
    <div className="flex flex-col h-screen bg-fd-background text-fd-foreground">
      {/* Top bar */}
      <TopBar
        onRun={() => runPreview(state.code, state.config, state.layout)}
        onReset={() => handleSelectExample(state.currentExample)}
        onShare={handleShare}
        onConfigOpen={() => actions.setShowConfig(true)}
        copied={state.copied}
      />

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          examples={examples}
          selected={state.currentExample}
          onSelect={handleSelectExample}
        />

        {/* Editor + Drag + Preview wrapper */}
        <div ref={contentRef} className="flex flex-1 min-w-0 min-h-0">
          {/* Editor */}
          <EditorPanel
            example={state.currentExample}
            code={state.code}
            isDark={isDark}
            isDragging={state.isDragging}
            editorWidthPct={state.editorWidthPct}
            expanded={state.previewExpanded}
            onCodeChange={handleEditorChange}
          />

          {/* Drag handle */}
          {!state.previewExpanded && (
            <div
              className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors bg-fd-border"
              onMouseDown={(e) => {
                e.preventDefault();
                handleDragStart();
              }}
            />
          )}

          {/* Preview */}
          <PreviewPanel
            iframeSrc={state.iframeSrc}
            isDark={isDark}
            isDragging={state.isDragging}
            viewport={state.viewport}
            onViewportChange={actions.setViewport}
            onExpandToggle={() => actions.setPreviewExpanded(!state.previewExpanded)}
            expanded={state.previewExpanded}
            config={state.config}
            code={state.code}
            layout={state.layout}
          />
        </div>
      </div>

      {/* Config modal */}
      {state.showConfig && (
        <ConfigModal
          config={state.config}
          onSave={handleSaveConfig}
          onClose={() => actions.setShowConfig(false)}
        />
      )}
    </div>
  );
}

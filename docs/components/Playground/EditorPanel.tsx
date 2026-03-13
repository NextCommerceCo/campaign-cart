'use client';

import Editor from '@monaco-editor/react';
import React from 'react';
import type { PlaygroundExample } from '@/lib/playground';

interface EditorPanelProps {
  example: PlaygroundExample;
  code: string;
  isDark: boolean;
  isDragging: boolean;
  editorWidthPct: number;
  expanded: boolean;
  onCodeChange: (value: string | undefined) => void;
}

export function EditorPanel({
  example,
  code,
  isDark,
  isDragging,
  editorWidthPct,
  expanded,
  onCodeChange,
}: EditorPanelProps) {
  if (expanded) return null;

  return (
    <div className="flex flex-col border-r border-fd-border min-w-0" style={{ width: `${editorWidthPct}%` }}>
      <div className="px-3 py-2 border-b border-fd-border bg-fd-muted/30 flex flex-col min-w-0">
        <span className="text-xs font-medium text-fd-foreground truncate">{example.title}</span>
        {example.description && (
          <span className="text-xs text-fd-muted-foreground">{example.description}</span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="html"
          theme={isDark ? 'vs-dark' : 'vs-light'}
          value={code}
          onChange={onCodeChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'gutter',
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}

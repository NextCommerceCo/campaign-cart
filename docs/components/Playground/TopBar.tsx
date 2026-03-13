'use client';

import { Check, ChevronLeft, Link, Play, RotateCcw, Settings } from 'lucide-react';
import React from 'react';

interface TopBarProps {
  onRun: () => void;
  onReset: () => void;
  onShare: () => void;
  onConfigOpen: () => void;
  copied: boolean;
}

export function TopBar({ onRun, onReset, onShare, onConfigOpen, copied }: TopBarProps) {
  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-fd-border shrink-0">
      <a href="/docs" className="flex items-center gap-1 text-fd-muted-foreground hover:text-fd-foreground text-sm">
        <ChevronLeft size={14} /> Docs
      </a>
      <span className="text-fd-border">|</span>
      <span className="font-semibold text-sm">Playground</span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          <Play size={11} /> Run
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-fd-border hover:bg-fd-muted rounded-md text-fd-foreground"
        >
          <RotateCcw size={11} /> Reset
        </button>
        <button
          type="button"
          onClick={onShare}
          title="Copy share link"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-fd-border hover:bg-fd-muted rounded-md text-fd-foreground"
        >
          {copied ? <Check size={11} className="text-emerald-500" /> : <Link size={11} />}
          {copied ? 'Copied!' : 'Share'}
        </button>
        <button
          type="button"
          onClick={onConfigOpen}
          title="SDK configuration"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-fd-border hover:bg-fd-muted rounded-md text-fd-foreground"
        >
          <Settings size={11} /> Config
        </button>
      </div>
    </header>
  );
}

'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import type { PlaygroundExample } from '@/lib/playground';

interface SidebarProps {
  examples: PlaygroundExample[];
  selected: PlaygroundExample;
  onSelect: (e: PlaygroundExample) => void;
}

export function Sidebar({ examples, selected, onSelect }: SidebarProps) {
  const categories = [...new Set(examples.map((e) => e.category))];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCategory = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="w-52 shrink-0 border-r border-fd-border bg-fd-background flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto py-4">
        {categories.map((cat) => {
          const isOpen = !collapsed[cat];
          const items = examples.filter((e) => e.category === cat);
          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium text-fd-foreground hover:bg-fd-muted transition-colors"
              >
                {cat}
                {isOpen ? <ChevronDown size={14} className="text-fd-muted-foreground" /> : <ChevronRight size={14} className="text-fd-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="mb-1">
                  {items.map((example) => {
                    const isActive = selected.id === example.id;
                    return (
                      <button
                        key={example.id}
                        type="button"
                        onClick={() => onSelect(example)}
                        className={`w-full text-left pl-6 pr-3 py-1.5 text-sm transition-colors border-l-2 ${
                          isActive
                            ? 'border-l-blue-500 text-fd-foreground font-medium bg-fd-muted/50'
                            : 'border-l-transparent text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted/40'
                        }`}
                      >
                        {example.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

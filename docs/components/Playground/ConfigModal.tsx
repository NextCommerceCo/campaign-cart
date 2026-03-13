'use client';

import { ChevronRight, X } from 'lucide-react';
import React, { useState } from 'react';
import { normalizeApiHost } from '@/lib/playground/utils';
import type { Config } from '@/lib/playground/types';

interface ConfigModalProps {
  config: Config;
  onSave: (c: Config) => void;
  onClose: () => void;
}

export function ConfigModal({ config, onSave, onClose }: ConfigModalProps) {
  const [draft, setDraft] = useState(config);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-fd-background border border-fd-border rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-fd-foreground text-lg">SDK Configuration</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-fd-muted-foreground hover:text-fd-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-fd-foreground">API Key</span>
            <input
              type="text"
              className="mt-1 w-full px-3 py-2 bg-fd-background border border-fd-border rounded-lg text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your-api-key"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            />
            <p className="mt-1 text-xs text-fd-muted-foreground">
              Sets <code>window.nextConfig.apiKey</code> in the preview.
            </p>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-fd-foreground">SDK Version</span>
            <input
              type="text"
              className="mt-1 w-full px-3 py-2 bg-fd-background border border-fd-border rounded-lg text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="latest"
              value={draft.sdkVersion}
              onChange={(e) => setDraft({ ...draft, sdkVersion: e.target.value })}
            />
            <p className="mt-1 text-xs text-fd-muted-foreground">
              e.g. <code>latest</code> or <code>0.2.10</code>
            </p>
          </label>

          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-sm font-medium text-fd-foreground">Debugger</span>
              <p className="text-xs text-fd-muted-foreground">Show the SDK debug overlay in the preview.</p>
            </div>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, debugger: !d.debugger }))}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                draft.debugger ? 'bg-blue-600' : 'bg-fd-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                  draft.debugger ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Advanced section */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors"
            >
              <ChevronRight size={12} className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              Advanced
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 border-l-2 border-fd-border pl-4">
                <label className="block">
                  <span className="text-sm font-medium text-fd-foreground">API Host</span>
                  <input
                    type="text"
                    className="mt-1 w-full px-3 py-2 bg-fd-background border border-fd-border rounded-lg text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://campaigns.apps.29next.com/"
                    value={draft.apiHost}
                    onChange={(e) => setDraft({ ...draft, apiHost: e.target.value })}
                    onBlur={(e) => setDraft((d) => ({ ...d, apiHost: normalizeApiHost(e.target.value) }))}
                  />
                  <p className="mt-1 text-xs text-fd-muted-foreground">
                    Any path will be stripped automatically.
                  </p>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-fd-foreground">SDK Host</span>
                  <input
                    type="text"
                    className="mt-1 w-full px-3 py-2 bg-fd-background border border-fd-border rounded-lg text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="http://localhost:3000/"
                    value={draft.sdkHost}
                    onChange={(e) => setDraft({ ...draft, sdkHost: e.target.value })}
                    onBlur={(e) => setDraft((d) => ({ ...d, sdkHost: normalizeApiHost(e.target.value) }))}
                  />
                  <p className="mt-1 text-xs text-fd-muted-foreground">
                    Override the SDK loader host. Leave blank to use the CDN.
                  </p>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-fd-muted-foreground hover:text-fd-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
}

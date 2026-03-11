"use client";

import Editor from "@monaco-editor/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Monitor,
  Play,
  RotateCcw,
  Settings,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PlaygroundExample } from "@/lib/playground";

// ── Config modal ──────────────────────────────────────────────────────────────

interface Config {
  apiKey: string;
  apiHost: string;
  sdkHost: string;
  sdkVersion: string;
  debugger: boolean;
}

const DEFAULT_CONFIG: Config = {
  apiKey: "FQqAM3Qj3ijsq3tSR5cC6NaS8u6NFO95Xq3rIQhO",
  apiHost: "https://campaign.midless.dev/",
  sdkHost: "https://sdk.midless.dev/",
  sdkVersion: "latest",
  debugger: false,
};

function normalizeApiHost(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    const withProto = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProto);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return trimmed;
  }
}

function sdkHostLabel(sdkHost: string): string {
  try {
    return new URL(sdkHost).hostname;
  } catch {
    return sdkHost;
  }
}

function ConfigModal({
  config,
  onSave,
  onClose,
}: {
  config: Config;
  onSave: (c: Config) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(config);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-fd-background border border-fd-border rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-fd-foreground text-lg">
            SDK Configuration
          </h2>
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
            <span className="text-sm font-medium text-fd-foreground">
              API Key
            </span>
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
            <span className="text-sm font-medium text-fd-foreground">
              SDK Version
            </span>
            <input
              type="text"
              className="mt-1 w-full px-3 py-2 bg-fd-background border border-fd-border rounded-lg text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="latest"
              value={draft.sdkVersion}
              onChange={(e) =>
                setDraft({ ...draft, sdkVersion: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-fd-muted-foreground">
              e.g. <code>latest</code> or <code>0.2.10</code>
            </p>
          </label>

          {/* Advanced section */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors"
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              />
              Advanced
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 border-l-2 border-fd-border pl-4">
                <label className="block">
                  <span className="text-sm font-medium text-fd-foreground">
                    API Host
                  </span>
                  <input
                    type="text"
                    className="mt-1 w-full px-3 py-2 bg-fd-background border border-fd-border rounded-lg text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://campaigns.apps.29next.com/"
                    value={draft.apiHost}
                    onChange={(e) =>
                      setDraft({ ...draft, apiHost: e.target.value })
                    }
                    onBlur={(e) =>
                      setDraft((d) => ({
                        ...d,
                        apiHost: normalizeApiHost(e.target.value),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-fd-muted-foreground">
                    Any path will be stripped automatically.
                  </p>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-fd-foreground">
                    SDK Host
                  </span>
                  <input
                    type="text"
                    className="mt-1 w-full px-3 py-2 bg-fd-background border border-fd-border rounded-lg text-sm text-fd-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="http://localhost:3000/"
                    value={draft.sdkHost}
                    onChange={(e) =>
                      setDraft({ ...draft, sdkHost: e.target.value })
                    }
                    onBlur={(e) =>
                      setDraft((d) => ({
                        ...d,
                        sdkHost: normalizeApiHost(e.target.value),
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-fd-muted-foreground">
                    Override the SDK loader host. Leave blank to use the CDN.
                  </p>
                </label>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-sm font-medium text-fd-foreground">
                      Debugger
                    </span>
                    <p className="text-xs text-fd-muted-foreground">
                      Show the SDK debug overlay in the preview.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, debugger: !d.debugger }))
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      draft.debugger ? "bg-blue-600" : "bg-fd-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                        draft.debugger ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
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

// ── Build the full iframe HTML ────────────────────────────────────────────────

const LAYOUT_STYLES: Record<string, string> = {
  center:
    "display: flex; align-items: center; justify-content: center; min-height: 100vh;",
};

function wrapLayout(html: string, layout: string): string {
  const style = LAYOUT_STYLES[layout];
  if (!style) return html;
  return `<div class="playground-wrapper" style="${style}">${html}</div>`;
}

function buildIframeHtml(
  userHtml: string,
  config: Config,
  layout = "",
): string {
  const sdkUrl = config.sdkHost
    ? `${config.sdkHost.replace(/\/$/, "")}/loader.js`
    : config.sdkVersion === "latest" || !config.sdkVersion
      ? "https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@latest/dist/loader.js"
      : `https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v${config.sdkVersion}/dist/loader.js`;

  const nextConfig = {
    sdkHost: config.sdkHost,
    debug: !!config.sdkHost,
    debugger: config.debugger,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(config.apiHost ? { apiHost: config.apiHost } : {}),
  };

  return `<!DOCTYPE html>
<html lang="en" style="background: transparent !important;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark">
  <style>
    body { background: transparent !important; margin: 0; }
  </style>
  <script>
    window.nextConfig = ${JSON.stringify(nextConfig, null, 2)};
  </script>
  <script type="module" src="${sdkUrl}"></script>
</head>
<body>
  ${wrapLayout(userHtml, layout)}
</body>
</html>`;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  examples,
  selected,
  onSelect,
}: {
  examples: PlaygroundExample[];
  selected: PlaygroundExample;
  onSelect: (e: PlaygroundExample) => void;
}) {
  const categories = [...new Set(examples.map((e) => e.category))];
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

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
                {isOpen ? (
                  <ChevronDown size={14} className="text-fd-muted-foreground" />
                ) : (
                  <ChevronRight
                    size={14}
                    className="text-fd-muted-foreground"
                  />
                )}
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
                            ? "border-l-blue-500 text-fd-foreground font-medium bg-fd-muted/50"
                            : "border-l-transparent text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted/40"
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

// ── Main playground ───────────────────────────────────────────────────────────

type Viewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: Record<
  Viewport,
  { label: string; width: number | null; icon: React.ReactNode }
> = {
  mobile: { label: "Mobile", width: 390, icon: <Smartphone size={13} /> },
  tablet: { label: "Tablet", width: 768, icon: <Tablet size={13} /> },
  desktop: { label: "Desktop", width: null, icon: <Monitor size={13} /> },
};

export function PlaygroundClient({
  examples,
}: {
  examples: PlaygroundExample[];
}) {
  const [currentExample, setCurrentExample] = useState<PlaygroundExample>(
    examples[0],
  );
  const [code, setCode] = useState(examples[0].code);
  const [layout, setLayout] = useState(examples[0].layout);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [iframeSrc, setIframeSrc] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [editorWidthPct, setEditorWidthPct] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Load config from localStorage, with query-string sdkHost taking precedence
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qsSdkHost = params.get("sdkHost")
        ? normalizeApiHost(params.get("sdkHost")!)
        : null;
      const stored = localStorage.getItem("next-playground-config");
      const base: Config = stored ? JSON.parse(stored) : DEFAULT_CONFIG;
      setConfig(qsSdkHost ? { ...base, sdkHost: qsSdkHost } : base);
    } catch {}
  }, []);

  const runPreview = useCallback((html: string, cfg: Config, lyt: string) => {
    const full = buildIframeHtml(html, cfg, lyt);
    const blob = new Blob([full], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setIframeSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  // Run preview on mount
  useEffect(() => {
    runPreview(code, config, layout);
    // cleanup on unmount
    return () => {
      setIframeSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-run on code change
  const handleCodeChange = (value: string | undefined) => {
    const html = value ?? "";
    setCode(html);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => runPreview(html, config, layout),
      600,
    );
  };

  const handleSelectExample = (example: PlaygroundExample) => {
    setCurrentExample(example);
    setCode(example.code);
    setLayout(example.layout);
    runPreview(example.code, config, example.layout);
  };

  const handleSaveConfig = (newConfig: Config) => {
    setConfig(newConfig);
    localStorage.setItem("next-playground-config", JSON.stringify(newConfig));
    runPreview(code, newConfig, layout);
  };

  return (
    <div className="flex flex-col h-screen bg-fd-background text-fd-foreground">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-fd-border shrink-0">
        <a
          href="/docs"
          className="flex items-center gap-1 text-fd-muted-foreground hover:text-fd-foreground text-sm"
        >
          <ChevronLeft size={14} /> Docs
        </a>
        <span className="text-fd-border">|</span>
        <span className="font-semibold text-sm">Playground</span>
        {currentExample && (
          <>
            <span className="text-fd-border">·</span>
            <span className="text-sm text-fd-muted-foreground">
              {currentExample.title}
            </span>
            {currentExample.description && (
              <span className="text-xs text-fd-muted-foreground hidden md:inline truncate max-w-xs">
                — {currentExample.description}
              </span>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => runPreview(code, config, layout)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            <Play size={11} /> Run
          </button>
          <button
            type="button"
            onClick={() => handleSelectExample(currentExample)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-fd-border hover:bg-fd-muted rounded-md text-fd-foreground"
          >
            <RotateCcw size={11} /> Reset
          </button>
          <button
            type="button"
            onClick={() => setShowConfig(true)}
            title="SDK configuration"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-fd-border hover:bg-fd-muted rounded-md text-fd-foreground"
          >
            <Settings size={11} /> Config
            {config.apiKey && (
              <span className="text-fd-muted-foreground">
                ({config.apiKey})
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          examples={examples}
          selected={currentExample}
          onSelect={handleSelectExample}
        />

        {/* Editor + Drag + Preview wrapper */}
        <div ref={contentRef} className="flex flex-1 min-w-0 min-h-0">
          {/* Editor */}
          {!previewExpanded && (
            <div
              className="flex flex-col border-r border-fd-border min-w-0"
              style={{ width: `${editorWidthPct}%` }}
            >
              <div className="px-3 py-1.5 border-b border-fd-border bg-fd-muted/30">
                <span className="text-xs text-fd-muted-foreground font-mono">
                  HTML
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language="html"
                  theme={isDark ? "vs-dark" : "vs-light"}
                  value={code}
                  onChange={handleCodeChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    renderLineHighlight: "gutter",
                    tabSize: 2,
                  }}
                />
              </div>
            </div>
          )}

          {/* Drag handle */}
          {!previewExpanded && (
            <div
              className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors bg-fd-border"
              onMouseDown={(e) => {
                e.preventDefault();
                isDraggingRef.current = true;
                setIsDragging(true);
                const container = contentRef.current;
                if (!container) return;
                const onMove = (ev: MouseEvent) => {
                  if (!isDraggingRef.current) return;
                  const rect = container.getBoundingClientRect();
                  const pct = ((ev.clientX - rect.left) / rect.width) * 100;
                  setEditorWidthPct(Math.min(80, Math.max(20, pct)));
                };
                const onUp = () => {
                  isDraggingRef.current = false;
                  setIsDragging(false);
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
          )}

          {/* Preview */}
          <div className="flex-1 min-w-0 flex flex-col bg-fd-muted/20">
            <div className="px-3 py-1.5 border-b border-fd-border bg-fd-muted/30 flex items-center gap-2">
              {/* Left: label */}
              <span className="text-xs text-fd-muted-foreground font-mono w-16">
                Preview
              </span>
              {/* Center: viewport toggles */}
              <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-1 rounded-md border border-fd-border bg-fd-background p-0.5">
                  {(Object.keys(VIEWPORTS) as Viewport[]).map((vp) => {
                    const { label, icon } = VIEWPORTS[vp];
                    return (
                      <button
                        key={vp}
                        type="button"
                        title={label}
                        onClick={() => setViewport(vp)}
                        className={`px-2 py-0.5 text-xs rounded transition-colors ${
                          viewport === vp
                            ? "bg-blue-600 text-white"
                            : "text-fd-muted-foreground hover:text-fd-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {icon} {label}
                        </span>
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
                  title="Expand preview"
                  onClick={() => setPreviewExpanded((v) => !v)}
                  className="text-fd-muted-foreground hover:text-fd-foreground transition-colors"
                >
                  {previewExpanded ? (
                    <Minimize2 size={14} />
                  ) : (
                    <Maximize2 size={14} />
                  )}
                </button>
              </div>
            </div>
            {/* Scrollable container that centres a constrained iframe */}
            <div
              className="flex-1 min-h-0 overflow-auto flex justify-center"
              style={{
                backgroundColor: isDark ? "#0f1117" : "#f1f5f9",
                backgroundImage: isDark
                  ? "radial-gradient(circle, #2d3748 1px, transparent 1px)"
                  : "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              <div
                className="h-full transition-all duration-200 rounded overflow-hidden"
                style={{
                  width: VIEWPORTS[viewport].width
                    ? `${VIEWPORTS[viewport].width}px`
                    : "100%",
                  minWidth: 0,
                }}
              >
                {iframeSrc && (
                  <iframe
                    key={iframeSrc}
                    src={iframeSrc}
                    title="Preview"
                    className="w-full h-full border-0 rounded"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    style={{ pointerEvents: isDragging ? "none" : "auto" }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        {/* end contentRef wrapper */}
      </div>

      {showConfig && (
        <ConfigModal
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}

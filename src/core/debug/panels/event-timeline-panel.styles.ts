/**
 * CSS for the debug overlay's event-timeline panel.
 *
 * Returned as a complete `<style>` element because the panel renders into the
 * overlay by string concatenation, not by mounting a stylesheet. The one piece
 * that is not static is the recording indicator, which is why this takes the
 * recording flag rather than being a plain constant.
 *
 * @internal
 */
export function eventTimelinePanelStyles(isRecording: boolean): string {
  return `
      <style>
        .events-table-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #0f0f0f;
          position: relative; /* anchors the filter drawer */
        }
        /* Modal Styles */
        .event-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000;
          backdrop-filter: blur(4px);
        }
        .event-modal {
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 90%;
          max-width: 800px;
          /* Definite height (not just max) so the flex chain has room to give
             the payload viewer — otherwise it collapses to its min-height. */
          height: 85vh;
          max-height: 820px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        }
        .event-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .event-modal-title {
          margin: 0;
          font-size: 1.2em;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }
        .event-modal-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .event-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }
        .event-modal-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 20px;
        }
        /* Compact single-row meta strip with divider between items. */
        .event-modal-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          row-gap: 6px;
          margin-bottom: 18px;
          font-size: 0.85em;
        }
        .event-modal-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px;
          color: #e6e6e6;
        }
        .event-modal-meta-item:first-child { padding-left: 0; }
        .event-modal-meta-item + .event-modal-meta-item {
          border-left: 1px solid rgba(255, 255, 255, 0.12);
        }
        .event-modal-meta-label {
          color: rgba(255, 255, 255, 0.45);
        }
        .event-modal-meta-muted { color: rgba(255, 255, 255, 0.4); }
        /* ── Provider strip ── */
        .provider-strip {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px 20px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.85em;
        }
        .provider-strip-empty { color: rgba(255, 255, 255, 0.5); }
        .provider-strip-label {
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 0.8em;
          margin-right: 4px;
        }
        .provider-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 9px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #e6e6e6;
          cursor: pointer;
          font: inherit;
          transition: background 0.15s, border-color 0.15s;
        }
        .provider-chip:hover { background: rgba(255, 255, 255, 0.12); }
        .provider-chip.active {
          background: rgba(60, 125, 255, 0.22);
          border-color: #3C7DFF;
          color: #fff;
        }
        .provider-chip-icon { font-size: 0.9em; }
        .provider-chip-brand {
          display: inline-flex;
          align-items: center;
          opacity: 0.95;
        }
        /* ── Filter controls ── */
        .events-search-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .events-search-icon { font-size: 0.85em; opacity: 0.6; }
        .events-search {
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font: inherit;
          font-size: 0.85em;
          width: 150px;
        }
        .events-search::placeholder { color: rgba(255, 255, 255, 0.4); }
        .filter-toggle {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.75);
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.82em;
          transition: all 0.15s;
        }
        .filter-toggle:hover { color: #fff; }
        .filter-toggle.active {
          background: rgba(214, 167, 0, 0.2);
          border-color: #d6a700;
          color: #ffd84d;
        }
        .filter-clear {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          font-size: 0.82em;
          text-decoration: underline;
        }
        .filter-clear:hover { color: #fff; }
        /* ── Filter button (opens drawer) ── */
        .filter-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          font: inherit;
          font-size: 0.85em;
          transition: all 0.15s;
        }
        .filter-button:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
        .filter-button.open,
        .filter-button.active {
          border-color: #3C7DFF;
          color: #fff;
        }
        .filter-button.active { background: rgba(60, 125, 255, 0.18); }
        .filter-button-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 17px;
          height: 17px;
          padding: 0 5px;
          border-radius: 9px;
          background: #3C7DFF;
          color: #fff;
          font-size: 0.72em;
          font-weight: 700;
        }
        /* ── Filter drawer (right side) ── */
        .filter-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 20;
        }
        .filter-drawer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 290px;
          max-width: 85%;
          z-index: 21;
          background: #161616;
          border-left: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          animation: filter-drawer-in 0.16s ease-out;
        }
        @keyframes filter-drawer-in {
          from { transform: translateX(12px); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
        .filter-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .filter-drawer-title {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #fff;
          font-weight: 600;
          font-size: 0.95em;
        }
        .filter-drawer-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 2px;
          display: inline-flex;
        }
        .filter-drawer-close:hover { color: #fff; }
        .filter-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .filter-section { display: flex; flex-direction: column; gap: 8px; }
        .filter-label {
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 0.72em;
          font-weight: 600;
        }
        .filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          font: inherit;
          font-size: 0.82em;
          transition: all 0.15s;
        }
        .filter-chip:hover { color: #fff; }
        .filter-chip.active {
          background: rgba(60, 125, 255, 0.22);
          border-color: #3C7DFF;
          color: #fff;
        }
        .filter-row-toggle {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 8px;
          border-radius: 6px;
          background: none;
          border: 1px solid transparent;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          font: inherit;
          font-size: 0.85em;
          text-align: left;
          width: 100%;
        }
        .filter-row-toggle:hover { background: rgba(255, 255, 255, 0.05); }
        .filter-row-toggle.active { color: #fff; }
        .filter-checkbox {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          flex-shrink: 0;
        }
        .filter-row-toggle.active .filter-checkbox {
          background: #3C7DFF;
          border-color: #3C7DFF;
          color: #fff;
        }
        .filter-drawer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .filter-hint { color: rgba(255, 255, 255, 0.45); font-size: 0.8em; }
        .delivery-count { display: inline-flex; align-items: center; gap: 2px; }
        /* ── Per-row delivery summary (provider chips) ── */
        .delivery-summary {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-left: 8px;
          vertical-align: middle;
        }
        .delivery-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          border-radius: 9px;
          font-size: 0.72em;
          font-weight: 600;
          line-height: 1.5;
          color: var(--chip, #9aa0a6);
          background: color-mix(in srgb, var(--chip, #9aa0a6) 16%, transparent);
          border: 1px solid
            color-mix(in srgb, var(--chip, #9aa0a6) 38%, transparent);
        }
        .delivery-chip-name { letter-spacing: 0.02em; }
        /* ── Detail modal tabs ── */
        .detail-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 12px;
        }
        .detail-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255, 255, 255, 0.6);
          padding: 8px 14px;
          cursor: pointer;
          font-size: 0.9em;
          transition: color 0.15s, border-color 0.15s;
        }
        .detail-tab:hover { color: rgba(255, 255, 255, 0.9); }
        .detail-tab.active {
          color: #fff;
          border-bottom-color: #3C7DFF;
        }
        .tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 0.75em;
        }
        .tab-count-error { background: #e3342f; }
        .tab-count-warning { background: #d6a700; color: #1a1a1a; }
        /* Fills the modal below the tabs so the payload viewer can grow. */
        .detail-tab-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        /* Flow: the JSON viewer is the single scroll region — a scroll container
           here would break the flex height chain the viewer depends on. */
        .detail-tab-body-flow {
          overflow: hidden;
        }
        /* Validation: content is a plain list, so this tab scrolls itself. */
        .detail-tab-body-validation {
          overflow-y: auto;
        }
        /* ── Flow tab: node graph (source → providers) ── */
        /* Column that lets the payload viewer below the graph grow to fill. */
        .flow {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
          min-height: 0;
        }
        .flow-graph {
          display: flex;
          align-items: center;
          gap: 0;
        }
        .flow-graph-solo { justify-content: flex-start; }
        .flow-col { display: flex; flex-direction: column; }
        .flow-col-source { flex: 0 0 auto; }
        .flow-col-wire { flex: 0 0 auto; }
        .flow-col-providers {
          flex: 1 1 auto;
          gap: 8px; /* == FLOW_NODE_GAP */
          min-width: 0;
        }
        .flow-wire { display: block; }
        .flow-node {
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: left;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #e6e6e6;
          padding: 8px 12px;
          cursor: pointer;
          font: inherit;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .flow-node:hover { background: rgba(255, 255, 255, 0.07); }
        .flow-node.active {
          border-color: rgba(60, 125, 255, 0.7);
          background: rgba(60, 125, 255, 0.12);
          box-shadow: 0 0 0 1px rgba(60, 125, 255, 0.4);
        }
        .flow-node-source {
          width: 210px;
          gap: 3px;
          padding: 11px 14px;
          border-left: 3px solid rgba(60, 125, 255, 0.7);
        }
        .flow-node-kind {
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.66em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .flow-node-name {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #fff;
          font-size: 0.92em;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .flow-node-sub { color: rgba(255, 255, 255, 0.5); font-size: 0.76em; }
        /* Per-status delivery summary on the source node */
        .flow-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 10px;
          margin-top: 6px;
        }
        .flow-summary-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.72em;
          font-weight: 600;
        }
        .flow-summary-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        /* Provider node: single table-like row, status right-aligned */
        .flow-node-provider {
          flex-direction: row;
          align-items: center;
          gap: 9px;
          height: 42px; /* == FLOW_NODE_H */
          padding: 0 14px;
          box-sizing: border-box;
        }
        .flow-node-provider.active { border-color: var(--accent, #3C7DFF); }
        .flow-node-provider .flow-node-name { flex: 0 1 auto; }
        .flow-node-dot {
          flex: 0 0 auto;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #9aa0a6) 22%, transparent);
        }
        .flow-node-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: auto; /* push status + duration to the right edge */
          padding-left: 10px;
          white-space: nowrap;
          font-size: 0.76em;
          font-weight: 600;
        }
        /* ── Flow tab: selected-node detail panel ── */
        .flow-detail {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 12px;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .flow-detail-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .flow-detail-title {
          color: #fff;
          font-size: 0.86em;
          font-weight: 600;
        }
        .flow-detail-meta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.8em;
        }
        .flow-detail-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }
        .flow-detail-error {
          color: #e3342f;
          font-size: 0.82em;
          margin-bottom: 8px;
        }
        .flow-detail-note {
          color: rgba(255, 255, 255, 0.6);
          background: rgba(154, 160, 166, 0.12);
          border-left: 3px solid #9aa0a6;
          border-radius: 4px;
          font-size: 0.82em;
          line-height: 1.45;
          padding: 8px 10px;
          margin-bottom: 8px;
        }
        .flow-detail-view {
          flex: 1;
          min-height: 200px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          overflow: hidden;
          /* Anchor for the absolutely-filled viewer below. */
          position: relative;
        }
        /* RawDataHelper's viewer uses height:100%, which doesn't resolve through
           a flex chain capped by max-height — so it grows and gets clipped with
           no scroll. Fill the box by absolute positioning instead, so the pre's
           own overflow:auto scrolls. */
        .flow-detail-view > .raw-data-wrapper {
          position: absolute;
          inset: 0;
          height: auto;
        }
        .delivery-empty {
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
          padding: 12px 4px;
        }
        /* ── View segmented tabs (Analytics | Events) ── */
        .view-tabs {
          display: flex;
          gap: 2px;
          padding: 8px 12px 0;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .view-tab {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          font: inherit;
          font-size: 0.92em;
          transition: color 0.15s, border-color 0.15s;
        }
        .view-tab:hover { color: rgba(255, 255, 255, 0.9); }
        .view-tab.active { color: #fff; border-bottom-color: #3C7DFF; }
        .view-tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.1);
          font-size: 0.72em;
          font-weight: 600;
        }
        .view-tab.active .view-tab-count { background: rgba(60, 125, 255, 0.3); color: #fff; }
        .event-num {
          font-family: 'SF Mono', monospace;
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.85);
          white-space: nowrap;
        }
        .event-muted { color: rgba(255, 255, 255, 0.3); }
        .events-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .events-stats {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .event-stat {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .event-stat-value {
          font-weight: 600;
          color: #3C7DFF;
        }
        .event-stat-label {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.9em;
        }
        .events-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .toggle-internal {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .toggle-internal:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .toggle-internal.active {
          background: rgba(60, 125, 255, 0.2);
          border-color: #3C7DFF;
        }
        .recording-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: ${isRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
          border: 1px solid ${isRecording ? '#EF4444' : 'rgba(255, 255, 255, 0.1)'};
          border-radius: 6px;
          color: ${isRecording ? '#EF4444' : 'rgba(255, 255, 255, 0.6)'};
        }
        .recording-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          ${isRecording ? 'animation: pulse 1.5s infinite;' : ''}
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .events-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9em;
        }
        .events-table th {
          /* Opaque background is required: a translucent sticky header lets the
             scrolled rows bleed through and looks like it overlaps the data. */
          background: #1e1e1e;
          padding: 10px;
          text-align: left;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .events-table td {
          padding: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.7);
        }
        .events-table tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .event-type-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75em;
          font-weight: 600;
          text-transform: uppercase;
        }
        .event-name {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }
        .event-source {
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.5);
        }
        .event-time {
          font-family: 'SF Mono', monospace;
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.5);
        }
        .event-row {
          cursor: pointer;
          transition: background 0.2s;
        }
        .event-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .internal-badge {
          display: inline-block;
          padding: 1px 6px;
          background: rgba(156, 39, 176, 0.2);
          color: #9C27B0;
          border-radius: 3px;
          font-size: 0.7em;
          font-weight: 600;
          margin-left: 6px;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: rgba(255, 255, 255, 0.4);
        }
        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .empty-state .filter-clear { margin-top: 12px; }
        .empty-state-text {
          font-size: 1.1em;
        }
        .empty-state-sub {
          font-size: 0.9em;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 6px;
        }
        .empty-state code {
          font-family: 'SF Mono', monospace;
          background: rgba(255, 255, 255, 0.1);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .validation-badge {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 0.7em;
          font-weight: 700;
          margin-left: 6px;
        }
        .validation-badge-error { background: rgba(244, 67, 54, 0.2); color: #f44336; }
        .validation-badge-warning { background: rgba(255, 152, 0, 0.2); color: #ff9800; }
        .event-validation {
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-size: 0.9em;
        }
        .event-validation-ok {
          background: rgba(76, 175, 80, 0.12);
          color: #81c784;
          border: 1px solid rgba(76, 175, 80, 0.3);
        }
        .event-validation-warn {
          background: rgba(255, 152, 0, 0.1);
          border: 1px solid rgba(255, 152, 0, 0.3);
        }
        .event-validation-fail {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.3);
        }
        .event-validation-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .event-validation-ok .event-validation-summary { color: #81c784; }
        .event-validation-warn .event-validation-summary { color: #ffb74d; }
        .event-validation-fail .event-validation-summary { color: #ef5350; }
        .event-check-list { list-style: none; margin: 0; padding: 0; }
        .event-check {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          padding: 6px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .event-check:first-child { border-top: none; }
        .event-check-status { flex: 0 0 auto; line-height: 1; margin-top: 1px; }
        .event-check-pass .event-check-status { color: #66bb6a; }
        .event-check-warning .event-check-status { color: #ffa726; }
        .event-check-error .event-check-status { color: #ef5350; }
        .event-check-skipped { opacity: 0.55; }
        .event-check-skipped .event-check-status { color: rgba(255, 255, 255, 0.5); }
        .event-check-body { flex: 1 1 auto; min-width: 0; }
        .event-check-head {
          display: flex;
          gap: 8px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .event-check-label { font-weight: 600; color: rgba(255, 255, 255, 0.92); }
        .event-check-field {
          color: #4fc3f7;
          font-family: 'SF Mono', monospace;
          font-size: 0.85em;
          white-space: nowrap;
        }
        .event-check-detail {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.88em;
          margin-top: 2px;
        }
      </style>
  `;
}

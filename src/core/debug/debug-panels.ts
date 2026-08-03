/**
 * Debug panel contract.
 *
 * The panels themselves live in `./panels/` (plus `./enhanced-campaign-panel.ts`)
 * and are registered by `debug-overlay/debug-overlay.ts`. This file is only the
 * shape they implement.
 *
 * It used to carry four panel classes of its own — `CartPanel`, `ConfigPanel`,
 * `CampaignPanel` and `StoragePanel` — superseded one-for-one by
 * `panels/cart-panel.ts`, `panels/config-panel.ts`, `enhanced-campaign-panel.ts`
 * and `panels/storage-panel.ts`. They had no importer and were removed; see
 * commit history for this file if one is ever needed back.
 */

export interface DebugPanel {
  id: string;
  title: string;
  icon: string;
  getContent: () => string;
  getActions?: () => PanelAction[];
  getTabs?: () => PanelTab[];
}

export interface PanelTab {
  id: string;
  label: string;
  icon?: string;
  getContent: () => string;
}

export interface PanelAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

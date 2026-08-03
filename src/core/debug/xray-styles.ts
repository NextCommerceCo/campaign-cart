/**
 * X-Ray styles — the wireframe overlay that outlines every element the SDK has
 * enhanced. `XrayManager` injects the stylesheet and persists the on/off flag.
 *
 * A parallel `xrayConfig` object (a per-attribute colour/label table typed by
 * `XrayStyleConfig`/`XrayAttributeConfig`) used to sit above `generateXrayStyles`
 * and was read by nothing — the CSS below is written out by hand. It was removed
 * along with its two interfaces; recover it from this file's history if a
 * data-driven version is ever wanted.
 */

function generateXrayStyles(): string {
  return `
    /* X-RAY WIREFRAME CSS - PURE CSS, NO JS */

    /* Subtle outlines for all data attributes */
    [data-next-display],
    [data-next-show],
    [data-next-checkout],
    [data-next-selector-id],
    [data-next-cart-selector],
    [data-next-selection-mode],
    [data-next-shipping-id],
    [data-next-selector-card],
    [data-next-package-id],
    [data-next-quantity],
    [data-next-selected],
    [data-next-await],
    [data-next-in-cart],
    [data-next-express-checkout],
    [data-next-payment-method],
    [data-next-checkout-field],
    [data-next-payment-form],
    [data-next-bundle-id],
    [data-next-bundle-card] {
      position: relative !important;
      outline: 1px dashed rgba(0, 0, 0, 0.3) !important;
      outline-offset: -1px !important;
    }

    /* Color coding for different attribute types */
    [data-next-display] {
      outline-color: #4ecdc4 !important;
    }

    [data-next-show] {
      outline-color: #ffe66d !important;
    }

    [data-next-checkout] {
      outline-color: #ff6b6b !important;
    }

    [data-next-selector-id] {
      outline-color: #a8e6cf !important;
    }

    [data-next-selector-card] {
      outline-color: #95e1d3 !important;
    }

    [data-next-in-cart] {
      outline-color: #c7ceea !important;
    }

    [data-next-selected] {
      outline-color: #ffa502 !important;
    }

    [data-next-package-id] {
      outline-color: #ff8b94 !important;
    }

    [data-next-bundle-id],
    [data-next-bundle-card] {
      outline-color: #8e44ad !important;
    }

    /* Small corner labels */
    [data-next-selector-id]::before {
      content: attr(data-next-selector-id) !important;
      position: absolute !important;
      top: 2px !important;
      right: 2px !important;
      background: rgba(168, 230, 207, 0.9) !important;
      color: #333 !important;
      padding: 2px 4px !important;
      font-size: 9px !important;
      font-family: monospace !important;
      line-height: 1 !important;
      border-radius: 2px !important;
      pointer-events: none !important;
      z-index: 10 !important;
    }

    [data-next-package-id]::before {
      content: "PKG " attr(data-next-package-id) !important;
      position: absolute !important;
      top: 2px !important;
      left: 2px !important;
      background: rgba(255, 139, 148, 0.9) !important;
      color: white !important;
      padding: 2px 4px !important;
      font-size: 9px !important;
      font-family: monospace !important;
      font-weight: bold !important;
      line-height: 1 !important;
      border-radius: 2px !important;
      pointer-events: none !important;
      z-index: 10 !important;
    }

    [data-next-bundle-id]::before {
      content: "BUNDLE " attr(data-next-bundle-id) !important;
      position: absolute !important;
      top: 2px !important;
      left: 2px !important;
      background: rgba(142, 68, 173, 0.9) !important;
      color: white !important;
      padding: 2px 4px !important;
      font-size: 9px !important;
      font-family: monospace !important;
      font-weight: bold !important;
      line-height: 1 !important;
      border-radius: 2px !important;
      pointer-events: none !important;
      z-index: 10 !important;
    }

    /* Special highlighting for active states */
    [data-next-selected="true"] {
      outline-width: 2px !important;
      outline-style: solid !important;
    }

    [data-next-in-cart="true"] {
      background-color: rgba(199, 206, 234, 0.1) !important;
    }

    /* Hover tooltips */
    [data-next-display]:hover::after,
    [data-next-show]:hover::after,
    [data-next-selector-card]:hover::after,
    [data-next-bundle-id]:hover::after {
      position: absolute !important;
      z-index: 99999 !important;
      pointer-events: none !important;
      font-family: monospace !important;
      font-size: 10px !important;
      padding: 4px 6px !important;
      border-radius: 3px !important;
      white-space: nowrap !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      bottom: 100% !important;
      left: 0 !important;
      margin-bottom: 4px !important;
    }

    [data-next-display]:hover::after {
      content: "display: " attr(data-next-display) !important;
      background: #4ecdc4 !important;
      color: white !important;
    }

    [data-next-show]:hover::after {
      content: "show: " attr(data-next-show) !important;
      background: #ffe66d !important;
      color: #333 !important;
    }

    [data-next-selector-card]:hover::after {
      content: "pkg:" attr(data-next-package-id) " | selected:" attr(data-next-selected) " | in-cart:" attr(data-next-in-cart) !important;
      background: #95e1d3 !important;
      color: #333 !important;
    }
  `;
}


export class XrayManager {
  private static styleElement: HTMLStyleElement | null = null;
  private static isActive = false;
  private static readonly STORAGE_KEY = 'debug-xray-active';
  
  static initialize(): void {
    // Check localStorage on initialization
    const savedState = localStorage.getItem(this.STORAGE_KEY);
    if (savedState === 'true') {
      this.activate();
    }
  }
  
  static toggle(): boolean {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
    return this.isActive;
  }
  
  static activate(): void {
    if (this.isActive) return;
    
    // Create and inject styles
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'debug-xray-styles';
    this.styleElement.textContent = generateXrayStyles();
    document.head.appendChild(this.styleElement);
    
    // Add active class to body
    document.body.classList.add('debug-xray-active');
    
    this.isActive = true;
    
    // Save to localStorage
    localStorage.setItem(this.STORAGE_KEY, 'true');
    
    // Log activation
    console.log('🔍 X-Ray mode activated');
  }
  
  static deactivate(): void {
    if (!this.isActive) return;
    
    // Remove styles
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    
    // Remove active class
    document.body.classList.remove('debug-xray-active');
    
    this.isActive = false;
    
    // Save to localStorage
    localStorage.setItem(this.STORAGE_KEY, 'false');
    
    // Log deactivation
    console.log('🔍 X-Ray mode deactivated');
  }
  
  static isXrayActive(): boolean {
    return this.isActive;
  }
}
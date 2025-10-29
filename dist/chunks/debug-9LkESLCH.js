import { c as createLogger, L as Logger, d as CountryService, E as EventBus } from "./utils-CrhivV-X.js";
import { c as configStore, u as useCampaignStore, a as useCartStore } from "./analytics-CehPPcOg.js";
import { c as create, p as persist, d as devtools } from "./vendor-DmEBrpID.js";
const initialState$1 = {
  step: 1,
  isProcessing: false,
  errors: {},
  formData: {},
  paymentMethod: "credit-card",
  sameAsShipping: true,
  testMode: false,
  vouchers: []
};
const useCheckoutStore = create()(
  persist(
    (set) => ({
      ...initialState$1,
      setStep: (step) => {
        set({ step });
      },
      setProcessing: (isProcessing) => {
        set({ isProcessing });
      },
      setError: (field, error) => {
        set((state) => ({
          errors: { ...state.errors, [field]: error }
        }));
      },
      clearError: (field) => {
        set((state) => {
          const { [field]: _, ...errors } = state.errors;
          return { errors };
        });
      },
      clearAllErrors: () => {
        set({ errors: {} });
      },
      updateFormData: (data) => {
        set((state) => ({
          formData: { ...state.formData, ...data }
        }));
      },
      setPaymentToken: (paymentToken) => {
        set({ paymentToken });
      },
      setPaymentMethod: (paymentMethod) => {
        set({ paymentMethod });
      },
      setShippingMethod: (shippingMethod) => {
        set({ shippingMethod });
      },
      setBillingAddress: (billingAddress) => {
        set({ billingAddress });
      },
      setSameAsShipping: (sameAsShipping) => {
        set({ sameAsShipping });
      },
      setTestMode: (testMode) => {
        set({ testMode });
      },
      addVoucher: (code) => {
        set((state) => ({
          vouchers: [...state.vouchers, code]
        }));
      },
      removeVoucher: (code) => {
        set((state) => ({
          vouchers: state.vouchers.filter((v) => v !== code)
        }));
      },
      reset: () => {
        set(initialState$1);
      }
    }),
    {
      name: "next-checkout-store",
      // Key in sessionStorage
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        }
      },
      // Exclude transient state from persistence
      partialize: (state) => {
        const paymentMethod = state.paymentMethod === "apple_pay" || state.paymentMethod === "google_pay" || state.paymentMethod === "paypal" ? "credit-card" : state.paymentMethod;
        const {
          cvv,
          card_cvv,
          month,
          expiration_month,
          year,
          expiration_year,
          "exp-month": expMonth,
          "exp-year": expYear,
          card_number,
          ...remainingFormData
        } = state.formData;
        const safeFormData = Object.fromEntries(
          Object.entries(remainingFormData).filter(([_, value]) => {
            if (typeof value === "string") return value.trim() !== "";
            if (typeof value === "boolean" || typeof value === "number") return true;
            return false;
          })
        );
        let billingAddress = state.billingAddress;
        if (billingAddress) {
          const filteredBilling = Object.fromEntries(
            Object.entries(billingAddress).filter(([_, value]) => {
              if (typeof value === "string") return value.trim() !== "";
              return false;
            })
          );
          billingAddress = Object.keys(filteredBilling).length > 0 ? filteredBilling : void 0;
        }
        return {
          step: state.step,
          formData: safeFormData,
          // Exclude CVV, expiration, card number, and empty values
          shippingMethod: state.shippingMethod,
          billingAddress,
          // Only non-empty billing fields
          sameAsShipping: state.sameAsShipping,
          paymentMethod
          // Only persist credit-card/klarna, not express methods
          // Explicitly exclude:
          // - errors (transient validation state)
          // - isProcessing (transient UI state)
          // - paymentToken (sensitive, should not persist)
          // - testMode (session-specific)
          // - vouchers (will be revalidated on page load)
          // - CVV, card number, expiration (sensitive payment data)
          // - Empty string values (no benefit to persist)
        };
      }
    }
  )
);
const checkoutStore = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useCheckoutStore
});
const logger = createLogger("OrderStore");
const initialState = {
  order: null,
  refId: null,
  orderLoadedAt: null,
  isLoading: false,
  isProcessingUpsell: false,
  error: null,
  upsellError: null,
  pendingUpsells: [],
  completedUpsells: [],
  completedUpsellPages: [],
  viewedUpsells: [],
  viewedUpsellPages: [],
  upsellJourney: []
};
const useOrderStore = create()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        // Order management
        setOrder: (order) => {
          logger.debug("Setting order data:", order);
          set({
            order,
            error: null,
            orderLoadedAt: Date.now()
          });
        },
        setRefId: (refId) => {
          logger.debug("Setting ref ID:", refId);
          set({ refId });
        },
        loadOrder: async (refId, apiClient) => {
          const state = get();
          if (state.order && state.refId === refId && !get().isOrderExpired()) {
            logger.info("Using cached order data:", refId);
            return;
          }
          if (state.isLoading) {
            logger.warn("Order loading already in progress");
            return;
          }
          logger.info("Loading order:", refId);
          set({ isLoading: true, error: null, refId });
          try {
            const order = await apiClient.getOrder(refId);
            logger.info("Order loaded successfully:", order);
            const upsellPackageIds = [];
            if (order.lines && Array.isArray(order.lines)) {
              order.lines.forEach((line) => {
                if (line.is_upsell && line.product_sku) {
                  const skuMatch = line.product_sku.match(/(\d+)/);
                  if (skuMatch) {
                    upsellPackageIds.push(skuMatch[1]);
                  } else {
                    upsellPackageIds.push(line.product_sku);
                  }
                  logger.debug("Detected upsell line:", {
                    sku: line.product_sku,
                    title: line.product_title,
                    extractedId: skuMatch ? skuMatch[1] : line.product_sku
                  });
                }
              });
            }
            set({
              order,
              isLoading: false,
              isProcessingUpsell: false,
              // Reset processing state when loading order
              error: null,
              orderLoadedAt: Date.now(),
              completedUpsells: upsellPackageIds,
              // Reset journey when loading a new order
              upsellJourney: [],
              viewedUpsells: [],
              viewedUpsellPages: []
            });
            logger.debug("Populated completed upsells from order:", upsellPackageIds);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load order";
            logger.error("Failed to load order:", error);
            set({
              isLoading: false,
              error: errorMessage,
              order: null
            });
          }
        },
        clearOrder: () => {
          logger.debug("Clearing order data");
          set({
            order: null,
            refId: null,
            error: null,
            orderLoadedAt: null
          });
        },
        isOrderExpired: () => {
          const state = get();
          if (!state.orderLoadedAt) return true;
          const EXPIRY_TIME = 15 * 60 * 1e3;
          const now = Date.now();
          const isExpired = now - state.orderLoadedAt > EXPIRY_TIME;
          if (isExpired) {
            logger.info("Order data has expired (>15 minutes old)");
          }
          return isExpired;
        },
        // Upsell management
        addUpsell: async (upsellData, apiClient) => {
          const state = get();
          if (!state.refId) {
            const error = "No order reference ID available";
            logger.error(error);
            set({ upsellError: error });
            return null;
          }
          if (state.isProcessingUpsell) {
            logger.warn("Upsell processing already in progress");
            return null;
          }
          logger.info("Adding upsell to order:", state.refId, upsellData);
          set({ isProcessingUpsell: true, upsellError: null });
          try {
            const updatedOrder = await apiClient.addUpsell(state.refId, upsellData);
            logger.info("Upsell added successfully:", updatedOrder);
            const currentPagePath = window.location.pathname;
            const packageIds = upsellData.lines.map((line) => line.package_id.toString());
            const journeyEntries = packageIds.map((id) => ({
              packageId: id,
              pagePath: currentPagePath,
              action: "accepted",
              timestamp: Date.now()
            }));
            set({
              order: updatedOrder,
              isProcessingUpsell: false,
              upsellError: null,
              orderLoadedAt: Date.now(),
              // Refresh the timestamp
              completedUpsells: [...state.completedUpsells, ...packageIds],
              // Keep for backward compatibility
              completedUpsellPages: state.completedUpsellPages.includes(currentPagePath) ? state.completedUpsellPages : [...state.completedUpsellPages, currentPagePath],
              upsellJourney: [...state.upsellJourney, ...journeyEntries]
            });
            return updatedOrder;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to add upsell";
            logger.error("Failed to add upsell:", error);
            set({
              isProcessingUpsell: false,
              upsellError: errorMessage
            });
            return null;
          }
        },
        addPendingUpsell: (upsellData) => {
          const state = get();
          logger.debug("Adding pending upsell:", upsellData);
          set({
            pendingUpsells: [...state.pendingUpsells, upsellData]
          });
        },
        removePendingUpsell: (index) => {
          const state = get();
          const newPendingUpsells = [...state.pendingUpsells];
          newPendingUpsells.splice(index, 1);
          logger.debug("Removing pending upsell at index:", index);
          set({ pendingUpsells: newPendingUpsells });
        },
        clearPendingUpsells: () => {
          logger.debug("Clearing pending upsells");
          set({ pendingUpsells: [] });
        },
        markUpsellCompleted: (packageId) => {
          const state = get();
          if (!state.completedUpsells.includes(packageId)) {
            logger.debug("Marking upsell as completed:", packageId);
            set({
              completedUpsells: [...state.completedUpsells, packageId]
            });
          }
        },
        markUpsellViewed: (packageId) => {
          const state = get();
          if (!state.viewedUpsells.includes(packageId)) {
            logger.debug("Marking upsell as viewed:", packageId);
            const journeyEntry = {
              packageId,
              action: "viewed",
              timestamp: Date.now()
            };
            set({
              viewedUpsells: [...state.viewedUpsells, packageId],
              upsellJourney: [...state.upsellJourney, journeyEntry]
            });
          }
        },
        markUpsellPageViewed: (pagePath) => {
          const state = get();
          if (!state.viewedUpsellPages.includes(pagePath)) {
            logger.debug("Marking upsell page as viewed:", pagePath);
            const journeyEntry = {
              pagePath,
              action: "viewed",
              timestamp: Date.now()
            };
            set({
              viewedUpsellPages: [...state.viewedUpsellPages, pagePath],
              upsellJourney: [...state.upsellJourney, journeyEntry],
              isProcessingUpsell: false,
              // Reset processing state when viewing new page
              upsellError: null
              // Clear any previous errors
            });
          }
        },
        markUpsellSkipped: (packageId, pagePath) => {
          const state = get();
          logger.debug("Marking upsell as skipped:", { packageId, pagePath });
          const journeyEntry = {
            action: "skipped",
            timestamp: Date.now()
          };
          if (packageId !== void 0) journeyEntry.packageId = packageId;
          if (pagePath !== void 0) journeyEntry.pagePath = pagePath;
          set({
            upsellJourney: [...state.upsellJourney, journeyEntry],
            isProcessingUpsell: false,
            // Reset processing state when skipping
            upsellError: null
            // Clear any errors
          });
        },
        // Error handling
        setError: (error) => set({ error }),
        setUpsellError: (error) => set({ upsellError: error }),
        clearErrors: () => set({ error: null, upsellError: null }),
        // Loading states
        setLoading: (loading) => set({ isLoading: loading }),
        setProcessingUpsell: (processing) => set({ isProcessingUpsell: processing }),
        // Utility methods
        hasUpsellPageBeenCompleted: (pagePath) => {
          const state = get();
          return state.completedUpsellPages.includes(pagePath);
        },
        hasUpsellBeenViewed: (packageId) => {
          const state = get();
          return state.viewedUpsells.includes(packageId);
        },
        hasUpsellPageBeenViewed: (pagePath) => {
          const state = get();
          return state.viewedUpsellPages.includes(pagePath);
        },
        getUpsellJourney: () => {
          const state = get();
          return state.upsellJourney;
        },
        getOrderTotal: () => {
          const state = get();
          if (!state.order) return 0;
          return parseFloat(state.order.total_incl_tax || "0");
        },
        canAddUpsells: () => {
          const state = get();
          return !!(state.order && state.order.supports_post_purchase_upsells && !state.isProcessingUpsell);
        },
        reset: () => {
          logger.debug("Resetting order store");
          set(initialState);
        }
      }),
      {
        name: "next-order",
        storage: {
          getItem: (name) => {
            const str = sessionStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          },
          setItem: (name, value) => {
            sessionStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            sessionStorage.removeItem(name);
          }
        }
      }
    ),
    {
      name: "order-store"
    }
  )
);
class TestModeManager {
  constructor() {
    this.isTestMode = false;
    this.konamiSequence = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "KeyB",
      "KeyA"
    ];
    this.keySequence = [];
    this.testCards = [
      {
        number: "4111111111111111",
        name: "Visa Test Card",
        cvv: "123",
        expiry: "12/25",
        type: "visa"
      },
      {
        number: "5555555555554444",
        name: "Mastercard Test Card",
        cvv: "123",
        expiry: "12/25",
        type: "mastercard"
      },
      {
        number: "378282246310005",
        name: "American Express Test Card",
        cvv: "1234",
        expiry: "12/25",
        type: "amex"
      },
      {
        number: "6011111111111117",
        name: "Discover Test Card",
        cvv: "123",
        expiry: "12/25",
        type: "discover"
      }
    ];
    this.initializeKonamiCode();
    this.checkUrlTestMode();
  }
  static getInstance() {
    if (!TestModeManager.instance) {
      TestModeManager.instance = new TestModeManager();
    }
    return TestModeManager.instance;
  }
  initializeKonamiCode() {
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
  }
  handleKeyDown(event) {
    this.keySequence.push(event.code);
    if (this.keySequence.length > this.konamiSequence.length) {
      this.keySequence.shift();
    }
    if (this.keySequence.length === this.konamiSequence.length) {
      const isMatch = this.keySequence.every(
        (key, index) => key === this.konamiSequence[index]
      );
      if (isMatch) {
        this.activateKonamiCode();
        this.keySequence = [];
      }
    }
  }
  checkUrlTestMode() {
    const params = new URLSearchParams(window.location.search);
    const debugMode = params.get("debugger") === "true";
    const testMode = params.get("test") === "true";
    if (debugMode || testMode) {
      this.isTestMode = true;
    }
  }
  activateKonamiCode() {
    console.log("🎮 Konami Code activated!");
    this.isTestMode = true;
    this.showKonamiMessage();
    const url = new URL(window.location.href);
    url.searchParams.set("test", "true");
    window.history.replaceState({}, "", url.toString());
    if (this.konamiCallback) {
      setTimeout(() => {
        this.konamiCallback?.();
      }, 2e3);
    }
    document.dispatchEvent(new CustomEvent("next:test-mode-activated", {
      detail: { method: "konami" }
    }));
  }
  showKonamiMessage() {
    const message = document.createElement("div");
    message.className = "konami-activation-message";
    message.innerHTML = `
      <div class="konami-content">
        <h3>🎮 Konami Code Activated!</h3>
        <p>Test mode enabled. You can now use test payment methods.</p>
        <div class="konami-progress">
          <div class="konami-progress-bar"></div>
        </div>
      </div>
    `;
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      text-align: center;
      min-width: 300px;
    `;
    const progressBar = message.querySelector(".konami-progress-bar");
    if (progressBar) {
      progressBar.style.cssText = `
        width: 100%;
        height: 4px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 1rem;
      `;
      progressBar.innerHTML = '<div style="width: 0; height: 100%; background: white; transition: width 2s ease-in-out;"></div>';
    }
    document.body.appendChild(message);
    setTimeout(() => {
      const bar = progressBar?.querySelector("div");
      if (bar) {
        bar.style.width = "100%";
      }
    }, 100);
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 2500);
  }
  setTestMode(enabled) {
    this.isTestMode = enabled;
    if (enabled) {
      const url = new URL(window.location.href);
      url.searchParams.set("test", "true");
      window.history.replaceState({}, "", url.toString());
    }
  }
  isActive() {
    return this.isTestMode;
  }
  onKonamiCode(callback) {
    this.konamiCallback = callback;
  }
  getTestCards() {
    return [...this.testCards];
  }
  getTestCard(type) {
    if (type) {
      const card = this.testCards.find((c) => c.type === type);
      if (card) return card;
    }
    const defaultCard = this.testCards[0];
    if (!defaultCard) {
      throw new Error("No test cards available");
    }
    return defaultCard;
  }
  fillTestCardData(cardType = "visa") {
    if (!this.isTestMode) return;
    const testCard = this.getTestCard(cardType);
    const numberField = document.querySelector('input[data-spreedly="number"], input[name*="card_number"], input[name*="cardNumber"]');
    if (numberField) {
      numberField.value = testCard.number;
      numberField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const cvvField = document.querySelector('input[data-spreedly="cvv"], input[name*="cvv"], input[name*="security"]');
    if (cvvField) {
      cvvField.value = testCard.cvv;
      cvvField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const expiryField = document.querySelector('input[name*="expiry"], input[name*="exp"]');
    if (expiryField) {
      expiryField.value = testCard.expiry;
      expiryField.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      const monthField = document.querySelector('select[name*="month"], input[name*="month"]');
      const yearField = document.querySelector('select[name*="year"], input[name*="year"]');
      if (monthField && yearField) {
        const [month, year] = testCard.expiry.split("/");
        if (month && year) {
          monthField.value = month;
          yearField.value = `20${year}`;
          monthField.dispatchEvent(new Event("change", { bubbles: true }));
          yearField.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
    const nameField = document.querySelector('input[name*="cardholder"], input[name*="card_name"]');
    if (nameField) {
      nameField.value = "Test Cardholder";
      nameField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    console.log(`Filled test card data: ${testCard.name}`);
  }
  showTestCardMenu() {
    if (!this.isTestMode) return;
    const menu = document.createElement("div");
    menu.className = "test-card-menu";
    menu.innerHTML = `
      <div class="test-card-content">
        <h4>Test Card Numbers</h4>
        <div class="test-card-options">
          ${this.testCards.map((card) => `
            <button class="test-card-option" data-card-type="${card.type}">
              <div class="card-name">${card.name}</div>
              <div class="card-number">${card.number}</div>
            </button>
          `).join("")}
        </div>
        <button class="test-card-close">Close</button>
      </div>
    `;
    menu.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      min-width: 250px;
    `;
    menu.addEventListener("click", (e) => {
      const target = e.target;
      if (target.classList.contains("test-card-option") || target.closest(".test-card-option")) {
        const button = target.closest(".test-card-option");
        const cardType = button.getAttribute("data-card-type");
        if (cardType) {
          this.fillTestCardData(cardType);
          menu.remove();
        }
      } else if (target.classList.contains("test-card-close")) {
        menu.remove();
      }
    });
    document.body.appendChild(menu);
    setTimeout(() => {
      if (menu.parentNode) {
        menu.remove();
      }
    }, 3e4);
  }
}
const testModeManager = TestModeManager.getInstance();
class DebugEventManager {
  constructor() {
    this.eventLog = [];
    this.maxEvents = 100;
    this.initializeEventCapture();
  }
  initializeEventCapture() {
    const events = [
      "next:cart-updated",
      "next:checkout-step",
      "next:item-added",
      "next:item-removed",
      "next:timer-expired",
      "next:validation-error",
      "next:payment-success",
      "next:payment-error"
    ];
    events.forEach((eventType) => {
      document.addEventListener(eventType, (e) => {
        this.logEvent(eventType.replace("next:", ""), e.detail, "CustomEvent");
      });
    });
    this.interceptFetch();
  }
  interceptFetch() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0].toString();
      if (url.includes("29next.com") || url.includes("campaigns.")) {
        this.logEvent("api-request", {
          url,
          method: args[1]?.method || "GET"
        }, "API");
      }
      return originalFetch.apply(window, args);
    };
  }
  logEvent(type, data, source) {
    this.eventLog.push({
      timestamp: /* @__PURE__ */ new Date(),
      type,
      data,
      source
    });
    if (this.eventLog.length > this.maxEvents) {
      this.eventLog.shift();
    }
  }
  getEvents(limit) {
    const events = limit ? this.eventLog.slice(-limit) : this.eventLog;
    return events.reverse();
  }
  clearEvents() {
    this.eventLog = [];
  }
  exportEvents() {
    return JSON.stringify(this.eventLog, null, 2);
  }
}
class EnhancedDebugUI {
  static createOverlayHTML(panels, activePanel, isExpanded, activePanelTab) {
    const activePanelData = panels.find((p) => p.id === activePanel);
    return `
      <div class="enhanced-debug-overlay ${isExpanded ? "expanded" : "collapsed"}">
        ${this.createBottomBar(isExpanded)}
        ${isExpanded ? this.createExpandedContent(panels, activePanelData, activePanel, activePanelTab) : ""}
      </div>
    `;
  }
  static createBottomBar(isExpanded) {
    return `
      <div class="debug-bottom-bar">
        <div class="debug-logo-section">
          ${this.getNextCommerceLogo()}
          <span class="debug-title">Debug Tools</span>
          <div class="debug-status">
            <div class="status-indicator active"></div>
            <span class="status-text">Active</span>
          </div>
        </div>
        
        <div class="debug-quick-stats">
          <div class="stat-item">
            <span class="stat-value" data-debug-stat="cart-items">0</span>
            <span class="stat-label">Items</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" data-debug-stat="cart-total">$0.00</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" data-debug-stat="enhanced-elements">0</span>
            <span class="stat-label">Enhanced</span>
          </div>
        </div>

        <div class="debug-controls">
          <button class="debug-control-btn" data-action="toggle-mini-cart" title="Toggle Mini Cart">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17,18C15.89,18 15,18.89 15,20A2,2 0 0,0 17,22A2,2 0 0,0 19,20C19,18.89 18.1,18 17,18M1,2V4H3L6.6,11.59L5.24,14.04C5.09,14.32 5,14.65 5,15A2,2 0 0,0 7,17H19V15H7.42A0.25,0.25 0 0,1 7.17,14.75C7.17,14.7 7.18,14.66 7.2,14.63L8.1,13H15.55C16.3,13 16.96,12.58 17.3,11.97L20.88,5.5C20.95,5.34 21,5.17 21,5A1,1 0 0,0 20,4H5.21L4.27,2M7,18C5.89,18 5,18.89 5,20A2,2 0 0,0 7,22A2,2 0 0,0 9,20C9,18.89 8.1,18 7,18Z"/>
            </svg>
          </button>
          <button class="debug-control-btn" data-action="clear-cart" title="Clear Cart">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
          <button class="debug-control-btn" data-action="toggle-xray" title="Toggle X-Ray View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 3C3.89 3 3 3.9 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.9 20.11 3 19 3H5M5 5H19V19H5V5M7 7V9H9V7H7M11 7V9H13V7H11M15 7V9H17V7H15M7 11V13H9V11H7M11 11V13H13V11H11M15 11V13H17V11H15M7 15V17H9V15H7M11 15V17H13V15H11M15 15V17H17V15H15Z"/>
            </svg>
          </button>
          <button class="debug-control-btn" data-action="export-data" title="Export Debug Data">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
            </svg>
          </button>
          <button class="debug-expand-btn" data-action="toggle-expand" title="${isExpanded ? "Collapse" : "Expand"}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="expand-icon ${isExpanded ? "rotated" : ""}">
              <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
            </svg>
          </button>
          <button class="debug-control-btn close-btn" data-action="close" title="Close Debug Tools">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
  static createExpandedContent(panels, activePanel, activePanelId, activePanelTab) {
    return `
      <div class="debug-expanded-content">
        <div class="debug-sidebar">
          ${this.createPanelTabs(panels, activePanelId)}
        </div>
        
        <div class="debug-main-content">
          ${this.createPanelContent(activePanel, activePanelTab)}
        </div>
      </div>
    `;
  }
  static createPanelTabs(panels, activePanel) {
    return `
      <div class="debug-panel-tabs">
        ${panels.map((panel) => `
          <button class="debug-panel-tab ${panel.id === activePanel ? "active" : ""}" 
                  data-panel="${panel.id}">
            <span class="tab-icon">${panel.icon}</span>
            <span class="tab-label">${panel.title}</span>
            ${panel.id === "events" ? '<div class="tab-badge" data-debug-badge="events">0</div>' : ""}
          </button>
        `).join("")}
      </div>
    `;
  }
  static createPanelContent(activePanel, activePanelTab) {
    if (!activePanel) return "";
    const tabs = activePanel.getTabs?.() || [];
    const hasHorizontalTabs = tabs.length > 0;
    if (hasHorizontalTabs) {
      const activeTabId = activePanelTab || tabs[0]?.id;
      const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
      return `
        <div class="debug-panel-container">
          <div class="panel-header">
            <div class="panel-title">
              <span class="panel-icon">${activePanel.icon}</span>
              <h2>${activePanel.title}</h2>
            </div>
            ${activePanel.getActions ? `
              <div class="panel-actions">
                ${activePanel.getActions().map((action) => `
                  <button class="panel-action-btn ${action.variant || "primary"}" 
                          data-panel-action="${action.label}">
                    ${action.label}
                  </button>
                `).join("")}
              </div>
            ` : ""}
          </div>
          
          <div class="panel-horizontal-tabs">
            ${tabs.map((tab) => `
              <button class="horizontal-tab ${tab.id === activeTabId ? "active" : ""}" 
                      data-panel-tab="${tab.id}">
                ${tab.icon ? `<span class="tab-icon">${tab.icon}</span>` : ""}
                <span class="tab-label">${tab.label}</span>
              </button>
            `).join("")}
          </div>
          
          <div class="panel-content ${activePanel.id === "events" || activePanel.id === "event-timeline" || activePanel.id === "order" && activeTabId === "lines" || activeTabId === "raw" ? "no-padding" : ""}">
            ${activeTab ? activeTab.getContent() : ""}
          </div>
        </div>
      `;
    }
    return `
      <div class="debug-panel-container">
        <div class="panel-header">
          <div class="panel-title">
            <span class="panel-icon">${activePanel.icon}</span>
            <h2>${activePanel.title}</h2>
          </div>
          ${activePanel.getActions ? `
            <div class="panel-actions">
              ${activePanel.getActions().map((action) => `
                <button class="panel-action-btn ${action.variant || "primary"}" 
                        data-panel-action="${action.label}">
                  ${action.label}
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
        <div class="panel-content ${activePanel.id === "events" || activePanel.id === "event-timeline" || activePanel.id === "order" ? "no-padding" : ""}">
          ${activePanel.getContent()}
        </div>
      </div>
    `;
  }
  static getNextCommerceLogo() {
    return `
      <svg class="debug-logo" width="32" height="32" viewBox="0 0 115.4 101.9" fill="none">
        <defs>
          <style>
            .st0 {
              fill: currentColor;
              stroke: currentColor;
              stroke-width: 2.5px;
            }
          </style>
        </defs>
        <path class="st0" d="M83.5,58.3l-1.9-1.3L27.2,21.2c-.7-.4-1.4-.6-2-.6-2,0-3.6,1.6-3.6,3.6v53.4c0,2,1.6,3.6,3.6,3.6h3.8v12.3h-3.8c-8.8,0-15.8-7.1-15.8-15.8V24.3c0-8.8,7.1-15.8,15.8-15.8,3.1,0,6.2.9,8.7,2.6h0l49,33.4.5.4v13.5ZM90.2,8.4c8.8,0,15.8,7.1,15.8,15.8v53.4c0,8.8-7.1,15.8-15.8,15.8s-6.2-.9-8.7-2.6h0l-49-33.4-.5-.4v-13.5l1.9,1.3,54.3,35.7c.7.4,1.4.7,2,.7,2,0,3.6-1.6,3.6-3.6V24.3c0-2-1.6-3.6-3.6-3.6h-3.8v-12.3h3.8Z"/>
      </svg>
    `;
  }
  static addStyles() {
    console.log("Debug styles loaded via CSS modules");
  }
  static removeStyles() {
    console.log("Debug styles will be cleaned up by DebugStyleLoader");
  }
}
function generateXrayStyles() {
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
    [data-next-payment-form] {
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
    [data-next-selector-card]:hover::after {
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
const _XrayManager = class _XrayManager {
  static initialize() {
    const savedState = localStorage.getItem(this.STORAGE_KEY);
    if (savedState === "true") {
      this.activate();
    }
  }
  static toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
    return this.isActive;
  }
  static activate() {
    if (this.isActive) return;
    this.styleElement = document.createElement("style");
    this.styleElement.id = "debug-xray-styles";
    this.styleElement.textContent = generateXrayStyles();
    document.head.appendChild(this.styleElement);
    document.body.classList.add("debug-xray-active");
    this.isActive = true;
    localStorage.setItem(this.STORAGE_KEY, "true");
    console.log("🔍 X-Ray mode activated");
  }
  static deactivate() {
    if (!this.isActive) return;
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    document.body.classList.remove("debug-xray-active");
    this.isActive = false;
    localStorage.setItem(this.STORAGE_KEY, "false");
    console.log("🔍 X-Ray mode deactivated");
  }
  static isXrayActive() {
    return this.isActive;
  }
};
_XrayManager.styleElement = null;
_XrayManager.isActive = false;
_XrayManager.STORAGE_KEY = "debug-xray-active";
let XrayManager = _XrayManager;
class CurrencySelector {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.logger = new Logger("CurrencySelector");
    this.isChanging = false;
    this.listenersAttached = false;
    this.renderDebounceTimer = null;
    this.hasInitiallyRendered = false;
  }
  static getInstance() {
    if (!CurrencySelector.instance) {
      CurrencySelector.instance = new CurrencySelector();
    }
    return CurrencySelector.instance;
  }
  initialize() {
    const configStore$1 = configStore.getState();
    if (!configStore$1.debug) {
      return;
    }
    this.createContainer();
    this.render();
    this.setupEventListeners();
    this.setupStoreSubscriptions();
    this.logger.info("Currency selector initialized");
  }
  setupStoreSubscriptions() {
    const unsubscribe = useCampaignStore.subscribe((state, prevState) => {
      if (this.isChanging) {
        return;
      }
      const currencyChanged = state.data?.currency !== prevState?.data?.currency;
      const dataLoaded = !prevState?.data && state.data;
      if (currencyChanged || dataLoaded) {
        this.logger.debug("Campaign currency changed or data loaded, re-rendering currency selector");
        this.render();
      }
    });
    this._unsubscribeCampaign = unsubscribe;
  }
  createContainer() {
    if (this.container) {
      this.container.remove();
    }
    this.container = document.createElement("div");
    this.container.id = "debug-currency-selector";
    this.container.style.cssText = `
      position: relative;
      pointer-events: auto;
    `;
    this.shadowRoot = this.container.attachShadow({ mode: "open" });
    document.body.appendChild(this.container);
  }
  getAvailableCurrencies() {
    const campaignStore = useCampaignStore.getState();
    if (campaignStore.data?.available_currencies && campaignStore.data.available_currencies.length > 0) {
      return campaignStore.data.available_currencies;
    }
    return [
      { code: "USD", label: "$ USD" },
      { code: "EUR", label: "€ EUR" },
      { code: "GBP", label: "£ GBP" }
    ];
  }
  render() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    this.renderDebounceTimer = setTimeout(() => {
      this.doRender();
    }, 50);
  }
  doRender() {
    if (!this.shadowRoot) return;
    const configStore$1 = configStore.getState();
    const campaignStore = useCampaignStore.getState();
    const currentCurrency = configStore$1.selectedCurrency || configStore$1.detectedCurrency || "USD";
    const availableCurrencies = this.getAvailableCurrencies();
    if (!campaignStore.data) {
      this.logger.debug("No campaign data available yet, skipping currency selector render");
      setTimeout(() => this.doRender(), 1e3);
      return;
    }
    if (availableCurrencies.length <= 1) {
      this.logger.debug("Only one currency available, hiding currency selector");
      if (this.container) {
        this.container.style.display = "none";
      }
      return;
    }
    if (this.container) {
      this.container.style.display = "block";
    }
    const detectedCurrency = configStore$1.detectedCurrency;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .currency-selector {
          background: linear-gradient(135deg, #222 0%, #1a1a1a 100%);
          backdrop-filter: blur(10px);
          border: 1px solid #333;
          border-radius: 4px;
          padding: 4px 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .currency-selector:hover {
          background: linear-gradient(135deg, #2a2a2a 0%, #222 100%);
          border-color: #444;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .currency-label {
          color: rgba(255, 255, 255, 0.9);
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
        }

        .currency-select {
          appearance: none;
          background: #2a2a2a;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          padding: 2px 20px 2px 6px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          min-width: 60px;
        }

        .currency-select option {
          background: #2a2a2a;
          color: rgba(255, 255, 255, 0.9);
          padding: 4px;
        }

        .currency-select:hover {
          background: #333;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .currency-select:focus {
          outline: none;
          border-color: #4299e1;
          background: #333;
        }

        .currency-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .select-arrow {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: rgba(255, 255, 255, 0.6);
          width: 10px;
          height: 10px;
        }

        .loading-indicator {
          display: none;
          width: 10px;
          height: 10px;
          border: 1px solid #cbd5e0;
          border-top-color: #4299e1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-indicator.active {
          display: inline-block;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .detected-info {
          color: rgba(255, 255, 255, 0.5);
          font-size: 10px;
          font-weight: 400;
          white-space: nowrap;
          padding-left: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.2);
        }

        .detected-value {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }
      </style>

      <div class="currency-selector">
        <span class="currency-label">💱</span>
        
        <div class="select-wrapper">
          <select class="currency-select" id="currency-select">
            ${availableCurrencies.map((currency) => `
              <option value="${currency.code}" ${currency.code === currentCurrency ? "selected" : ""}>
                ${currency.code}
              </option>
            `).join("")}
          </select>
          <svg class="select-arrow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
          </svg>
        </div>

        <div class="loading-indicator" id="loading-indicator"></div>

        ${detectedCurrency ? `
          <div class="detected-info">
            Detected: <span class="detected-value">${detectedCurrency}</span>
          </div>
        ` : ""}
      </div>
    `;
    if (!this.hasInitiallyRendered) {
      this.hasInitiallyRendered = true;
    }
  }
  setupEventListeners() {
    if (!this.shadowRoot || this.listenersAttached) return;
    this.shadowRoot.addEventListener("change", async (e) => {
      const target = e.target;
      if (target && target.id === "currency-select") {
        const selectElement = target;
        const newCurrency = selectElement.value;
        if (this.isChanging) {
          this.logger.warn("Currency change already in progress");
          return;
        }
        this.logger.debug(`Currency select changed to: ${newCurrency}`);
        await this.handleCurrencyChange(newCurrency);
      }
    });
    document.addEventListener("next:currency-changed", (e) => {
      const customEvent = e;
      if (customEvent.detail?.source === "currency-selector") {
        return;
      }
      clearTimeout(this._rerenderTimeout);
      this._rerenderTimeout = setTimeout(() => {
        this.logger.debug("External currency change detected, re-rendering selector");
        this.render();
      }, 100);
    });
    this.listenersAttached = true;
    this.logger.debug("Event listeners attached to currency selector");
  }
  async handleCurrencyChange(newCurrency) {
    this.isChanging = true;
    const select = this.shadowRoot?.getElementById("currency-select");
    const loadingIndicator = this.shadowRoot?.getElementById("loading-indicator");
    if (select) select.disabled = true;
    if (loadingIndicator) loadingIndicator.classList.add("active");
    try {
      this.logger.info(`Changing currency to ${newCurrency}`);
      const configStore$1 = configStore.getState();
      const campaignStore = useCampaignStore.getState();
      const cartStore = useCartStore.getState();
      const oldCurrency = configStore$1.selectedCurrency || configStore$1.detectedCurrency || "USD";
      configStore$1.updateConfig({
        selectedCurrency: newCurrency
      });
      sessionStorage.setItem("next_selected_currency", newCurrency);
      this.logger.info(`Saved currency preference to session: ${newCurrency}`);
      await campaignStore.loadCampaign(configStore$1.apiKey, { forceFresh: true });
      await cartStore.refreshItemPrices();
      this.logger.info(`Currency changed successfully to ${newCurrency}`);
      document.dispatchEvent(new CustomEvent("next:currency-changed", {
        detail: {
          from: oldCurrency,
          to: newCurrency,
          source: "currency-selector"
        }
      }));
      document.dispatchEvent(new CustomEvent("debug:update-content"));
      this.showSuccessFeedback(newCurrency);
    } catch (error) {
      this.logger.error("Failed to change currency:", error);
      this.showErrorFeedback();
      const configStore$1 = configStore.getState();
      const currentCurrency = configStore$1.selectedCurrency || "USD";
      if (select) select.value = currentCurrency;
    } finally {
      this.isChanging = false;
      if (select) select.disabled = false;
      if (loadingIndicator) loadingIndicator.classList.remove("active");
    }
  }
  showSuccessFeedback(_currency) {
    const selector = this.shadowRoot?.querySelector(".currency-selector");
    if (!selector) return;
    selector.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
    setTimeout(() => {
      selector.style.background = "linear-gradient(135deg, #222 0%, #1a1a1a 100%)";
    }, 1e3);
  }
  showErrorFeedback() {
    const selector = this.shadowRoot?.querySelector(".currency-selector");
    if (!selector) return;
    selector.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
    setTimeout(() => {
      selector.style.background = "linear-gradient(135deg, #222 0%, #1a1a1a 100%)";
    }, 1e3);
  }
  destroy() {
    if (this._unsubscribeCampaign) {
      this._unsubscribeCampaign();
      this._unsubscribeCampaign = null;
    }
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    if (this._rerenderTimeout) {
      clearTimeout(this._rerenderTimeout);
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
  hide() {
    if (this.container) {
      this.container.style.display = "none";
    }
  }
  show() {
    if (this.container) {
      this.container.style.display = "block";
    }
  }
}
const currencySelector = CurrencySelector.getInstance();
class CountrySelector {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.logger = new Logger("CountrySelector");
    this.isChanging = false;
    this.listenersAttached = false;
    this.renderDebounceTimer = null;
    this.hasInitiallyRendered = false;
    this.countries = [];
  }
  static getInstance() {
    if (!CountrySelector.instance) {
      CountrySelector.instance = new CountrySelector();
    }
    return CountrySelector.instance;
  }
  async initialize() {
    const configStore$1 = configStore.getState();
    if (!configStore$1.debug) {
      return;
    }
    await this.loadCountries();
    this.createContainer();
    this.render();
    this.setupEventListeners();
    this.logger.info("Country selector initialized");
  }
  async loadCountries() {
    try {
      const countryService = CountryService.getInstance();
      const locationData = await countryService.getLocationData();
      this.countries = locationData.countries || [];
      this.logger.debug(`Loaded ${this.countries.length} countries`);
    } catch (error) {
      this.logger.error("Failed to load countries:", error);
      this.countries = [];
    }
  }
  createContainer() {
    if (this.container) {
      this.container.remove();
    }
    this.container = document.createElement("div");
    this.container.id = "debug-country-selector";
    this.container.style.cssText = `
      position: relative;
      pointer-events: auto;
    `;
    this.shadowRoot = this.container.attachShadow({ mode: "open" });
    document.body.appendChild(this.container);
  }
  render() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    this.renderDebounceTimer = setTimeout(() => {
      this.doRender();
    }, 50);
  }
  doRender() {
    if (!this.shadowRoot) return;
    const configStore$1 = configStore.getState();
    const detectedCountry = configStore$1.detectedCountry || "US";
    const currentCountry = sessionStorage.getItem("next_selected_country") || detectedCountry;
    if (this.countries.length === 0) {
      this.logger.debug("No countries available, hiding country selector");
      if (this.container) {
        this.container.style.display = "none";
      }
      return;
    }
    if (this.container) {
      this.container.style.display = "block";
    }
    const rawDetectedCountry = configStore$1.detectedCountry;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .country-selector {
          background: linear-gradient(135deg, #222 0%, #1a1a1a 100%);
          backdrop-filter: blur(10px);
          border: 1px solid #333;
          border-radius: 4px;
          padding: 4px 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .country-selector:hover {
          background: linear-gradient(135deg, #2a2a2a 0%, #222 100%);
          border-color: #444;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .country-label {
          color: rgba(255, 255, 255, 0.9);
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
        }

        .country-select {
          appearance: none;
          background: #2a2a2a;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          padding: 2px 20px 2px 6px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          min-width: 80px;
          max-width: 120px;
        }

        .country-select option {
          background: #2a2a2a;
          color: rgba(255, 255, 255, 0.9);
          padding: 4px;
        }

        .country-select:hover {
          background: #333;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .country-select:focus {
          outline: none;
          border-color: #4299e1;
          background: #333;
        }

        .country-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .select-arrow {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: rgba(255, 255, 255, 0.6);
          width: 10px;
          height: 10px;
        }

        .loading-indicator {
          display: none;
          width: 10px;
          height: 10px;
          border: 1px solid #cbd5e0;
          border-top-color: #4299e1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-indicator.active {
          display: inline-block;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .reset-button {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 3px;
          color: #ff6b6b;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reset-button:hover {
          background: rgba(239, 68, 68, 0.3);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ff8787;
        }

        .detected-info {
          color: rgba(255, 255, 255, 0.5);
          font-size: 10px;
          font-weight: 400;
          white-space: nowrap;
          padding-left: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.2);
        }

        .detected-value {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }
      </style>

      <div class="country-selector">
        <span class="country-label">🌍</span>
        
        <div class="select-wrapper">
          <select class="country-select" id="country-select">
            ${this.countries.map((country) => `
              <option value="${country.code}" ${country.code === currentCountry ? "selected" : ""}>
                ${country.name.length > 15 ? country.name.substring(0, 15) + "..." : country.name}
              </option>
            `).join("")}
          </select>
          <svg class="select-arrow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
          </svg>
        </div>

        <div class="loading-indicator" id="loading-indicator"></div>

        ${rawDetectedCountry !== currentCountry ? `
          <button class="reset-button" id="reset-button" title="Reset to detected country: ${rawDetectedCountry}">
            Reset
          </button>
        ` : ""}

        ${rawDetectedCountry ? `
          <div class="detected-info">
            Detected: <span class="detected-value">${rawDetectedCountry}</span>
          </div>
        ` : ""}
      </div>
    `;
    if (!this.hasInitiallyRendered) {
      this.hasInitiallyRendered = true;
    }
  }
  setupEventListeners() {
    if (!this.shadowRoot || this.listenersAttached) return;
    this.shadowRoot.addEventListener("change", async (e) => {
      const target = e.target;
      if (target && target.id === "country-select") {
        const selectElement = target;
        const newCountry = selectElement.value;
        if (this.isChanging) {
          this.logger.warn("Country change already in progress");
          return;
        }
        this.logger.debug(`Country select changed to: ${newCountry}`);
        await this.handleCountryChange(newCountry);
      }
    });
    this.shadowRoot.addEventListener("click", async (e) => {
      const target = e.target;
      if (target && target.id === "reset-button") {
        const configStore$1 = configStore.getState();
        const detectedCountry = configStore$1.detectedCountry || "US";
        this.logger.debug("Resetting to detected country:", detectedCountry);
        await this.handleCountryChange(detectedCountry, true);
      }
    });
    document.addEventListener("next:country-changed", () => {
      this.logger.debug("External country change detected, re-rendering selector");
      this.render();
    });
    this.listenersAttached = true;
    this.logger.debug("Event listeners attached to country selector");
  }
  async handleCountryChange(newCountry, isReset = false) {
    this.isChanging = true;
    const select = this.shadowRoot?.getElementById("country-select");
    const loadingIndicator = this.shadowRoot?.getElementById("loading-indicator");
    if (select) select.disabled = true;
    if (loadingIndicator) loadingIndicator.classList.add("active");
    try {
      this.logger.info(`Changing country to ${newCountry}`);
      const configStore$1 = configStore.getState();
      const campaignStore = useCampaignStore.getState();
      const cartStore = useCartStore.getState();
      const countryService = CountryService.getInstance();
      const oldCountry = sessionStorage.getItem("next_selected_country") || configStore$1.detectedCountry || "US";
      if (isReset) {
        sessionStorage.removeItem("next_selected_country");
        this.logger.info("Cleared selected country override, using detected country");
      } else {
        sessionStorage.setItem("next_selected_country", newCountry);
        this.logger.info(`Saved selected country to session: ${newCountry}`);
      }
      const countryConfig = await countryService.getCountryConfig(newCountry);
      const countryStates = await countryService.getCountryStates(newCountry);
      configStore$1.updateConfig({
        locationData: {
          detectedCountryCode: newCountry,
          detectedCountryConfig: countryConfig,
          detectedStates: countryStates.states,
          detectedStateCode: "",
          detectedCity: "",
          countries: this.countries
        }
      });
      if (countryConfig.currencyCode && countryConfig.currencyCode !== configStore$1.selectedCurrency) {
        this.logger.info(`Country currency is ${countryConfig.currencyCode}, updating...`);
        configStore$1.updateConfig({
          selectedCurrency: countryConfig.currencyCode
        });
        sessionStorage.setItem("next_selected_currency", countryConfig.currencyCode);
        await campaignStore.loadCampaign(configStore$1.apiKey, { forceFresh: true });
        await cartStore.refreshItemPrices();
        document.dispatchEvent(new CustomEvent("next:currency-changed", {
          detail: {
            from: configStore$1.selectedCurrency,
            to: countryConfig.currencyCode,
            source: "country-selector"
          }
        }));
      }
      this.logger.info(`Country changed successfully to ${newCountry}`);
      document.dispatchEvent(new CustomEvent("next:country-changed", {
        detail: {
          from: oldCountry,
          to: newCountry,
          currency: countryConfig.currencyCode
        }
      }));
      document.dispatchEvent(new CustomEvent("debug:update-content"));
      this.showSuccessFeedback(newCountry);
      this.render();
    } catch (error) {
      this.logger.error("Failed to change country:", error);
      this.showErrorFeedback();
      const currentCountry = sessionStorage.getItem("next_selected_country") || configStore.getState().detectedCountry || "US";
      if (select) select.value = currentCountry;
    } finally {
      this.isChanging = false;
      if (select) select.disabled = false;
      if (loadingIndicator) loadingIndicator.classList.remove("active");
    }
  }
  showSuccessFeedback(_country) {
    const selector = this.shadowRoot?.querySelector(".country-selector");
    if (!selector) return;
    selector.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
    setTimeout(() => {
      selector.style.background = "linear-gradient(135deg, #222 0%, #1a1a1a 100%)";
    }, 1e3);
  }
  showErrorFeedback() {
    const selector = this.shadowRoot?.querySelector(".country-selector");
    if (!selector) return;
    selector.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
    setTimeout(() => {
      selector.style.background = "linear-gradient(135deg, #222 0%, #1a1a1a 100%)";
    }, 1e3);
  }
  destroy() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
  hide() {
    if (this.container) {
      this.container.style.display = "none";
    }
  }
  show() {
    if (this.container) {
      this.container.style.display = "block";
    }
  }
}
const countrySelector = CountrySelector.getInstance();
class LocaleSelector {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.logger = new Logger("LocaleSelector");
    this.isChanging = false;
    this.listenersAttached = false;
    this.renderDebounceTimer = null;
    this.hasInitiallyRendered = false;
    this.locales = [
      { code: "en-US", name: "English (US)", flag: "🇺🇸" },
      { code: "en-GB", name: "English (UK)", flag: "🇬🇧" },
      { code: "en-CA", name: "English (CA)", flag: "🇨🇦" },
      { code: "en-AU", name: "English (AU)", flag: "🇦🇺" },
      { code: "pt-BR", name: "Português (BR)", flag: "🇧🇷" },
      { code: "es-ES", name: "Español (ES)", flag: "🇪🇸" },
      { code: "es-MX", name: "Español (MX)", flag: "🇲🇽" },
      { code: "fr-FR", name: "Français", flag: "🇫🇷" },
      { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
      { code: "it-IT", name: "Italiano", flag: "🇮🇹" },
      { code: "ja-JP", name: "日本語", flag: "🇯🇵" },
      { code: "zh-CN", name: "中文", flag: "🇨🇳" },
      { code: "ko-KR", name: "한국어", flag: "🇰🇷" },
      { code: "ru-RU", name: "Русский", flag: "🇷🇺" },
      { code: "ar-SA", name: "العربية", flag: "🇸🇦" },
      { code: "hi-IN", name: "हिन्दी", flag: "🇮🇳" },
      { code: "nl-NL", name: "Nederlands", flag: "🇳🇱" },
      { code: "sv-SE", name: "Svenska", flag: "🇸🇪" },
      { code: "pl-PL", name: "Polski", flag: "🇵🇱" },
      { code: "tr-TR", name: "Türkçe", flag: "🇹🇷" }
    ];
  }
  static getInstance() {
    if (!LocaleSelector.instance) {
      LocaleSelector.instance = new LocaleSelector();
    }
    return LocaleSelector.instance;
  }
  initialize() {
    this.createContainer();
    this.render();
    this.setupEventListeners();
    this.logger.info("Locale selector initialized");
  }
  createContainer() {
    if (this.container) {
      this.container.remove();
    }
    this.container = document.createElement("div");
    this.container.id = "debug-locale-selector";
    this.container.style.cssText = `
      position: relative;
      pointer-events: auto;
    `;
    this.shadowRoot = this.container.attachShadow({ mode: "open" });
    document.body.appendChild(this.container);
  }
  getCurrentLocale() {
    const savedLocale = sessionStorage.getItem("next_selected_locale");
    if (savedLocale) {
      return savedLocale;
    }
    return navigator.language || "en-US";
  }
  render() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    this.renderDebounceTimer = setTimeout(() => {
      this.doRender();
    }, 50);
  }
  doRender() {
    if (!this.shadowRoot) return;
    const currentLocale = this.getCurrentLocale();
    const detectedLocale = navigator.language || "en-US";
    if (this.container) {
      this.container.style.display = "block";
    }
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .locale-selector {
          background: linear-gradient(135deg, #222 0%, #1a1a1a 100%);
          backdrop-filter: blur(10px);
          border: 1px solid #333;
          border-radius: 4px;
          padding: 4px 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .locale-selector:hover {
          background: linear-gradient(135deg, #2a2a2a 0%, #222 100%);
          border-color: #444;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .locale-label {
          color: rgba(255, 255, 255, 0.9);
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
        }

        .locale-select {
          appearance: none;
          background: #2a2a2a;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          padding: 2px 20px 2px 6px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          min-width: 100px;
          max-width: 140px;
        }

        .locale-select option {
          background: #2a2a2a;
          color: rgba(255, 255, 255, 0.9);
          padding: 4px;
        }

        .locale-select:hover {
          background: #333;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .locale-select:focus {
          outline: none;
          border-color: #4299e1;
          background: #333;
        }

        .locale-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .select-arrow {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: rgba(255, 255, 255, 0.6);
          width: 10px;
          height: 10px;
        }

        .loading-indicator {
          display: none;
          width: 10px;
          height: 10px;
          border: 1px solid #cbd5e0;
          border-top-color: #4299e1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-indicator.active {
          display: inline-block;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .reset-button {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 3px;
          color: #ff6b6b;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reset-button:hover {
          background: rgba(239, 68, 68, 0.3);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ff8787;
        }

        .detected-info {
          color: rgba(255, 255, 255, 0.5);
          font-size: 10px;
          font-weight: 400;
          white-space: nowrap;
          padding-left: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.2);
        }

        .detected-value {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }
      </style>

      <div class="locale-selector">
        <span class="locale-label">🌐</span>
        
        <div class="select-wrapper">
          <select class="locale-select" id="locale-select">
            ${this.locales.map((locale) => `
              <option value="${locale.code}" ${locale.code === currentLocale ? "selected" : ""}>
                ${locale.flag} ${locale.code}
              </option>
            `).join("")}
          </select>
          <svg class="select-arrow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
          </svg>
        </div>

        <div class="loading-indicator" id="loading-indicator"></div>

        ${detectedLocale !== currentLocale ? `
          <button class="reset-button" id="reset-button" title="Reset to browser locale: ${detectedLocale}">
            Reset
          </button>
        ` : ""}

        <div class="detected-info">
          Browser: <span class="detected-value">${detectedLocale}</span>
        </div>
      </div>
    `;
    if (!this.hasInitiallyRendered) {
      this.hasInitiallyRendered = true;
    }
  }
  setupEventListeners() {
    if (!this.shadowRoot || this.listenersAttached) return;
    this.shadowRoot.addEventListener("change", async (e) => {
      const target = e.target;
      if (target && target.id === "locale-select") {
        const selectElement = target;
        const newLocale = selectElement.value;
        if (this.isChanging) {
          this.logger.warn("Locale change already in progress");
          return;
        }
        this.logger.debug(`Locale select changed to: ${newLocale}`);
        await this.handleLocaleChange(newLocale);
      }
    });
    this.shadowRoot.addEventListener("click", async (e) => {
      const target = e.target;
      if (target && target.id === "reset-button") {
        const detectedLocale = navigator.language || "en-US";
        this.logger.debug("Resetting to browser locale:", detectedLocale);
        await this.handleLocaleChange(detectedLocale, true);
      }
    });
    document.addEventListener("next:locale-changed", () => {
      this.logger.debug("External locale change detected, re-rendering selector");
      this.render();
    });
    this.listenersAttached = true;
    this.logger.debug("Event listeners attached to locale selector");
  }
  async handleLocaleChange(newLocale, isReset = false) {
    this.isChanging = true;
    const select = this.shadowRoot?.getElementById("locale-select");
    const loadingIndicator = this.shadowRoot?.getElementById("loading-indicator");
    if (select) select.disabled = true;
    if (loadingIndicator) loadingIndicator.classList.add("active");
    try {
      this.logger.info(`Changing locale to ${newLocale}`);
      const oldLocale = this.getCurrentLocale();
      if (isReset) {
        sessionStorage.removeItem("next_selected_locale");
        this.logger.info("Cleared selected locale override, using browser locale");
      } else {
        sessionStorage.setItem("next_selected_locale", newLocale);
        this.logger.info(`Saved selected locale to session: ${newLocale}`);
      }
      const { CurrencyFormatter } = await import("./utils-CrhivV-X.js").then((n) => n.y);
      CurrencyFormatter.clearCache();
      const { useCartStore: useCartStore2 } = await import("./analytics-CehPPcOg.js").then((n) => n.f);
      const cartStore = useCartStore2.getState();
      await cartStore.calculateTotals();
      document.dispatchEvent(new CustomEvent("next:locale-changed", {
        detail: {
          from: oldLocale,
          to: newLocale,
          source: "locale-selector"
        }
      }));
      document.dispatchEvent(new CustomEvent("debug:update-content"));
      document.dispatchEvent(new CustomEvent("next:display-refresh"));
      this.refreshAllCurrencyDisplays();
      this.showSuccessFeedback(newLocale);
      this.render();
      this.logFormatExamples(newLocale);
    } catch (error) {
      this.logger.error("Failed to change locale:", error);
      this.showErrorFeedback();
      const currentLocale = this.getCurrentLocale();
      if (select) select.value = currentLocale;
    } finally {
      this.isChanging = false;
      if (select) select.disabled = false;
      if (loadingIndicator) loadingIndicator.classList.remove("active");
    }
  }
  refreshAllCurrencyDisplays() {
    const displayElements = document.querySelectorAll("[data-next-display]");
    displayElements.forEach((element) => {
      const displayType = element.getAttribute("data-next-display");
      if (displayType?.includes("price") || displayType?.includes("total") || displayType?.includes("subtotal") || displayType?.includes("cost") || displayType?.includes("amount")) {
        element.dispatchEvent(new CustomEvent("next:refresh-display", { bubbles: true }));
      }
    });
    const priceElements = document.querySelectorAll(
      '.next-price, .next-total, .next-subtotal, .next-amount, [class*="price"], [class*="total"], [class*="amount"]'
    );
    priceElements.forEach((element) => {
      const text = element.textContent || "";
      if (/[$£€¥₹₽¢]/u.test(text) || /\d+[.,]\d{2}/.test(text)) {
        element.dispatchEvent(new CustomEvent("next:refresh-display", { bubbles: true }));
      }
    });
    this.logger.debug(`Refreshed ${displayElements.length + priceElements.length} potential currency displays`);
  }
  logFormatExamples(locale) {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol"
    });
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const numberFormatter = new Intl.NumberFormat(locale);
    console.log(`%c[LocaleSelector] Format examples for ${locale}:`, "color: #4299e1; font-weight: bold");
    console.log("Currency:", formatter.format(1234.56));
    console.log("Date:", dateFormatter.format(/* @__PURE__ */ new Date()));
    console.log("Number:", numberFormatter.format(123456789e-2));
  }
  showSuccessFeedback(_locale) {
    const selector = this.shadowRoot?.querySelector(".locale-selector");
    if (!selector) return;
    selector.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
    setTimeout(() => {
      selector.style.background = "linear-gradient(135deg, #222 0%, #1a1a1a 100%)";
    }, 1e3);
  }
  showErrorFeedback() {
    const selector = this.shadowRoot?.querySelector(".locale-selector");
    if (!selector) return;
    selector.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
    setTimeout(() => {
      selector.style.background = "linear-gradient(135deg, #222 0%, #1a1a1a 100%)";
    }, 1e3);
  }
  destroy() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
  hide() {
    if (this.container) {
      this.container.style.display = "none";
    }
  }
  show() {
    if (this.container) {
      this.container.style.display = "block";
    }
  }
}
const localeSelector = LocaleSelector.getInstance();
class SelectorContainer {
  constructor() {
    this.container = null;
    this.setupPanelListener();
  }
  static getInstance() {
    if (!SelectorContainer.instance) {
      SelectorContainer.instance = new SelectorContainer();
    }
    return SelectorContainer.instance;
  }
  initialize() {
    this.createContainer();
    currencySelector.initialize();
    countrySelector.initialize();
    localeSelector.initialize();
    this.moveSelectorsToContainer();
  }
  createContainer() {
    if (this.container) {
      this.container.remove();
    }
    this.container = document.createElement("div");
    this.container.id = "debug-selectors-container";
    this.container.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
      z-index: 999998;
      pointer-events: auto;
      transition: bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(this.container);
  }
  moveSelectorsToContainer() {
    if (!this.container) return;
    setTimeout(() => {
      const currencySel = document.getElementById("debug-currency-selector");
      const countrySel = document.getElementById("debug-country-selector");
      const localeSel = document.getElementById("debug-locale-selector");
      if (currencySel) {
        currencySel.style.position = "relative";
        currencySel.style.bottom = "auto";
        currencySel.style.left = "auto";
        currencySel.style.transform = "none";
        this.container.appendChild(currencySel);
      }
      if (countrySel) {
        countrySel.style.position = "relative";
        countrySel.style.bottom = "auto";
        countrySel.style.left = "auto";
        countrySel.style.transform = "none";
        this.container.appendChild(countrySel);
      }
      if (localeSel) {
        localeSel.style.position = "relative";
        localeSel.style.bottom = "auto";
        localeSel.style.left = "auto";
        localeSel.style.transform = "none";
        this.container.appendChild(localeSel);
      }
    }, 100);
  }
  setupPanelListener() {
    const checkForOverlay = () => {
      const shadowHost = document.getElementById("next-debug-overlay-host");
      if (shadowHost && shadowHost.shadowRoot) {
        const debugOverlay2 = shadowHost.shadowRoot.querySelector(".enhanced-debug-overlay");
        if (debugOverlay2) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === "attributes" && mutation.attributeName === "class") {
                const target = mutation.target;
                if (target.classList.contains("enhanced-debug-overlay")) {
                  const isExpanded2 = target.classList.contains("expanded");
                  this.updatePosition(isExpanded2);
                }
              }
            });
          });
          observer.observe(debugOverlay2, {
            attributes: true,
            attributeFilter: ["class"]
          });
          const isExpanded = debugOverlay2.classList.contains("expanded");
          this.updatePosition(isExpanded);
        }
      }
    };
    setTimeout(checkForOverlay, 500);
    document.addEventListener("debug:panel-toggled", ((e) => {
      this.updatePosition(e.detail?.isExpanded || false);
    }));
  }
  updatePosition(isExpanded) {
    if (!this.container) return;
    if (isExpanded) {
      this.container.style.bottom = "calc(max(40vh, 450px) + 10px)";
    } else {
      this.container.style.bottom = "70px";
    }
  }
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
const selectorContainer = SelectorContainer.getInstance();
class UpsellSelector {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.logger = new Logger("UpsellSelector");
    this.eventBus = EventBus.getInstance();
    this.state = { mode: "none", quantity: 1 };
    this.isUpsellPage = false;
    this.renderDebounceTimer = null;
  }
  static getInstance() {
    if (!UpsellSelector.instance) {
      UpsellSelector.instance = new UpsellSelector();
    }
    return UpsellSelector.instance;
  }
  initialize() {
    this.checkIfUpsellPage();
    if (!this.isUpsellPage) {
      this.logger.debug("Not an upsell page, skipping initialization");
      return;
    }
    this.createContainer();
    this.setupEventListeners();
    this.scanExistingUpsells();
    this.logger.info("UpsellSelector initialized");
  }
  createContainer() {
    if (this.container) {
      this.container.remove();
    }
    this.container = document.createElement("div");
    this.container.id = "debug-upsell-display";
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999998;
      pointer-events: auto;
    `;
    this.shadowRoot = this.container.attachShadow({ mode: "open" });
    document.body.appendChild(this.container);
  }
  scanExistingUpsells() {
    const upsellElements = document.querySelectorAll('[data-next-upsell="offer"], [data-next-upsell-selector]');
    this.logger.debug("Scanning for existing upsell elements:", upsellElements.length);
    if (upsellElements.length === 0) {
      this.logger.debug("No upsell elements found");
      return;
    }
    const firstElement = upsellElements[0];
    let selectorId = firstElement.getAttribute("data-next-selector-id");
    let packageIdAttr = firstElement.getAttribute("data-next-package-id");
    let packageId = packageIdAttr ? parseInt(packageIdAttr, 10) : void 0;
    if (!packageId) {
      const selectedOption = firstElement.querySelector('[data-next-upsell-option][data-next-selected="true"]');
      if (selectedOption) {
        const selectedPackageIdAttr = selectedOption.getAttribute("data-next-package-id");
        packageId = selectedPackageIdAttr ? parseInt(selectedPackageIdAttr, 10) : void 0;
        this.logger.debug("Found selected option:", { packageId });
      }
      if (!packageId) {
        const anyOption = firstElement.querySelector("[data-next-upsell-option][data-next-package-id]");
        if (anyOption) {
          const optionPackageIdAttr = anyOption.getAttribute("data-next-package-id");
          packageId = optionPackageIdAttr ? parseInt(optionPackageIdAttr, 10) : void 0;
          this.logger.debug("Found first available option:", { packageId });
        }
      }
    }
    if (!selectorId) {
      const nestedSelector = firstElement.querySelector("[data-next-selector-id]");
      if (nestedSelector) {
        selectorId = nestedSelector.getAttribute("data-next-selector-id") || null;
        this.logger.debug("Found nested selector:", { selectorId });
      }
    }
    this.state = {
      packageId: packageId || void 0,
      selectorId: selectorId || void 0,
      quantity: 1,
      mode: selectorId ? "selector" : packageId ? "direct" : "none"
    };
    this.render();
    this.logger.debug("Initialized state from existing upsell element:", {
      mode: this.state.mode,
      packageId: this.state.packageId,
      selectorId: this.state.selectorId
    });
  }
  checkIfUpsellPage() {
    const pageTypeMeta = document.querySelector('meta[name="next-page-type"]');
    this.isUpsellPage = pageTypeMeta?.getAttribute("content") === "upsell";
  }
  setupEventListeners() {
    this.eventBus.on("upsell:initialized", (data) => {
      const { packageId, element } = data;
      this.logger.debug("Upsell initialized:", data);
      if (!element) return;
      const selectorId = element.getAttribute("data-next-selector-id");
      this.state = {
        packageId: packageId || void 0,
        selectorId: selectorId || void 0,
        quantity: 1,
        mode: selectorId ? "selector" : "direct"
      };
      this.render();
    });
    this.eventBus.on("upsell:option-selected", (data) => {
      const { packageId, selectorId } = data;
      this.logger.debug("Upsell option selected:", data);
      this.state.packageId = packageId;
      if (selectorId) {
        this.state.selectorId = selectorId;
      }
      this.render();
    });
    this.eventBus.on("upsell:quantity-changed", (data) => {
      const { quantity } = data;
      this.logger.debug("Upsell quantity changed:", data);
      this.state.quantity = quantity;
      this.render();
    });
  }
  getPackageName(packageId) {
    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.getPackage(packageId);
    return packageData?.name || `Package ${packageId}`;
  }
  render() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    this.renderDebounceTimer = setTimeout(() => {
      this.doRender();
    }, 50);
  }
  doRender() {
    if (!this.shadowRoot) return;
    if (this.state.mode === "none" || !this.isUpsellPage) {
      if (this.container) {
        this.container.style.display = "none";
      }
      return;
    }
    if (this.container) {
      this.container.style.display = "block";
    }
    const packageName = this.state.packageId ? this.getPackageName(this.state.packageId) : "None";
    const modeLabel = this.state.mode === "selector" ? "🎯 Selector" : "➡️ Direct";
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .upsell-badge {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(99, 102, 241, 0.4);
          border-radius: 8px;
          padding: 14px 18px;
          display: inline-flex;
          flex-direction: column;
          gap: 10px;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.1);
          transition: all 0.2s ease;
          min-width: 320px;
        }

        .upsell-badge:hover {
          background: linear-gradient(135deg, rgba(51, 65, 85, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border-color: rgba(99, 102, 241, 0.6);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.2);
          transform: translateY(-1px);
        }

        .badge-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .debug-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          flex: 1;
        }

        .mode-badge {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .info-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 500;
          min-width: 50px;
        }

        .info-value {
          color: rgba(255, 255, 255, 0.95);
          font-size: 14px;
          font-weight: 600;
          flex: 1;
        }

        .package-id {
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #c7d2fe;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
        }

        .package-name {
          color: rgba(255, 255, 255, 0.9);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quantity-badge {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
        }

        .selector-id-value {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-family: 'Courier New', monospace;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: 4px;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-left: auto;
        }

        .status-indicator.selected {
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);
        }

        .status-indicator.unselected {
          background: rgba(255, 255, 255, 0.2);
        }
      </style>

      <div class="upsell-badge">
        <div class="badge-header">
          <span class="debug-label">🔍 Debug Info</span>
          <span class="mode-badge">${modeLabel}</span>
        </div>

        <div class="badge-content">
          ${this.state.packageId ? `
            <div class="info-row">
              <span class="info-label">Package:</span>
              <span class="package-id">#${this.state.packageId}</span>
              <span class="status-indicator selected"></span>
            </div>
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span class="info-value package-name" title="${packageName}">${packageName}</span>
            </div>
          ` : `
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">No selection</span>
              <span class="status-indicator unselected"></span>
            </div>
          `}

          ${this.state.quantity > 1 ? `
            <div class="info-row">
              <span class="info-label">Qty:</span>
              <span class="quantity-badge">×${this.state.quantity}</span>
            </div>
          ` : ""}

          ${this.state.selectorId ? `
            <div class="info-row">
              <span class="info-label">ID:</span>
              <span class="selector-id-value">${this.state.selectorId}</span>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }
  destroy() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
  hide() {
    if (this.container) {
      this.container.style.display = "none";
    }
  }
  show() {
    if (this.container && this.isUpsellPage) {
      this.container.style.display = "block";
    }
  }
}
const upsellSelector = UpsellSelector.getInstance();
class RawDataHelper {
  static generateRawDataContent(data) {
    const dataStr = JSON.stringify(data, null, 2);
    const uniqueId = `copy-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return `
      <style>
        .raw-data-wrapper {
          position: relative;
          height: auto;
          background: #0f0f0f;
        }
        .copy-button-fixed {
          position: sticky;
          top: 12px;
          float: right;
          margin: 12px;
          background: rgba(60, 125, 255, 0.9);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s ease;
          z-index: 100;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          backdrop-filter: blur(10px);
        }
        .copy-button-fixed:hover {
          background: rgba(60, 125, 255, 1);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(60, 125, 255, 0.3);
        }
        .copy-button-fixed:active {
          transform: translateY(0);
        }
        .copy-button-fixed.copied {
          background: rgba(76, 175, 80, 0.9);
        }
        .copy-button-fixed.copied:hover {
          background: rgba(76, 175, 80, 1);
        }
        .json-content {
          padding: 20px;
          padding-top: 1rem;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: #e6e6e6;
          white-space: pre;
          word-break: break-all;
        }
      </style>
      <div class="raw-data-wrapper">
        <button id="${uniqueId}" class="copy-button-fixed" onclick="
          (function() {
            const btn = document.getElementById('${uniqueId}');
            const dataToCopy = ${JSON.stringify(dataStr).replace(/"/g, "&quot;").replace(/'/g, "\\'")};
            navigator.clipboard.writeText(dataToCopy).then(() => {
              btn.innerHTML = '<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M9,5H7A2,2 0 0,0 5,7V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V7A2,2 0 0,0 17,5H15M12,2L14,5H10L12,2M10,18L7,15L8.41,13.59L10,15.17L15.59,9.59L17,11L10,18Z\\'/></svg> Copied!';
              btn.classList.add('copied');
              setTimeout(() => {
                btn.innerHTML = '<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z\\'/></svg> Copy';
                btn.classList.remove('copied');
              }, 2000);
            }).catch(err => {
              console.error('Failed to copy:', err);
            });
          })();
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
          </svg>
          Copy
        </button>
        <div class="json-content">${dataStr}</div>
      </div>
    `;
  }
}
class CartPanel {
  constructor() {
    this.id = "cart";
    this.title = "Cart State";
    this.icon = "🛒";
  }
  getContent() {
    const tabs = this.getTabs();
    return tabs[0]?.getContent() || "";
  }
  getTabs() {
    return [
      {
        id: "overview",
        label: "Overview",
        icon: "📊",
        getContent: () => this.getOverviewContent()
      },
      {
        id: "items",
        label: "Items",
        icon: "📦",
        getContent: () => this.getItemsContent()
      },
      {
        id: "raw",
        label: "Raw Data",
        icon: "🔧",
        getContent: () => this.getRawDataContent()
      }
    ];
  }
  getOverviewContent() {
    const cartState = useCartStore.getState();
    return `
      <div class="enhanced-panel">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">📦</div>
            <div class="metric-content">
              <div class="metric-value">${cartState.items.length}</div>
              <div class="metric-label">Unique Items</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🔢</div>
            <div class="metric-content">
              <div class="metric-value">${cartState.totalQuantity}</div>
              <div class="metric-label">Total Quantity</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">💰</div>
            <div class="metric-content">
              <div class="metric-value">${cartState.totals.subtotal.formatted}</div>
              <div class="metric-label">Subtotal</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🚚</div>
            <div class="metric-content">
              <div class="metric-value">${cartState.totals.shipping.formatted}</div>
              <div class="metric-label">Shipping</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📊</div>
            <div class="metric-content">
              <div class="metric-value">${cartState.totals.tax.formatted}</div>
              <div class="metric-label">Tax</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">💳</div>
            <div class="metric-content">
              <div class="metric-value">${cartState.totals.total.formatted}</div>
              <div class="metric-label">Total</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  getItemsContent() {
    const cartState = useCartStore.getState();
    return `
      <div class="enhanced-panel">
        <div class="section">
          ${cartState.items.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">🛒</div>
              <div class="empty-text">Cart is empty</div>
              <button class="empty-action" onclick="window.nextDebug.addTestItems()">Add Test Items</button>
            </div>
          ` : `
            <div class="cart-items-list">
              ${cartState.items.map((item) => `
                <div class="cart-item-card">
                  <div class="item-info">
                    <div class="item-title">${item.title}</div>
                    <div class="item-details">
                      Package ID: ${item.packageId} • Price: $${item.price}
                    </div>
                  </div>
                  <div class="item-quantity">
                    <button onclick="window.nextDebug.updateQuantity(${item.packageId}, ${item.quantity - 1})" 
                            class="qty-btn">-</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button onclick="window.nextDebug.updateQuantity(${item.packageId}, ${item.quantity + 1})" 
                            class="qty-btn">+</button>
                  </div>
                  <div class="item-total">$${(item.price * item.quantity).toFixed(2)}</div>
                  <button onclick="window.nextDebug.removeItem(${item.packageId})" 
                          class="remove-btn">×</button>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      </div>
    `;
  }
  getRawDataContent() {
    const cartState = useCartStore.getState();
    return RawDataHelper.generateRawDataContent(cartState);
  }
  getActions() {
    return [
      {
        label: "Clear Cart",
        action: () => useCartStore.getState().clear(),
        variant: "danger"
      },
      {
        label: "Add Test Items",
        action: this.addTestItems,
        variant: "secondary"
      },
      {
        label: "Recalculate",
        action: () => useCartStore.getState().calculateTotals(),
        variant: "primary"
      },
      {
        label: "Export Cart",
        action: this.exportCart,
        variant: "secondary"
      }
    ];
  }
  addTestItems() {
    const cartStore = useCartStore.getState();
    const testItems = [
      { packageId: 999, quantity: 1, price: 19.99, title: "Debug Test Item 1", isUpsell: false },
      { packageId: 998, quantity: 2, price: 29.99, title: "Debug Test Item 2", isUpsell: false },
      { packageId: 997, quantity: 1, price: 9.99, title: "Debug Test Item 3", isUpsell: false }
    ];
    testItems.forEach((item) => cartStore.addItem(item));
  }
  exportCart() {
    const cartState = useCartStore.getState();
    const data = JSON.stringify(cartState, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cart-state-${(/* @__PURE__ */ new Date()).toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
class OrderPanel {
  constructor() {
    this.id = "order";
    this.title = "Order State";
    this.icon = "📦";
  }
  getContent() {
    const tabs = this.getTabs();
    return tabs[0]?.getContent() || "";
  }
  getTabs() {
    return [
      {
        id: "overview",
        label: "Overview",
        icon: "📊",
        getContent: () => this.getOverviewContent()
      },
      {
        id: "lines",
        label: "Order Lines",
        icon: "📋",
        getContent: () => this.getOrderLinesContent()
      },
      {
        id: "addresses",
        label: "Addresses",
        icon: "📍",
        getContent: () => this.getAddressesContent()
      },
      {
        id: "raw",
        label: "Raw Data",
        icon: "🔧",
        getContent: () => this.getRawDataContent()
      }
    ];
  }
  getOverviewContent() {
    const orderState = useOrderStore.getState();
    const order = orderState.order;
    if (!order) {
      return this.getEmptyState();
    }
    const orderTotal = orderState.getOrderTotal();
    const canAddUpsells = orderState.canAddUpsells();
    const currency = order.currency || "USD";
    const currencySymbol = this.getCurrencySymbol(currency);
    return `
      <div class="enhanced-panel">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">🔖</div>
            <div class="metric-content">
              <div class="metric-value">${order.number || "N/A"}</div>
              <div class="metric-label">Order Number</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🆔</div>
            <div class="metric-content">
              <div class="metric-value" style="font-size: 0.9em; word-break: break-all;">${orderState.refId || "N/A"}</div>
              <div class="metric-label">Reference ID</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📦</div>
            <div class="metric-content">
              <div class="metric-value">${order.lines?.length || 0}</div>
              <div class="metric-label">Total Lines</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🎯</div>
            <div class="metric-content">
              <div class="metric-value">${order.lines?.filter((l) => l.is_upsell).length || 0}</div>
              <div class="metric-label">Upsells</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">💰</div>
            <div class="metric-content">
              <div class="metric-value">${currencySymbol}${orderTotal.toFixed(2)}</div>
              <div class="metric-label">Order Total</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">${canAddUpsells ? "✅" : "❌"}</div>
            <div class="metric-content">
              <div class="metric-value">${canAddUpsells ? "Yes" : "No"}</div>
              <div class="metric-label">Can Add Upsells</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h4>Order Details</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value">Active</span>
            </div>
            <div class="info-item">
              <span class="info-label">Currency:</span>
              <span class="info-value">${order.currency || "USD"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Loaded At:</span>
              <span class="info-value">${orderState.orderLoadedAt ? new Date(orderState.orderLoadedAt).toLocaleString() : "N/A"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Shipping Method:</span>
              <span class="info-value">${order.shipping_method || "N/A"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Order URL:</span>
              <span class="info-value" style="font-size: 0.8em; word-break: break-all;">${order.order_status_url ? "Available" : "N/A"}</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h4>Totals Breakdown</h4>
          <div class="totals-breakdown">
            <div class="total-item">
              <span>Subtotal (excl. tax):</span>
              <span>${currencySymbol}${parseFloat(order.total_excl_tax || "0").toFixed(2)}</span>
            </div>
            <div class="total-item">
              <span>Shipping:</span>
              <span>${currencySymbol}${parseFloat(order.shipping_excl_tax || "0").toFixed(2)}</span>
            </div>
            <div class="total-item">
              <span>Tax:</span>
              <span>${currencySymbol}${parseFloat(order.total_tax || "0").toFixed(2)}</span>
            </div>
            <div class="total-item total-final">
              <span>Total (incl. tax):</span>
              <span>${currencySymbol}${parseFloat(order.total_incl_tax || "0").toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  getOrderLinesContent() {
    const orderState = useOrderStore.getState();
    const order = orderState.order;
    if (!order || !order.lines || order.lines.length === 0) {
      return this.getEmptyState("No order lines available");
    }
    const currency = order.currency || "USD";
    const currencySymbol = this.getCurrencySymbol(currency);
    return `
      <div class="enhanced-panel">
        <div class="section">
          <style>
            .order-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.9em;
            }
            .order-table th {
              background: rgba(255, 255, 255, 0.05);
              padding: 8px;
              text-align: left;
              border-bottom: 2px solid rgba(255, 255, 255, 0.1);
              font-weight: 600;
            }
            .order-table td {
              padding: 8px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            .order-table tr:hover {
              background: rgba(255, 255, 255, 0.02);
            }
            .order-table .upsell-row {
              background: rgba(255, 215, 0, 0.05);
            }
            .order-table .upsell-badge {
              background: #ffd700;
              color: #000;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 0.75em;
              font-weight: bold;
              margin-left: 8px;
              display: inline-block;
            }
            .order-table .text-right {
              text-align: right;
            }
            .order-table .text-center {
              text-align: center;
            }
          </style>
          
          <table class="order-table">
            <thead>
              <tr>
                <th style="width: 5%">#</th>
                <th style="width: 35%">Product</th>
                <th style="width: 15%">SKU</th>
                <th style="width: 10%" class="text-center">Qty</th>
                <th style="width: 12%" class="text-right">Price</th>
                <th style="width: 11%" class="text-right">Tax</th>
                <th style="width: 12%" class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.lines.map((line, index) => `
                <tr ${line.is_upsell ? 'class="upsell-row"' : ""}>
                  <td>${index + 1}</td>
                  <td>
                    ${line.product_title || line.title || "Unknown Product"}
                    ${line.is_upsell ? '<span class="upsell-badge">POST-PURCHASE</span>' : ""}
                  </td>
                  <td>${line.product_sku || "N/A"}</td>
                  <td class="text-center">${line.quantity || 1}</td>
                  <td class="text-right">${currencySymbol}${parseFloat(line.price_excl_tax || "0").toFixed(2)}</td>
                  <td class="text-right">${currencySymbol}${(parseFloat(line.price_incl_tax || "0") - parseFloat(line.price_excl_tax || "0")).toFixed(2)}</td>
                  <td class="text-right"><strong>${currencySymbol}${parseFloat(line.price_incl_tax || "0").toFixed(2)}</strong></td>
                </tr>
              `).join("")}
              
              <tr style="border-top: 2px solid rgba(255, 255, 255, 0.1);">
                <td colspan="6" class="text-right"><strong>Order Total:</strong></td>
                <td class="text-right"><strong>${currencySymbol}${parseFloat(order.total_incl_tax || "0").toFixed(2)} ${currency}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  getAddressesContent() {
    const orderState = useOrderStore.getState();
    const order = orderState.order;
    if (!order) {
      return this.getEmptyState();
    }
    const formatAddressTable = (address, type) => {
      const icon = type === "shipping" ? "📦" : "💳";
      const title = type === "shipping" ? "Shipping Address" : "Billing Address";
      if (!address) {
        return `
          <div class="address-table-container">
            <div class="address-header">
              <span class="address-icon">${icon}</span>
              <h4>${title}</h4>
            </div>
            <div class="address-empty">No ${type} address provided</div>
          </div>
        `;
      }
      return `
        <div class="address-table-container">
          <div class="address-header">
            <span class="address-icon">${icon}</span>
            <h4>${title}</h4>
          </div>
          <table class="address-table">
            <tbody>
              ${address.first_name || address.last_name ? `
                <tr>
                  <td class="field-label">Name</td>
                  <td class="field-value">${address.first_name || ""} ${address.last_name || ""}</td>
                </tr>
              ` : ""}
              ${address.line1 ? `
                <tr>
                  <td class="field-label">Address 1</td>
                  <td class="field-value">${address.line1}</td>
                </tr>
              ` : ""}
              ${address.line2 ? `
                <tr>
                  <td class="field-label">Address 2</td>
                  <td class="field-value">${address.line2}</td>
                </tr>
              ` : ""}
              ${address.line4 || address.state || address.postcode ? `
                <tr>
                  <td class="field-label">City/State/Zip</td>
                  <td class="field-value">${address.line4 || ""}${address.state ? `, ${address.state}` : ""} ${address.postcode || ""}</td>
                </tr>
              ` : ""}
              ${address.country ? `
                <tr>
                  <td class="field-label">Country</td>
                  <td class="field-value">${address.country}</td>
                </tr>
              ` : ""}
              ${address.phone_number ? `
                <tr>
                  <td class="field-label">Phone</td>
                  <td class="field-value">${address.phone_number}</td>
                </tr>
              ` : ""}
            </tbody>
          </table>
        </div>
      `;
    };
    return `
      <div class="enhanced-panel">
        <style>
          .addresses-container {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
          }
          .address-table-container {
            flex: 1;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          .address-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          .address-header h4 {
            margin: 0;
            font-size: 1em;
            font-weight: 600;
          }
          .address-icon {
            font-size: 1.2em;
          }
          .address-table {
            width: 100%;
            border-collapse: collapse;
          }
          .address-table td {
            padding: 10px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .address-table tr:last-child td {
            border-bottom: none;
          }
          .field-label {
            width: 40%;
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9em;
          }
          .field-value {
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.9em;
          }
          .address-empty {
            padding: 30px;
            text-align: center;
            color: rgba(255, 255, 255, 0.4);
            font-style: italic;
          }
          .customer-info-section {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          .customer-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          .customer-header h4 {
            margin: 0;
            font-size: 1em;
            font-weight: 600;
          }
          .customer-table {
            width: 100%;
            border-collapse: collapse;
          }
          .customer-table td {
            padding: 10px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .customer-table tr:last-child td {
            border-bottom: none;
          }
        </style>
        
        <div class="addresses-container">
          ${formatAddressTable(order.shipping_address, "shipping")}
          ${formatAddressTable(order.billing_address, "billing")}
        </div>
        
        <div class="customer-info-section">
          <div class="customer-header">
            <span class="address-icon">👤</span>
            <h4>Customer Information</h4>
          </div>
          <table class="customer-table">
            <tbody>
              <tr>
                <td class="field-label">Name</td>
                <td class="field-value">${order.user?.first_name || ""} ${order.user?.last_name || ""}</td>
              </tr>
              <tr>
                <td class="field-label">Email</td>
                <td class="field-value">${order.user?.email || "N/A"}</td>
              </tr>
              <tr>
                <td class="field-label">Phone</td>
                <td class="field-value">${order.user?.phone_number || "N/A"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  // Removed getUpsellsContent method as it's no longer needed
  getRawDataContent() {
    const orderState = useOrderStore.getState();
    return RawDataHelper.generateRawDataContent({
      order: orderState.order,
      refId: orderState.refId,
      orderLoadedAt: orderState.orderLoadedAt,
      isLoading: orderState.isLoading,
      isProcessingUpsell: orderState.isProcessingUpsell,
      error: orderState.error,
      upsellError: orderState.upsellError,
      pendingUpsells: orderState.pendingUpsells,
      completedUpsellPages: orderState.completedUpsellPages,
      viewedUpsellPages: orderState.viewedUpsellPages,
      upsellJourney: orderState.upsellJourney
    });
  }
  getEmptyState(message = "No order loaded") {
    return `
      <div class="enhanced-panel">
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-text">${message}</div>
          <div class="empty-hint">Load an order to see details here</div>
        </div>
      </div>
    `;
  }
  getActions() {
    const orderState = useOrderStore.getState();
    const actions = [];
    if (orderState.order) {
      actions.push({
        label: "Clear Order",
        action: () => orderState.clearOrder(),
        variant: "danger"
      });
      actions.push({
        label: "Reload Order",
        action: async () => {
          if (orderState.refId) {
            orderState.clearOrder();
            console.log("Reload order functionality requires API client");
          }
        },
        variant: "primary"
      });
      if (orderState.pendingUpsells.length > 0) {
        actions.push({
          label: "Clear Pending",
          action: () => orderState.clearPendingUpsells(),
          variant: "secondary"
        });
      }
      actions.push({
        label: "Export Order",
        action: this.exportOrder,
        variant: "secondary"
      });
    }
    actions.push({
      label: "Reset Store",
      action: () => orderState.reset(),
      variant: "danger"
    });
    return actions;
  }
  exportOrder() {
    const orderState = useOrderStore.getState();
    const data = JSON.stringify({
      order: orderState.order,
      refId: orderState.refId,
      upsellJourney: orderState.upsellJourney,
      completedUpsellPages: orderState.completedUpsellPages,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-state-${orderState.refId || "unknown"}-${(/* @__PURE__ */ new Date()).toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  getCurrencySymbol(currency) {
    const symbols = {
      "USD": "$",
      "EUR": "€",
      "GBP": "£",
      "AUD": "$",
      "CAD": "$",
      "JPY": "¥",
      "CNY": "¥",
      "INR": "₹",
      "KRW": "₩",
      "BRL": "R$",
      "MXN": "$",
      "CHF": "Fr",
      "SEK": "kr",
      "NOK": "kr",
      "DKK": "kr",
      "PLN": "zł",
      "RUB": "₽",
      "ZAR": "R",
      "NZD": "$",
      "SGD": "$",
      "HKD": "$",
      "THB": "฿",
      "PHP": "₱",
      "IDR": "Rp",
      "MYR": "RM",
      "VND": "₫",
      "TRY": "₺",
      "AED": "د.إ",
      "SAR": "﷼",
      "ILS": "₪",
      "EGP": "£",
      "COP": "$",
      "CLP": "$",
      "ARS": "$",
      "PEN": "S/"
    };
    return symbols[currency] || currency + " ";
  }
}
const INTERNAL_EVENT_PATTERNS = [
  "cart:updated",
  "cart:item-added",
  "cart:item-removed",
  "cart:quantity-changed",
  "cart:package-swapped",
  "campaign:loaded",
  "checkout:started",
  "checkout:form-initialized",
  "checkout:spreedly-ready",
  "checkout:express-started",
  "order:completed",
  "order:redirect-missing",
  "error:occurred",
  "timer:expired",
  "config:updated",
  "coupon:applied",
  "coupon:removed",
  "coupon:validation-failed",
  "selector:item-selected",
  "selector:action-completed",
  "selector:selection-changed",
  "shipping:method-selected",
  "shipping:method-changed",
  "action:success",
  "action:failed",
  "upsell:accepted",
  "upsell-selector:item-selected",
  "upsell:quantity-changed",
  "upsell:option-selected",
  "message:displayed",
  "payment:tokenized",
  "payment:error",
  "checkout:express-completed",
  "checkout:express-failed",
  "express-checkout:initialized",
  "express-checkout:error",
  "express-checkout:started",
  "express-checkout:failed",
  "express-checkout:completed",
  "express-checkout:redirect-missing",
  "address:autocomplete-filled",
  "address:location-fields-shown",
  "checkout:location-fields-shown",
  "checkout:billing-location-fields-shown",
  "upsell:initialized",
  "upsell:adding",
  "upsell:added",
  "upsell:error",
  "accordion:toggled",
  "accordion:opened",
  "accordion:closed",
  "upsell:skipped",
  "upsell:viewed",
  "exit-intent:shown",
  "exit-intent:clicked",
  "exit-intent:dismissed",
  "exit-intent:closed",
  "exit-intent:action",
  "fomo:shown"
];
const FILTERED_EVENTS = [
  "dataLayer.push",
  "gtm.dom",
  "gtm.js",
  "gtm.load",
  "gtm.click",
  "gtm.linkClick",
  "gtm.scrollDepth",
  "gtm.timer",
  "gtm.historyChange",
  "gtm.video"
];
const _EventTimelinePanel = class _EventTimelinePanel {
  // Clear after 2 hours
  constructor() {
    this.id = "event-timeline";
    this.title = "Events";
    this.icon = "⚡";
    this.events = [];
    this.maxEvents = 1e3;
    this.isRecording = true;
    this.showInternalEvents = false;
    this.updateTimeout = null;
    this.saveTimeout = null;
    this.selectedEventId = null;
    this.eventBus = EventBus.getInstance();
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.get("debugger") === "true" || urlParams.get("debug") === "true";
    if (isDebugMode) {
      this.loadSavedState();
      this.initializeEventWatching();
      _EventTimelinePanel.instance = this;
    }
  }
  loadSavedState() {
    this.checkAndCleanExpiredStorage();
    const savedShowInternal = localStorage.getItem(_EventTimelinePanel.SHOW_INTERNAL_KEY);
    if (savedShowInternal !== null) {
      this.showInternalEvents = savedShowInternal === "true";
    }
    try {
      const savedEvents = localStorage.getItem(_EventTimelinePanel.EVENTS_STORAGE_KEY);
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        if (Array.isArray(parsed)) {
          const oneHourAgo = Date.now() - 60 * 60 * 1e3;
          this.events = parsed.filter((event) => event.timestamp > oneHourAgo).slice(0, _EventTimelinePanel.MAX_STORED_EVENTS).map((event) => ({
            ...event,
            relativeTime: this.formatRelativeTime(event.timestamp)
          }));
        }
      }
    } catch (error) {
      console.error("Failed to load saved events:", error);
      localStorage.removeItem(_EventTimelinePanel.EVENTS_STORAGE_KEY);
    }
  }
  checkAndCleanExpiredStorage() {
    try {
      const expiryTime = localStorage.getItem(_EventTimelinePanel.STORAGE_EXPIRY_KEY);
      const now = Date.now();
      if (!expiryTime || parseInt(expiryTime) < now) {
        localStorage.removeItem(_EventTimelinePanel.EVENTS_STORAGE_KEY);
        const newExpiry = now + _EventTimelinePanel.STORAGE_EXPIRY_HOURS * 60 * 60 * 1e3;
        localStorage.setItem(_EventTimelinePanel.STORAGE_EXPIRY_KEY, newExpiry.toString());
      }
    } catch (error) {
      console.error("Failed to check storage expiry:", error);
    }
  }
  saveEvents() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const oneHourAgo = Date.now() - 60 * 60 * 1e3;
        const recentEvents = this.events.filter((event) => event.timestamp > oneHourAgo).slice(0, _EventTimelinePanel.MAX_STORED_EVENTS);
        if (recentEvents.length > 0) {
          const simplifiedEvents = recentEvents.map((event) => ({
            id: event.id,
            timestamp: event.timestamp,
            type: event.type,
            name: event.name,
            // Limit data size to first 200 chars if it's a string
            data: typeof event.data === "string" && event.data.length > 200 ? event.data.substring(0, 200) + "..." : event.data,
            source: event.source,
            isInternal: event.isInternal
          }));
          const serialized = this.safeStringify(simplifiedEvents);
          if (serialized.length > 5e5) {
            const halfEvents = simplifiedEvents.slice(0, Math.floor(simplifiedEvents.length / 2));
            localStorage.setItem(_EventTimelinePanel.EVENTS_STORAGE_KEY, this.safeStringify(halfEvents));
          } else {
            localStorage.setItem(_EventTimelinePanel.EVENTS_STORAGE_KEY, serialized);
          }
        }
        if (!localStorage.getItem(_EventTimelinePanel.STORAGE_EXPIRY_KEY)) {
          const expiry = Date.now() + _EventTimelinePanel.STORAGE_EXPIRY_HOURS * 60 * 60 * 1e3;
          localStorage.setItem(_EventTimelinePanel.STORAGE_EXPIRY_KEY, expiry.toString());
        }
      } catch (error) {
        console.error("Failed to save events:", error);
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          localStorage.removeItem(_EventTimelinePanel.EVENTS_STORAGE_KEY);
        }
      }
    }, 500);
  }
  safeStringify(obj) {
    const seen = /* @__PURE__ */ new WeakSet();
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }
      if (value instanceof Window) return "[Window]";
      if (value instanceof Document) return "[Document]";
      if (value instanceof HTMLElement) return "[HTMLElement]";
      if (value instanceof Node) return "[Node]";
      if (value instanceof Event) {
        return {
          type: value.type,
          target: value.target ? "[EventTarget]" : void 0,
          timeStamp: value.timeStamp,
          bubbles: value.bubbles,
          cancelable: value.cancelable
        };
      }
      if (typeof value === "function") return "[Function]";
      return value;
    });
  }
  toggleInternalEvents() {
    this.showInternalEvents = !this.showInternalEvents;
    localStorage.setItem(_EventTimelinePanel.SHOW_INTERNAL_KEY, String(this.showInternalEvents));
  }
  initializeEventWatching() {
    this.watchDataLayer();
    this.watchInternalEvents();
    this.watchDOMEvents();
    this.watchPerformanceEvents();
  }
  watchDataLayer() {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    const originalPush = window.dataLayer.push;
    window.dataLayer.push = (...args) => {
      if (this.isRecording) {
        args.forEach((event) => {
          let source = "GTM DataLayer";
          let isInternal = false;
          if (event.event && event.event.startsWith("gtm_")) {
            source = "GTM Internal";
            isInternal = true;
          } else if (event.timestamp || event.event_context) {
            source = "Analytics Manager";
          }
          if (event.event && INTERNAL_EVENT_PATTERNS.includes(event.event)) {
            isInternal = true;
          }
          this.addEvent({
            type: "dataLayer",
            name: event.event || "dataLayer.push",
            data: event,
            source,
            isInternal
          });
        });
      }
      return originalPush.apply(window.dataLayer, args);
    };
    if (window.dataLayer.length > 0) {
      window.dataLayer.forEach((event) => {
        if (typeof event === "object" && event.event) {
          this.addEvent({
            type: "dataLayer",
            name: event.event,
            data: event,
            source: "GTM DataLayer (Historical)",
            isInternal: INTERNAL_EVENT_PATTERNS.includes(event.event)
          });
        }
      });
    }
  }
  watchInternalEvents() {
    const eventHandler = (eventName, data) => {
      if (eventName.includes("error") || eventName.includes("Error")) {
        return;
      }
      if (this.isRecording) {
        this.addEvent({
          type: "internal",
          name: eventName,
          data,
          source: "SDK EventBus",
          isInternal: true
        });
      }
    };
    const originalEmit = this.eventBus.emit.bind(this.eventBus);
    this.eventBus.emit = (event, data) => {
      eventHandler(event, data);
      return originalEmit(event, data);
    };
  }
  watchDOMEvents() {
    if (typeof window === "undefined") return;
    const eventsToWatch = [
      "click",
      "submit",
      "change",
      "focus",
      "blur",
      "scroll",
      "resize",
      "load"
      // Removed 'error' to prevent infinite loops
    ];
    const eventsToIgnore = [
      "debug:event-added",
      "debug:update-content",
      "debug:panel-switched",
      // Webflow interaction events
      "ix2-animation-started",
      "ix2-animation-stopped",
      "ix2-animation-completed",
      "ix2-animation-paused",
      "ix2-animation-resumed",
      "ix2-animation",
      "ix2-element-hover",
      "ix2-element-unhover",
      "ix2-element-click",
      "ix2-page-start",
      "ix2-page-finish",
      "ix2-scroll",
      "ix2-tabs-change",
      "ix2-slider-change",
      "ix2-dropdown-open",
      "ix2-dropdown-close",
      // Other Webflow events
      "w-close",
      "w-open",
      "w-tab-active",
      "w-tab-inactive",
      "w-slider-move",
      "w-dropdown-toggle"
    ];
    const originalDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function(event) {
      if (event instanceof CustomEvent && !eventsToWatch.includes(event.type) && !eventsToIgnore.includes(event.type) && !event.type.startsWith("debug:") && !event.type.startsWith("ix2-") && !event.type.startsWith("w-") && !event.type.includes("error") && !event.type.includes("Error")) {
        const self = _EventTimelinePanel.getInstance();
        if (self && self.isRecording) {
          try {
            self.addEvent({
              type: "dom",
              name: event.type,
              data: event.detail || {},
              source: "DOM CustomEvent",
              isInternal: INTERNAL_EVENT_PATTERNS.includes(event.type)
            });
          } catch (e) {
          }
        }
      }
      return originalDispatch.call(this, event);
    };
  }
  static getInstance() {
    return _EventTimelinePanel.instance;
  }
  watchPerformanceEvents() {
    if (typeof window === "undefined" || !window.performance) return;
    const self = this;
    const originalMark = performance.mark;
    performance.mark = function(name) {
      const result = originalMark.call(performance, name);
      if (self.isRecording) {
        self.addEvent({
          type: "performance",
          name: `mark: ${name}`,
          data: { markName: name },
          source: "Performance API",
          isInternal: true
        });
      }
      return result;
    };
    const originalMeasure = performance.measure;
    performance.measure = function(name, startMark, endMark) {
      const result = originalMeasure.call(performance, name, startMark, endMark);
      if (self.isRecording) {
        self.addEvent({
          type: "performance",
          name: `measure: ${name}`,
          data: { measureName: name, startMark, endMark },
          source: "Performance API",
          isInternal: true
        });
      }
      return result;
    };
  }
  addEvent(eventData) {
    if (FILTERED_EVENTS.includes(eventData.name || "")) {
      return;
    }
    const now = Date.now();
    const event = {
      id: `event_${now}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: eventData.timestamp || now,
      type: eventData.type || "internal",
      name: eventData.name || "unknown",
      data: eventData.data || {},
      source: eventData.source || "Unknown",
      relativeTime: this.formatRelativeTime(eventData.timestamp || now),
      isInternal: eventData.isInternal || false
    };
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    this.saveEvents();
    if (typeof document !== "undefined") {
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }
      this.updateTimeout = setTimeout(() => {
        document.dispatchEvent(new CustomEvent("debug:event-added", {
          detail: {
            panelId: this.id,
            event
          }
        }));
      }, 100);
    }
  }
  formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1e3);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    if (seconds > 0) return `${seconds}s ago`;
    return "just now";
  }
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  }
  getFilteredEvents() {
    if (this.showInternalEvents) {
      return this.events;
    }
    return this.events.filter((event) => !event.isInternal);
  }
  getEventTypeColor(type) {
    const colors = {
      dataLayer: "#4CAF50",
      internal: "#2196F3",
      dom: "#FF9800",
      performance: "#9C27B0"
    };
    return colors[type] || "#666";
  }
  getEventTypeBadge(type) {
    const badges = {
      dataLayer: "GTM",
      internal: "SDK",
      dom: "DOM",
      performance: "PERF"
    };
    return badges[type] || type.toUpperCase();
  }
  showEventModal(eventId) {
    this.selectedEventId = eventId;
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("debug:update-content", {
        detail: { panelId: this.id }
      }));
    }
  }
  closeEventModal() {
    this.selectedEventId = null;
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("debug:update-content", {
        detail: { panelId: this.id }
      }));
    }
  }
  getContent() {
    const filteredEvents = this.getFilteredEvents();
    const selectedEvent = this.selectedEventId ? this.events.find((e) => e.id === this.selectedEventId) : null;
    const modalHtml = selectedEvent ? `
      <div class="event-modal-overlay" onclick="window.eventTimelinePanel_closeModal()">
        <div class="event-modal" onclick="event.stopPropagation()">
          <div class="event-modal-header">
            <h3 class="event-modal-title">${selectedEvent.name}</h3>
            <button class="event-modal-close" onclick="window.eventTimelinePanel_closeModal()">✕</button>
          </div>
          <div class="event-modal-body">
            <div class="event-modal-meta">
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Type:</span>
                <span class="event-type-badge" style="background: ${this.getEventTypeColor(selectedEvent.type)}22; color: ${this.getEventTypeColor(selectedEvent.type)};">
                  ${this.getEventTypeBadge(selectedEvent.type)}
                </span>
              </div>
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Source:</span>
                <span>${selectedEvent.source}</span>
              </div>
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Time:</span>
                <span>${this.formatTimestamp(selectedEvent.timestamp)}</span>
              </div>
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Relative:</span>
                <span>${selectedEvent.relativeTime}</span>
              </div>
            </div>
            <div class="event-modal-data">
              <div class="event-modal-data-header">
                <span>Event Data</span>
                <button class="event-modal-copy" onclick="window.eventTimelinePanel_copyData('${selectedEvent.id}')">
                  Copy JSON
                </button>
              </div>
              <pre class="event-modal-data-content">${this.safeStringify(selectedEvent.data)}</pre>
            </div>
          </div>
        </div>
      </div>
    ` : "";
    if (typeof window !== "undefined") {
      window.eventTimelinePanel_showModal = (eventId) => {
        this.showEventModal(eventId);
      };
      window.eventTimelinePanel_closeModal = () => {
        this.closeEventModal();
      };
      window.eventTimelinePanel_copyData = (eventId) => {
        const event = this.events.find((e) => e.id === eventId);
        if (event) {
          navigator.clipboard.writeText(this.safeStringify(event.data));
          const button = document.querySelector(".event-modal-copy");
          if (button) {
            const originalText = button.textContent;
            button.textContent = "Copied!";
            setTimeout(() => {
              button.textContent = originalText;
            }, 2e3);
          }
        }
      };
    }
    return `
      <style>
        .events-table-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #0f0f0f;
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
          max-height: 80vh;
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
          overflow-y: auto;
          padding: 20px;
        }
        .event-modal-meta {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .event-modal-meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .event-modal-meta-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.9em;
        }
        .event-modal-data {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        .event-modal-data-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .event-modal-copy {
          background: rgba(60, 125, 255, 0.2);
          border: 1px solid #3C7DFF;
          color: #3C7DFF;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85em;
          transition: all 0.2s;
        }
        .event-modal-copy:hover {
          background: rgba(60, 125, 255, 0.3);
        }
        .event-modal-data-content {
          padding: 16px;
          margin: 0;
          color: rgba(255, 255, 255, 0.8);
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-size: 0.85em;
          line-height: 1.5;
          overflow-x: auto;
          max-height: 400px;
        }
        .events-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
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
          background: ${this.isRecording ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.05)"};
          border: 1px solid ${this.isRecording ? "#EF4444" : "rgba(255, 255, 255, 0.1)"};
          border-radius: 6px;
          color: ${this.isRecording ? "#EF4444" : "rgba(255, 255, 255, 0.6)"};
        }
        .recording-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          ${this.isRecording ? "animation: pulse 1.5s infinite;" : ""}
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
          background: rgba(255, 255, 255, 0.05);
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
        .event-data {
          max-width: 400px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: 'SF Mono', monospace;
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
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
        .empty-state-text {
          font-size: 1.1em;
        }
      </style>
      
      <div class="events-table-container">
        <div class="events-header">
          <div class="events-stats">
            <div class="event-stat">
              <span class="event-stat-value">${this.events.length}</span>
              <span class="event-stat-label">Total Events</span>
            </div>
            <div class="event-stat">
              <span class="event-stat-value">${filteredEvents.length}</span>
              <span class="event-stat-label">Visible</span>
            </div>
          </div>
          
          <div class="events-controls">
            <button class="toggle-internal ${this.showInternalEvents ? "active" : ""}" 
                    data-action="toggle-internal-events">
              <span>${this.showInternalEvents ? "✓" : ""}</span>
              Show Internal Events
            </button>
            
            <div class="recording-status">
              <span class="recording-dot"></span>
              <span>${this.isRecording ? "Recording" : "Paused"}</span>
            </div>
          </div>
        </div>
        
        ${filteredEvents.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-text">No events captured yet</div>
          </div>
        ` : `
          <div style="flex: 1; overflow-y: auto;">
            <table class="events-table">
              <thead>
                <tr>
                  <th style="width: 5%">#</th>
                  <th style="width: 8%">Type</th>
                  <th style="width: 25%">Event Name</th>
                  <th style="width: 15%">Source</th>
                  <th style="width: 12%">Time</th>
                  <th style="width: 35%">Data</th>
                </tr>
              </thead>
              <tbody>
                ${filteredEvents.slice(0, 100).map((event, index) => `
                  <tr class="event-row" onclick="window.eventTimelinePanel_showModal('${event.id}')">
                    <td>${index + 1}</td>
                    <td>
                      <span class="event-type-badge" style="background: ${this.getEventTypeColor(event.type)}22; color: ${this.getEventTypeColor(event.type)};">
                        ${this.getEventTypeBadge(event.type)}
                      </span>
                    </td>
                    <td>
                      <span class="event-name">${event.name}</span>
                      ${event.isInternal ? '<span class="internal-badge">INTERNAL</span>' : ""}
                    </td>
                    <td class="event-source">${event.source}</td>
                    <td class="event-time">${this.formatTimestamp(event.timestamp)}</td>
                    <td>
                      <div class="event-data" onclick="event.stopPropagation(); window.eventTimelinePanel_showModal('${event.id}')">
                        ${this.safeStringify(event.data)}
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
      ${modalHtml}
    `;
  }
  getActions() {
    return [
      {
        label: this.isRecording ? "Pause" : "Resume",
        variant: this.isRecording ? "secondary" : "primary",
        action: () => {
          this.isRecording = !this.isRecording;
        }
      },
      {
        label: "Clear Events",
        variant: "danger",
        action: () => {
          this.events = [];
          localStorage.removeItem(_EventTimelinePanel.EVENTS_STORAGE_KEY);
        }
      },
      {
        label: "Export Events",
        variant: "primary",
        action: () => {
          const dataStr = JSON.stringify(this.events, null, 2);
          const dataBlob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `events-${Date.now()}.json`;
          link.click();
          URL.revokeObjectURL(url);
        }
      }
    ];
  }
};
_EventTimelinePanel.EVENTS_STORAGE_KEY = "debug-events-history";
_EventTimelinePanel.SHOW_INTERNAL_KEY = "debug-events-show-internal";
_EventTimelinePanel.MAX_STORED_EVENTS = 100;
_EventTimelinePanel.STORAGE_EXPIRY_KEY = "debug-events-expiry";
_EventTimelinePanel.STORAGE_EXPIRY_HOURS = 2;
_EventTimelinePanel.instance = null;
let EventTimelinePanel = _EventTimelinePanel;
class ConfigPanel {
  constructor() {
    this.id = "config";
    this.title = "Configuration";
    this.icon = "⚙️";
  }
  getContent() {
    const tabs = this.getTabs();
    return tabs[0]?.getContent() || "";
  }
  getTabs() {
    return [
      {
        id: "overview",
        label: "Overview",
        icon: "📊",
        getContent: () => this.getOverviewContent()
      },
      {
        id: "settings",
        label: "Settings",
        icon: "⚙️",
        getContent: () => this.getSettingsContent()
      },
      {
        id: "raw",
        label: "Raw Data",
        icon: "🔧",
        getContent: () => this.getRawDataContent()
      }
    ];
  }
  getOverviewContent() {
    const config = configStore.getState();
    const sdkVersion = typeof window !== "undefined" && window.__NEXT_SDK_VERSION__ ? window.__NEXT_SDK_VERSION__ : "1.0.0";
    return `
      <div class="enhanced-panel">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">🔧</div>
            <div class="metric-content">
              <div class="metric-value">${config.debug ? "ON" : "OFF"}</div>
              <div class="metric-label">Debug Mode</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🌍</div>
            <div class="metric-content">
              <div class="metric-value">${config.environment || "production"}</div>
              <div class="metric-label">Environment</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🔑</div>
            <div class="metric-content">
              <div class="metric-value">${config.apiKey ? "SET" : "MISSING"}</div>
              <div class="metric-label">API Key</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📦</div>
            <div class="metric-content">
              <div class="metric-value">${sdkVersion}</div>
              <div class="metric-label">SDK Version</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  getSettingsContent() {
    const config = configStore.getState();
    const sdkVersion = typeof window !== "undefined" && window.__NEXT_SDK_VERSION__ ? window.__NEXT_SDK_VERSION__ : "1.0.0";
    return `
      <div class="enhanced-panel">
        <div class="section">
          <div class="config-groups">
            <div class="config-group">
              <h4 class="config-group-title">Core Settings</h4>
              <div class="config-items">
                <div class="config-item">
                  <span class="config-key">SDK Version:</span>
                  <span class="config-value">${sdkVersion}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">API Key:</span>
                  <span class="config-value">${config.apiKey ? `${config.apiKey.substring(0, 8)}...` : "Not set"}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Environment:</span>
                  <span class="config-value">${config.environment || "production"}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Base URL:</span>
                  <span class="config-value">https://campaigns.apps.29next.com</span>
                </div>
              </div>
            </div>

            <div class="config-group">
              <h4 class="config-group-title">Feature Flags</h4>
              <div class="config-items">
                <div class="config-item">
                  <span class="config-key">Debug Mode:</span>
                  <span class="config-value ${config.debug ? "enabled" : "disabled"}">${config.debug ? "Enabled" : "Disabled"}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Test Mode:</span>
                  <span class="config-value ${config.testMode ?? false ? "enabled" : "disabled"}">${config.testMode ?? false ? "Enabled" : "Disabled"}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Analytics:</span>
                  <span class="config-value ${config.enableAnalytics ?? true ? "enabled" : "disabled"}">${config.enableAnalytics ?? true ? "Enabled" : "Disabled"}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Auto Initialize:</span>
                  <span class="config-value ${config.autoInit ?? true ? "enabled" : "disabled"}">${config.autoInit ?? true ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            </div>

            <div class="config-group">
              <h4 class="config-group-title">Performance</h4>
              <div class="config-items">
                <div class="config-item">
                  <span class="config-key">Rate Limit:</span>
                  <span class="config-value">${config.rateLimit ?? 4} req/sec</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Cache TTL:</span>
                  <span class="config-value">${config.cacheTtl ?? 300}s</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Retry Attempts:</span>
                  <span class="config-value">${config.retryAttempts ?? 3}</span>
                </div>
                <div class="config-item">
                  <span class="config-key">Timeout:</span>
                  <span class="config-value">${config.timeout ?? 1e4}ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  getRawDataContent() {
    const config = configStore.getState();
    return RawDataHelper.generateRawDataContent(config);
  }
  getActions() {
    return [
      {
        label: "Toggle Debug",
        action: () => this.toggleDebug(),
        variant: "primary"
      },
      {
        label: "Toggle Test Mode",
        action: () => this.toggleTestMode(),
        variant: "secondary"
      },
      {
        label: "Export Config",
        action: () => this.exportConfig(),
        variant: "secondary"
      },
      {
        label: "Reset Config",
        action: () => this.resetConfig(),
        variant: "danger"
      }
    ];
  }
  toggleDebug() {
    const configStore$1 = configStore.getState();
    configStore$1.updateConfig({ debug: !configStore$1.debug });
    document.dispatchEvent(new CustomEvent("debug:update-content"));
  }
  toggleTestMode() {
    const configStore$1 = configStore.getState();
    configStore$1.updateConfig({ testMode: !(configStore$1.testMode ?? false) });
    document.dispatchEvent(new CustomEvent("debug:update-content"));
  }
  exportConfig() {
    const config = configStore.getState();
    const data = JSON.stringify(config, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `next-config-${(/* @__PURE__ */ new Date()).toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  resetConfig() {
    if (confirm("Are you sure you want to reset the configuration to defaults?")) {
      const configStore$1 = configStore.getState();
      configStore$1.reset();
      document.dispatchEvent(new CustomEvent("debug:update-content"));
    }
  }
}
class CheckoutPanel {
  constructor() {
    this.id = "checkout";
    this.title = "Checkout State";
    this.icon = "💳";
  }
  getContent() {
    const tabs = this.getTabs();
    return tabs[0]?.getContent() || "";
  }
  getTabs() {
    return [
      {
        id: "overview",
        label: "Overview",
        icon: "📊",
        getContent: () => this.getOverviewContent()
      },
      {
        id: "customer",
        label: "Customer Info",
        icon: "👤",
        getContent: () => this.getCustomerContent()
      },
      {
        id: "validation",
        label: "Validation",
        icon: "✅",
        getContent: () => this.getValidationContent()
      },
      {
        id: "raw",
        label: "Raw Data",
        icon: "🔧",
        getContent: () => this.getRawDataContent()
      }
    ];
  }
  getOverviewContent() {
    const checkoutState = useCheckoutStore.getState();
    return `
      <div class="enhanced-panel">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">📋</div>
            <div class="metric-content">
              <div class="metric-value">${checkoutState.step || "Not Started"}</div>
              <div class="metric-label">Current Step</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">${checkoutState.isProcessing ? "⏳" : "✅"}</div>
            <div class="metric-content">
              <div class="metric-value">${checkoutState.isProcessing ? "PROCESSING" : "READY"}</div>
              <div class="metric-label">Form Status</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🔒</div>
            <div class="metric-content">
              <div class="metric-value">${checkoutState.paymentMethod || "None"}</div>
              <div class="metric-label">Payment Method</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🚚</div>
            <div class="metric-content">
              <div class="metric-value">${checkoutState.shippingMethod?.name || "None"}</div>
              <div class="metric-label">Shipping Method</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">Form Fields Status</h3>
          <div class="form-fields-grid">
            ${this.renderFormFields(checkoutState)}
          </div>
        </div>
        
        <div class="section">
          <h3 class="section-title">Current Form Data</h3>
          <div class="form-data-summary">
            ${Object.keys(checkoutState.formData).length > 0 ? Object.entries(checkoutState.formData).map(([key, value]) => `
                <div class="form-field-row">
                  <span class="field-name">${this.formatFieldName(key)}</span>
                  <span class="field-value">${value || "Empty"}</span>
                </div>
              `).join("") : '<div class="empty-state">No form data yet</div>'}
          </div>
        </div>
      </div>
    `;
  }
  getCustomerContent() {
    const checkoutState = useCheckoutStore.getState();
    const formData = checkoutState.formData;
    const hasFormData = Object.keys(formData).length > 0;
    return `
      <div class="enhanced-panel">
        <div class="section">
          <div class="customer-info">
            ${hasFormData ? `
              <div class="info-card">
                <h4>Contact Information</h4>
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${formData.email || "Not provided"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Phone:</span>
                  <span class="info-value">${formData.phone || "Not provided"}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${formData.fname || ""} ${formData.lname || ""}</span>
                </div>
              </div>
              
              <div class="info-card">
                <h4>Shipping Address</h4>
                <div class="address-info">
                  ${formData.address1 ? `
                    <div class="info-row">
                      <span class="info-label">Address:</span>
                      <span class="info-value">${formData.address1}</span>
                    </div>
                    ${formData.address2 ? `
                      <div class="info-row">
                        <span class="info-label">Address 2:</span>
                        <span class="info-value">${formData.address2}</span>
                      </div>
                    ` : ""}
                    <div class="info-row">
                      <span class="info-label">City:</span>
                      <span class="info-value">${formData.city || "Not provided"}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">State/Province:</span>
                      <span class="info-value">${formData.province || "Not provided"}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Postal Code:</span>
                      <span class="info-value">${formData.postal || "Not provided"}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Country:</span>
                      <span class="info-value">${formData.country || "Not provided"}</span>
                    </div>
                  ` : '<div class="info-empty">Not provided</div>'}
                </div>
              </div>

              <div class="info-card">
                <h4>Billing Address</h4>
                <div class="address-info">
                  ${checkoutState.sameAsShipping ? `
                    <div class="info-same">Same as shipping address</div>
                  ` : checkoutState.billingAddress ? `
                    <div class="info-row">
                      <span class="info-label">Name:</span>
                      <span class="info-value">${checkoutState.billingAddress.first_name} ${checkoutState.billingAddress.last_name}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Address:</span>
                      <span class="info-value">${checkoutState.billingAddress.address1}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">City:</span>
                      <span class="info-value">${checkoutState.billingAddress.city}, ${checkoutState.billingAddress.province} ${checkoutState.billingAddress.postal}</span>
                    </div>
                  ` : '<div class="info-empty">Not provided</div>'}
                </div>
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-icon">👤</div>
                <div class="empty-text">No customer information yet</div>
                <div class="empty-subtitle">Fill out the checkout form to see data here</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }
  getValidationContent() {
    const checkoutState = useCheckoutStore.getState();
    return `
      <div class="enhanced-panel">
        <div class="section">
          <div class="validation-errors">
            ${checkoutState.errors && Object.keys(checkoutState.errors).length > 0 ? `
              ${Object.entries(checkoutState.errors).map(([field, error]) => `
                <div class="error-item">
                  <span class="error-field">${field}:</span>
                  <span class="error-message">${error}</span>
                </div>
              `).join("")}
            ` : `
              <div class="empty-state">
                <div class="empty-icon">✅</div>
                <div class="empty-text">No validation errors</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }
  getRawDataContent() {
    const checkoutState = useCheckoutStore.getState();
    return RawDataHelper.generateRawDataContent(checkoutState);
  }
  getActions() {
    return [
      {
        label: "Fill Test Data",
        action: () => this.fillTestData(),
        variant: "primary"
      },
      {
        label: "Validate Form",
        action: () => this.validateForm(),
        variant: "secondary"
      },
      {
        label: "Clear Errors",
        action: () => this.clearErrors(),
        variant: "secondary"
      },
      {
        label: "Reset Checkout",
        action: () => this.resetCheckout(),
        variant: "danger"
      },
      {
        label: "Export State",
        action: () => this.exportState(),
        variant: "secondary"
      }
    ];
  }
  renderFormFields(checkoutState) {
    const requiredFields = [
      "email",
      "fname",
      "lname",
      "address1",
      "city",
      "province",
      "postal",
      "phone",
      "country"
    ];
    return requiredFields.map((field) => {
      const hasValue = this.hasFieldValue(checkoutState, field);
      const hasError = checkoutState.errors && checkoutState.errors[field];
      return `
        <div class="field-status-card ${hasValue ? "filled" : "empty"} ${hasError ? "error" : ""}">
          <div class="field-name">${this.formatFieldName(field)}</div>
          <div class="field-status">
            ${hasValue ? "✅" : "⏳"}
            ${hasError ? " ❌" : ""}
          </div>
        </div>
      `;
    }).join("");
  }
  hasFieldValue(checkoutState, field) {
    if (checkoutState.formData && checkoutState.formData[field]) {
      return checkoutState.formData[field].toString().trim().length > 0;
    }
    if (checkoutState.billingAddress && checkoutState.billingAddress[field]) {
      return checkoutState.billingAddress[field].toString().trim().length > 0;
    }
    return false;
  }
  formatFieldName(field) {
    const fieldNames = {
      fname: "First Name",
      lname: "Last Name",
      email: "Email",
      phone: "Phone",
      address1: "Address",
      address2: "Address 2",
      city: "City",
      province: "State/Province",
      postal: "Postal Code",
      country: "Country",
      accepts_marketing: "Accepts Marketing"
    };
    return fieldNames[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim();
  }
  fillTestData() {
    const checkoutStore2 = useCheckoutStore.getState();
    const testFormData = {
      email: "test@test.com",
      fname: "Test",
      lname: "Order",
      phone: "+14807581224",
      address1: "Test Address 123",
      address2: "",
      city: "Tempe",
      province: "AZ",
      postal: "85281",
      country: "US",
      accepts_marketing: true
    };
    checkoutStore2.clearAllErrors();
    checkoutStore2.updateFormData(testFormData);
    checkoutStore2.setPaymentMethod("credit-card");
    checkoutStore2.setSameAsShipping(true);
    checkoutStore2.setShippingMethod({
      id: 1,
      name: "Standard Shipping",
      price: 0,
      code: "standard"
    });
    console.log("✅ Test data filled successfully");
    document.dispatchEvent(new CustomEvent("debug:update-content"));
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("checkout:test-data-filled", {
        detail: testFormData
      }));
    }, 100);
  }
  validateForm() {
    const checkoutStore2 = useCheckoutStore.getState();
    const formData = checkoutStore2.formData;
    const requiredFields = ["email", "fname", "lname", "address1", "city", "country"];
    let hasErrors = false;
    checkoutStore2.clearAllErrors();
    requiredFields.forEach((field) => {
      if (!formData[field] || formData[field].toString().trim() === "") {
        checkoutStore2.setError(field, `${this.formatFieldName(field)} is required`);
        hasErrors = true;
      }
    });
    if (!hasErrors) {
      console.log("✅ Form validation passed");
    }
    document.dispatchEvent(new CustomEvent("debug:update-content"));
  }
  clearErrors() {
    const checkoutStore2 = useCheckoutStore.getState();
    checkoutStore2.clearAllErrors();
    document.dispatchEvent(new CustomEvent("debug:update-content"));
  }
  resetCheckout() {
    if (confirm("Are you sure you want to reset the checkout state?")) {
      const checkoutStore2 = useCheckoutStore.getState();
      checkoutStore2.reset();
      document.dispatchEvent(new CustomEvent("debug:update-content"));
    }
  }
  exportState() {
    const checkoutState = useCheckoutStore.getState();
    const data = JSON.stringify(checkoutState, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checkout-state-${(/* @__PURE__ */ new Date()).toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
class StoragePanel {
  constructor() {
    this.id = "storage";
    this.title = "Storage";
    this.icon = "💾";
  }
  getContent() {
    const tabs = this.getTabs();
    return tabs[0]?.getContent() || "";
  }
  getTabs() {
    return [
      {
        id: "overview",
        label: "Overview",
        icon: "📊",
        getContent: () => this.getOverviewContent()
      },
      {
        id: "next-data",
        label: "Next Data",
        icon: "🏷️",
        getContent: () => this.getNextContent()
      },
      {
        id: "local-storage",
        label: "Local Storage",
        icon: "💾",
        getContent: () => this.getLocalStorageContent()
      },
      {
        id: "session-storage",
        label: "Session Storage",
        icon: "⏰",
        getContent: () => this.getSessionStorageContent()
      }
    ];
  }
  getOverviewContent() {
    const localStorage2 = this.getLocalStorageData();
    const sessionStorage2 = this.getSessionStorageData();
    return `
      <div class="enhanced-panel">
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">💾</div>
            <div class="metric-content">
              <div class="metric-value">${localStorage2.length}</div>
              <div class="metric-label">LocalStorage Items</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">⏰</div>
            <div class="metric-content">
              <div class="metric-value">${sessionStorage2.length}</div>
              <div class="metric-label">SessionStorage Items</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📊</div>
            <div class="metric-content">
              <div class="metric-value">${this.getStorageSize()}KB</div>
              <div class="metric-label">Total Size</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🏷️</div>
            <div class="metric-content">
              <div class="metric-value">${this.getNextItems().length}</div>
              <div class="metric-label">Next Items</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  getNextContent() {
    return `
      <div class="enhanced-panel">
        <div class="section">
          <div class="storage-items">
            ${this.getNextItems().length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">💾</div>
                <div class="empty-text">No Next storage items found</div>
              </div>
            ` : `
              ${this.getNextItems().map((item) => `
                <div class="storage-item-card next-item">
                  <div class="storage-item-header">
                    <span class="storage-key">${item.key}</span>
                    <span class="storage-type ${item.type}">${item.type}</span>
                    <button class="storage-delete-btn" onclick="window.nextDebug.deleteStorageItem('${item.key}', '${item.type}')">×</button>
                  </div>
                  <div class="storage-item-size">${item.size} bytes</div>
                  <div class="storage-item-value">
                    <pre><code>${item.formattedValue}</code></pre>
                  </div>
                </div>
              `).join("")}
            `}
          </div>
        </div>
      </div>
    `;
  }
  getLocalStorageContent() {
    const localStorage2 = this.getLocalStorageData();
    return `
      <div class="enhanced-panel">
        <div class="section">
          <div class="storage-items">
            ${localStorage2.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">💾</div>
                <div class="empty-text">No localStorage items</div>
              </div>
            ` : `
              ${localStorage2.map((item) => `
                <div class="storage-item-card ${item.key.includes("next") ? "next-item" : ""}">
                  <div class="storage-item-header">
                    <span class="storage-key">${item.key}</span>
                    <span class="storage-type local">local</span>
                    <button class="storage-delete-btn" onclick="window.nextDebug.deleteStorageItem('${item.key}', 'local')">×</button>
                  </div>
                  <div class="storage-item-size">${item.size} bytes</div>
                  <div class="storage-item-value">
                    <pre><code>${item.formattedValue}</code></pre>
                  </div>
                </div>
              `).join("")}
            `}
          </div>
        </div>
      </div>
    `;
  }
  getSessionStorageContent() {
    const sessionStorage2 = this.getSessionStorageData();
    return `
      <div class="enhanced-panel">
        <div class="section">
          <div class="storage-items">
            ${sessionStorage2.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">⏰</div>
                <div class="empty-text">No sessionStorage items</div>
              </div>
            ` : `
              ${sessionStorage2.map((item) => `
                <div class="storage-item-card ${item.key.includes("next") ? "next-item" : ""}">
                  <div class="storage-item-header">
                    <span class="storage-key">${item.key}</span>
                    <span class="storage-type session">session</span>
                    <button class="storage-delete-btn" onclick="window.nextDebug.deleteStorageItem('${item.key}', 'session')">×</button>
                  </div>
                  <div class="storage-item-size">${item.size} bytes</div>
                  <div class="storage-item-value">
                    <pre><code>${item.formattedValue}</code></pre>
                  </div>
                </div>
              `).join("")}
            `}
          </div>
        </div>
      </div>
    `;
  }
  getActions() {
    return [
      {
        label: "Clear Next Data",
        action: () => this.clearNextStorage(),
        variant: "danger"
      },
      {
        label: "Clear All Local",
        action: () => this.clearLocalStorage(),
        variant: "danger"
      },
      {
        label: "Clear All Session",
        action: () => this.clearSessionStorage(),
        variant: "danger"
      },
      {
        label: "Export Storage",
        action: () => this.exportStorage(),
        variant: "secondary"
      }
    ];
  }
  getLocalStorageData() {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || "";
        items.push({
          key,
          value,
          size: new Blob([value]).size,
          formattedValue: this.formatValue(value)
        });
      }
    }
    return items.sort((a, b) => a.key.localeCompare(b.key));
  }
  getSessionStorageData() {
    const items = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key) || "";
        items.push({
          key,
          value,
          size: new Blob([value]).size,
          formattedValue: this.formatValue(value)
        });
      }
    }
    return items.sort((a, b) => a.key.localeCompare(b.key));
  }
  getNextItems() {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("next") || key.includes("29next") || key.includes("campaign"))) {
        const value = localStorage.getItem(key) || "";
        items.push({
          key,
          value,
          size: new Blob([value]).size,
          formattedValue: this.formatValue(value),
          type: "local"
        });
      }
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes("next") || key.includes("29next") || key.includes("campaign"))) {
        const value = sessionStorage.getItem(key) || "";
        items.push({
          key,
          value,
          size: new Blob([value]).size,
          formattedValue: this.formatValue(value),
          type: "session"
        });
      }
    }
    return items.sort((a, b) => a.key.localeCompare(b.key));
  }
  formatValue(value) {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      if (value.length > 200) {
        return value.substring(0, 200) + "...";
      }
      return value;
    }
  }
  getStorageSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || "";
        total += new Blob([key + value]).size;
      }
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key) || "";
        total += new Blob([key + value]).size;
      }
    }
    return Math.round(total / 1024);
  }
  clearNextStorage() {
    if (confirm("Are you sure you want to clear all Next storage data?")) {
      const nextItems = this.getNextItems();
      nextItems.forEach((item) => {
        if (item.type === "local") {
          localStorage.removeItem(item.key);
        } else {
          sessionStorage.removeItem(item.key);
        }
      });
      document.dispatchEvent(new CustomEvent("debug:update-content"));
    }
  }
  clearLocalStorage() {
    if (confirm("Are you sure you want to clear ALL localStorage data?")) {
      localStorage.clear();
      document.dispatchEvent(new CustomEvent("debug:update-content"));
    }
  }
  clearSessionStorage() {
    if (confirm("Are you sure you want to clear ALL sessionStorage data?")) {
      sessionStorage.clear();
      document.dispatchEvent(new CustomEvent("debug:update-content"));
    }
  }
  exportStorage() {
    const data = {
      localStorage: this.getLocalStorageData(),
      sessionStorage: this.getSessionStorageData(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storage-data-${(/* @__PURE__ */ new Date()).toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
class EnhancedCampaignPanel {
  constructor() {
    this.id = "campaign";
    this.title = "Campaign Data";
    this.icon = "📊";
  }
  getContent() {
    const tabs = this.getTabs();
    return tabs[0]?.getContent() || "";
  }
  getTabs() {
    return [
      {
        id: "overview",
        label: "Overview",
        icon: "📊",
        getContent: () => this.getOverviewContent()
      },
      {
        id: "packages",
        label: "Packages",
        icon: "📦",
        getContent: () => this.getPackagesContent()
      },
      {
        id: "shipping",
        label: "Shipping",
        icon: "🚚",
        getContent: () => this.getShippingContent()
      },
      {
        id: "raw",
        label: "Raw Data",
        icon: "🔧",
        getContent: () => this.getRawDataContent()
      }
    ];
  }
  getOverviewContent() {
    const campaignState = useCampaignStore.getState();
    const campaignData = campaignState.data;
    if (!campaignData) {
      return `
        <div class="enhanced-panel">
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div class="empty-text">No campaign data loaded</div>
            <button class="empty-action" onclick="window.nextDebug.loadCampaign()">Load Campaign</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="enhanced-panel">
        ${this.getCampaignOverview(campaignData)}
      </div>
    `;
  }
  getPackagesContent() {
    const campaignState = useCampaignStore.getState();
    const cartState = useCartStore.getState();
    const campaignData = campaignState.data;
    if (!campaignData) {
      return `
        <div class="enhanced-panel">
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-text">No campaign data loaded</div>
          </div>
        </div>
      `;
    }
    return `
      <div class="enhanced-panel">
        ${this.getPackagesSection(campaignData.packages, cartState)}
      </div>
    `;
  }
  getShippingContent() {
    const campaignState = useCampaignStore.getState();
    const campaignData = campaignState.data;
    if (!campaignData) {
      return `
        <div class="enhanced-panel">
          <div class="empty-state">
            <div class="empty-icon">🚚</div>
            <div class="empty-text">No campaign data loaded</div>
          </div>
        </div>
      `;
    }
    return `
      <div class="enhanced-panel">
        ${this.getShippingMethodsSection(campaignData.shipping_methods)}
      </div>
    `;
  }
  getRawDataContent() {
    const campaignState = useCampaignStore.getState();
    const campaignData = campaignState.data;
    if (!campaignData) {
      return `
        <div class="enhanced-panel">
          <div class="empty-state">
            <div class="empty-icon">🔧</div>
            <div class="empty-text">No campaign data loaded</div>
          </div>
        </div>
      `;
    }
    return RawDataHelper.generateRawDataContent(campaignData);
  }
  getCampaignOverview(data) {
    return `
      <div class="campaign-overview">
        <div class="campaign-header">
          <h2 class="campaign-name">${data.name}</h2>
          <div class="campaign-badges">
            <span class="campaign-badge currency">${data.currency}</span>
            <span class="campaign-badge language">${data.language.toUpperCase()}</span>
          </div>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">📦</div>
            <div class="metric-content">
              <div class="metric-value">${data.packages.length}</div>
              <div class="metric-label">Total Packages</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🚚</div>
            <div class="metric-content">
              <div class="metric-value">${data.shipping_methods.length}</div>
              <div class="metric-label">Shipping Methods</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🔄</div>
            <div class="metric-content">
              <div class="metric-value">${data.packages.filter((p) => p.is_recurring).length}</div>
              <div class="metric-label">Recurring Items</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">💰</div>
            <div class="metric-content">
              <div class="metric-value">${this.getPriceRange(data.packages)}</div>
              <div class="metric-label">Price Range</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  getPackagesSection(packages, cartState) {
    return `
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">Available Packages</h3>
          <div class="section-controls">
            <button class="sort-btn" onclick="window.nextDebug.sortPackages('price')">Sort by Price</button>
            <button class="sort-btn" onclick="window.nextDebug.sortPackages('name')">Sort by Name</button>
          </div>
        </div>
        
        <div class="packages-grid">
          ${packages.map((pkg) => this.getPackageCard(pkg, cartState)).join("")}
        </div>
      </div>
    `;
  }
  getPackageCard(pkg, cartState) {
    const isInCart = cartState.items.some((item) => item.packageId === pkg.ref_id);
    const cartItem = cartState.items.find((item) => item.packageId === pkg.ref_id);
    const savings = parseFloat(pkg.price_retail_total) - parseFloat(pkg.price_total);
    const savingsPercent = Math.round(savings / parseFloat(pkg.price_retail_total) * 100);
    return `
      <div class="package-card ${isInCart ? "in-cart" : ""}" data-package-id="${pkg.ref_id}">
        <div class="package-image-container">
          <img src="${pkg.image}" alt="${pkg.name}" class="package-image" loading="lazy" />
          ${pkg.is_recurring ? '<div class="recurring-badge">🔄 Recurring</div>' : ""}
          ${isInCart ? `<div class="cart-badge">In Cart (${cartItem?.quantity || 0})</div>` : ""}
        </div>
        
        <div class="package-info">
          <div class="package-header">
            <h4 class="package-name">${pkg.name}</h4>
            <div class="package-id">ID: ${pkg.ref_id}</div>
          </div>
          
          <div class="package-details">
            <div class="package-qty">Quantity: ${pkg.qty}</div>
            <div class="package-external-id">External ID: ${pkg.external_id}</div>
          </div>
          
          <div class="package-pricing">
            <div class="price-row">
              <span class="price-label">Sale Price:</span>
              <span class="price-value sale-price">$${pkg.price_total}</span>
            </div>
            ${pkg.price_retail_total !== pkg.price_total ? `
              <div class="price-row">
                <span class="price-label">Retail Price:</span>
                <span class="price-value retail-price">$${pkg.price_retail_total}</span>
              </div>
              <div class="savings">
                Save $${savings.toFixed(2)} (${savingsPercent}%)
              </div>
            ` : ""}
            
            ${pkg.is_recurring && pkg.price_recurring ? `
              <div class="recurring-pricing">
                <div class="price-row recurring">
                  <span class="price-label">Recurring:</span>
                  <span class="price-value recurring-price">
                    $${pkg.price_recurring_total}/${pkg.interval}
                  </span>
                </div>
              </div>
            ` : ""}
          </div>
          
          <div class="package-actions">
            ${isInCart ? `
              <button class="package-btn remove-btn" onclick="window.nextDebug.removeFromCart(${pkg.ref_id})">
                Remove from Cart
              </button>
              <div class="qty-controls">
                <button onclick="window.nextDebug.updateQuantity(${pkg.ref_id}, ${(cartItem?.quantity || 1) - 1})">-</button>
                <span>${cartItem?.quantity || 0}</span>
                <button onclick="window.nextDebug.updateQuantity(${pkg.ref_id}, ${(cartItem?.quantity || 1) + 1})">+</button>
              </div>
            ` : `
              <button class="package-btn add-btn" onclick="window.nextDebug.addToCart(${pkg.ref_id})">
                Add to Cart - $${pkg.price_total}
              </button>
            `}
            <button class="package-btn inspect-btn" onclick="window.nextDebug.inspectPackage(${pkg.ref_id})">
              Inspect
            </button>
          </div>
        </div>
      </div>
    `;
  }
  getShippingMethodsSection(shippingMethods) {
    return `
      <div class="section">
        <h3 class="section-title">Shipping Methods</h3>
        
        <div class="shipping-methods">
          ${shippingMethods.map((method) => `
            <div class="shipping-method-card">
              <div class="shipping-info">
                <div class="shipping-name">${method.code}</div>
                <div class="shipping-id">ID: ${method.ref_id}</div>
              </div>
              <div class="shipping-price">
                ${parseFloat(method.price) === 0 ? "FREE" : `$${method.price}`}
              </div>
              <button class="shipping-test-btn" onclick="window.nextDebug.testShippingMethod(${method.ref_id})">
                Test
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
  getPriceRange(packages) {
    const prices = packages.map((p) => parseFloat(p.price_total)).filter((p) => p > 0);
    if (prices.length === 0) return "Free";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min}`;
    return `$${min} - $${max}`;
  }
  getActions() {
    return [
      {
        label: "Refresh Campaign",
        action: () => {
          const configStore$1 = configStore.getState();
          const campaignStore = useCampaignStore.getState();
          if (configStore$1.apiKey) {
            campaignStore.loadCampaign(configStore$1.apiKey);
          } else {
            console.error("No API key available to load campaign");
          }
        },
        variant: "primary"
      },
      {
        label: "Export Packages",
        action: () => this.exportPackages(),
        variant: "secondary"
      },
      {
        label: "Test All Packages",
        action: () => this.testAllPackages(),
        variant: "secondary"
      },
      {
        label: "Clear Cart",
        action: () => useCartStore.getState().clear(),
        variant: "danger"
      }
    ];
  }
  exportPackages() {
    const campaignState = useCampaignStore.getState();
    const data = campaignState.data;
    if (!data) return;
    const exportData = {
      campaign: data.name,
      packages: data.packages,
      shipping_methods: data.shipping_methods,
      export_date: (/* @__PURE__ */ new Date()).toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-packages-${data.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  testAllPackages() {
    const campaignState = useCampaignStore.getState();
    const cartStore = useCartStore.getState();
    const data = campaignState.data;
    if (!data) return;
    data.packages.slice(0, 3).forEach((pkg) => {
      cartStore.addItem({
        packageId: pkg.ref_id,
        quantity: 1,
        title: pkg.name,
        isUpsell: false
      });
    });
  }
}
const _DebugOverlay = class _DebugOverlay {
  constructor() {
    this.visible = false;
    this.isExpanded = false;
    this.container = null;
    this.shadowRoot = null;
    this.activePanel = "cart";
    this.updateInterval = null;
    this.logger = new Logger("DebugOverlay");
    this.eventManager = null;
    this.panels = [];
    this.handleContainerClick = (event) => {
      const target = event.target;
      const action = target.getAttribute("data-action") || target.closest("[data-action]")?.getAttribute("data-action");
      if (action) {
        console.log("[Debug] Action clicked:", action);
        switch (action) {
          case "toggle-expand":
            this.isExpanded = !this.isExpanded;
            localStorage.setItem(_DebugOverlay.EXPANDED_STORAGE_KEY, this.isExpanded.toString());
            this.updateBodyHeight();
            this.updateOverlay();
            document.dispatchEvent(new CustomEvent("debug:panel-toggled", {
              detail: { isExpanded: this.isExpanded }
            }));
            break;
          case "close":
            this.hide();
            break;
          case "clear-cart":
            this.clearCart();
            break;
          case "export-data":
            this.exportAllData();
            break;
          case "toggle-mini-cart":
            this.toggleMiniCart();
            break;
          case "toggle-xray":
            this.toggleXray();
            break;
          case "close-mini-cart":
            this.closeMiniCart();
            break;
          case "toggle-internal-events":
            const eventPanel = this.panels.find((p) => p.id === "event-timeline");
            if (eventPanel && eventPanel.toggleInternalEvents) {
              eventPanel.toggleInternalEvents();
              this.updateContent();
            }
            break;
        }
        return;
      }
      const panelTab = target.closest(".debug-panel-tab");
      if (panelTab) {
        const panelId = panelTab.getAttribute("data-panel");
        console.log("[Debug] Panel switch:", this.activePanel, "->", panelId);
        if (panelId && panelId !== this.activePanel) {
          this.activePanel = panelId;
          this.activePanelTab = void 0;
          localStorage.setItem(_DebugOverlay.ACTIVE_PANEL_KEY, panelId);
          localStorage.removeItem(_DebugOverlay.ACTIVE_TAB_KEY);
          this.updateOverlay();
        }
        return;
      }
      const horizontalTab = target.closest(".horizontal-tab");
      if (horizontalTab) {
        const tabId = horizontalTab.getAttribute("data-panel-tab");
        console.log("[Debug] Horizontal tab switch:", this.activePanelTab, "->", tabId, "in panel:", this.activePanel);
        if (tabId && tabId !== this.activePanelTab) {
          this.activePanelTab = tabId;
          localStorage.setItem(_DebugOverlay.ACTIVE_TAB_KEY, tabId);
          this.updateOverlay();
        }
        return;
      }
      const panelActionBtn = target.closest(".panel-action-btn");
      if (panelActionBtn) {
        const actionLabel = panelActionBtn.getAttribute("data-panel-action");
        const activePanel = this.panels.find((p) => p.id === this.activePanel);
        const panelAction = activePanel?.getActions?.()?.find((a) => a.label === actionLabel);
        if (panelAction) {
          panelAction.action();
          setTimeout(() => this.updateContent(), 100);
        }
        return;
      }
    };
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.get("debugger") === "true" || urlParams.get("debug") === "true";
    if (isDebugMode) {
      this.eventManager = new DebugEventManager();
      this.initializePanels();
      this.setupEventListeners();
      const savedExpandedState = localStorage.getItem(_DebugOverlay.EXPANDED_STORAGE_KEY);
      if (savedExpandedState === "true") {
        this.isExpanded = true;
      }
      const savedPanel = localStorage.getItem(_DebugOverlay.ACTIVE_PANEL_KEY);
      if (savedPanel) {
        this.activePanel = savedPanel;
      }
      const savedTab = localStorage.getItem(_DebugOverlay.ACTIVE_TAB_KEY);
      if (savedTab) {
        this.activePanelTab = savedTab;
      }
    }
  }
  static getInstance() {
    if (!_DebugOverlay.instance) {
      _DebugOverlay.instance = new _DebugOverlay();
    }
    return _DebugOverlay.instance;
  }
  initializePanels() {
    this.panels = [
      new CartPanel(),
      new OrderPanel(),
      new ConfigPanel(),
      new EnhancedCampaignPanel(),
      new CheckoutPanel(),
      new EventTimelinePanel(),
      new StoragePanel()
    ];
  }
  setupEventListeners() {
    document.addEventListener("debug:update-content", () => {
      this.updateContent();
    });
    document.addEventListener("debug:event-added", (e) => {
      const customEvent = e;
      const { panelId } = customEvent.detail;
      console.log("[Debug] Event added:", panelId, "Active panel:", this.activePanel, "Expanded:", this.isExpanded);
      if (this.activePanel === panelId && this.isExpanded) {
        console.log("[Debug] Updating content for events panel (forced update)");
        this.updateContent();
      }
    });
  }
  initialize() {
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.get("debugger") === "true";
    if (isDebugMode) {
      this.show();
      this.logger.info("Debug overlay initialized");
      selectorContainer.initialize();
      this.logger.info("Selector container initialized");
      upsellSelector.initialize();
      this.logger.info("Upsell selector initialized");
    }
  }
  async show() {
    if (this.visible) return;
    this.visible = true;
    await this.createOverlay();
    this.startAutoUpdate();
    XrayManager.initialize();
    const savedMiniCartState = localStorage.getItem("debug-mini-cart-visible");
    if (savedMiniCartState === "true") {
      this.toggleMiniCart(true);
    }
    this.updateButtonStates();
  }
  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.stopAutoUpdate();
    document.body.classList.remove("debug-body-expanded");
    document.documentElement.classList.remove("debug-body-expanded");
    selectorContainer.destroy();
    upsellSelector.destroy();
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
  async toggle() {
    if (this.visible) {
      this.hide();
    } else {
      await this.show();
    }
  }
  isVisible() {
    return this.visible;
  }
  async createOverlay() {
    this.container = document.createElement("div");
    this.container.id = "next-debug-overlay-host";
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      pointer-events: none;
    `;
    this.shadowRoot = this.container.attachShadow({ mode: "open" });
    await this.injectShadowStyles();
    const overlayContainer = document.createElement("div");
    overlayContainer.className = "debug-overlay";
    overlayContainer.style.pointerEvents = "auto";
    this.shadowRoot.appendChild(overlayContainer);
    this.updateOverlay();
    this.addEventListeners();
    document.body.appendChild(this.container);
  }
  async injectShadowStyles() {
    if (!this.shadowRoot) return;
    const { DebugStyleLoader: DebugStyleLoader2 } = await Promise.resolve().then(() => DebugStyleLoader$1);
    const styles = await DebugStyleLoader2.getDebugStyles();
    const styleElement = document.createElement("style");
    styleElement.textContent = styles;
    this.shadowRoot.appendChild(styleElement);
    const resetStyles = document.createElement("style");
    resetStyles.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #e0e0e0;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      * {
        box-sizing: border-box;
      }
      
      /* Ensure debug overlay is always on top */
      .debug-overlay {
        position: fixed;
        z-index: 2147483647;
      }
    `;
    this.shadowRoot.appendChild(resetStyles);
  }
  updateOverlay() {
    if (!this.shadowRoot) return;
    const overlayContainer = this.shadowRoot.querySelector(".debug-overlay");
    if (!overlayContainer) return;
    overlayContainer.innerHTML = EnhancedDebugUI.createOverlayHTML(
      this.panels,
      this.activePanel,
      this.isExpanded,
      this.activePanelTab
    );
    this.addEventListeners();
    this.updateButtonStates();
  }
  updateContent() {
    if (!this.shadowRoot) return;
    const panelContent = this.shadowRoot.querySelector(".panel-content");
    if (panelContent) {
      const activePanel = this.panels.find((p) => p.id === this.activePanel);
      if (activePanel) {
        const tabs = activePanel.getTabs?.() || [];
        if (tabs.length > 0) {
          const activeTabId = this.activePanelTab || tabs[0]?.id;
          const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
          if (activeTab) {
            panelContent.innerHTML = activeTab.getContent();
          }
        } else {
          panelContent.innerHTML = activePanel.getContent();
        }
      }
    }
  }
  addEventListeners() {
    if (!this.shadowRoot) return;
    this.shadowRoot.removeEventListener("click", this.handleContainerClick);
    this.shadowRoot.addEventListener("click", this.handleContainerClick);
  }
  updateBodyHeight() {
    if (this.isExpanded) {
      document.body.classList.add("debug-body-expanded");
      document.documentElement.classList.add("debug-body-expanded");
    } else {
      document.body.classList.remove("debug-body-expanded");
      document.documentElement.classList.remove("debug-body-expanded");
    }
  }
  startAutoUpdate() {
    this.updateInterval = window.setInterval(() => {
      this.updateQuickStats();
      if ((this.activePanel === "cart" || this.activePanel === "config" || this.activePanel === "campaign") && this.activePanelTab !== "raw") {
        this.updateContent();
      }
    }, 1e3);
  }
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  // Public API for external access
  getEventManager() {
    return this.eventManager || null;
  }
  getPanels() {
    return this.panels || [];
  }
  setActivePanel(panelId) {
    if (this.panels.find((p) => p.id === panelId)) {
      this.activePanel = panelId;
      localStorage.setItem(_DebugOverlay.ACTIVE_PANEL_KEY, panelId);
      this.updateOverlay();
    }
  }
  logEvent(type, data, source = "Manual") {
    if (this.eventManager) {
      this.eventManager.logEvent(type, data, source);
    }
  }
  // Enhanced debug methods for global access
  clearCart() {
    useCartStore.getState().clear();
    this.updateContent();
  }
  exportAllData() {
    const debugData = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      cart: useCartStore.getState(),
      config: configStore.getState(),
      events: this.eventManager ? this.eventManager.getEvents() : [],
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    const data = JSON.stringify(debugData, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-session-${(/* @__PURE__ */ new Date()).toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  closeMiniCart() {
    if (!this.shadowRoot) return;
    const miniCart = this.shadowRoot.querySelector("#debug-mini-cart-display");
    if (miniCart) {
      miniCart.classList.remove("show");
      localStorage.setItem("debug-mini-cart-visible", "false");
      const cartButton = this.shadowRoot.querySelector('[data-action="toggle-mini-cart"]');
      if (cartButton) {
        cartButton.classList.remove("active");
        cartButton.setAttribute("title", "Toggle Mini Cart");
      }
    }
  }
  toggleMiniCart(forceShow) {
    if (!this.shadowRoot) return;
    let miniCart = this.shadowRoot.querySelector("#debug-mini-cart-display");
    if (!miniCart) {
      miniCart = document.createElement("div");
      miniCart.id = "debug-mini-cart-display";
      miniCart.className = "debug-mini-cart-display";
      this.shadowRoot.appendChild(miniCart);
      useCartStore.subscribe(() => {
        const cart = this.shadowRoot?.querySelector("#debug-mini-cart-display");
        if (cart && cart.classList.contains("show")) {
          this.updateMiniCart();
        }
      });
      if (forceShow !== false) {
        miniCart.classList.add("show");
        this.updateMiniCart();
      }
    } else {
      miniCart.classList.toggle("show");
      if (miniCart.classList.contains("show")) {
        this.updateMiniCart();
      }
    }
    localStorage.setItem("debug-mini-cart-visible", miniCart.classList.contains("show").toString());
    const cartButton = this.shadowRoot?.querySelector('[data-action="toggle-mini-cart"]');
    if (cartButton && miniCart) {
      if (miniCart.classList.contains("show")) {
        cartButton.classList.add("active");
        cartButton.setAttribute("title", "Hide Mini Cart");
      } else {
        cartButton.classList.remove("active");
        cartButton.setAttribute("title", "Toggle Mini Cart");
      }
    }
  }
  updateMiniCart() {
    if (!this.shadowRoot) return;
    const miniCart = this.shadowRoot.querySelector("#debug-mini-cart-display");
    if (!miniCart || !miniCart.classList.contains("show")) return;
    const cartState = useCartStore.getState();
    if (!cartState.items || cartState.items.length === 0) {
      miniCart.innerHTML = `
        <div class="debug-mini-cart-header">
          <span>🛒 Debug Cart</span>
          <button class="mini-cart-close" data-action="close-mini-cart">×</button>
        </div>
        <div class="debug-mini-cart-empty">Cart empty</div>
      `;
      return;
    }
    let itemsHtml = "";
    cartState.items.forEach((item) => {
      const isUpsell = item.is_upsell;
      const upsellBadge = isUpsell ? '<span class="mini-cart-upsell-badge">UPSELL</span>' : "";
      itemsHtml += `
        <div class="debug-mini-cart-item">
          <div class="mini-cart-item-info">
            <span class="mini-cart-item-id">ID: ${item.packageId}</span>
            ${upsellBadge}
            <span class="mini-cart-item-qty">×${item.quantity}</span>
          </div>
          <div class="mini-cart-item-title">${item.title || "Unknown"}</div>
          <div class="mini-cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
      `;
    });
    miniCart.innerHTML = `
      <div class="debug-mini-cart-header">
        <span>🛒 Debug Cart</span>
        <button class="mini-cart-close" data-action="close-mini-cart">×</button>
      </div>
      <div class="debug-mini-cart-items">${itemsHtml}</div>
      <div class="debug-mini-cart-footer">
        <div class="mini-cart-stat">
          <span>Items:</span>
          <span>${cartState.totalQuantity}</span>
        </div>
        <div class="mini-cart-stat">
          <span>Total:</span>
          <span class="mini-cart-total">${cartState.totals.total.formatted}</span>
        </div>
      </div>
    `;
  }
  toggleXray() {
    const isActive = XrayManager.toggle();
    const xrayButton = this.shadowRoot?.querySelector('[data-action="toggle-xray"]');
    if (xrayButton) {
      if (isActive) {
        xrayButton.classList.add("active");
        xrayButton.setAttribute("title", "Disable X-Ray View");
      } else {
        xrayButton.classList.remove("active");
        xrayButton.setAttribute("title", "Toggle X-Ray View");
      }
    }
    if (this.eventManager) {
      this.eventManager.logEvent("debug:xray-toggled", { active: isActive }, "Debug");
    }
  }
  updateButtonStates() {
    if (!this.shadowRoot) return;
    const xrayButton = this.shadowRoot.querySelector('[data-action="toggle-xray"]');
    if (xrayButton) {
      if (XrayManager.isXrayActive()) {
        xrayButton.classList.add("active");
        xrayButton.setAttribute("title", "Disable X-Ray View");
      } else {
        xrayButton.classList.remove("active");
        xrayButton.setAttribute("title", "Toggle X-Ray View");
      }
    }
    const miniCart = this.shadowRoot.querySelector("#debug-mini-cart-display");
    const cartButton = this.shadowRoot.querySelector('[data-action="toggle-mini-cart"]');
    if (cartButton) {
      if (miniCart && miniCart.classList.contains("show")) {
        cartButton.classList.add("active");
        cartButton.setAttribute("title", "Hide Mini Cart");
      } else {
        cartButton.classList.remove("active");
        cartButton.setAttribute("title", "Toggle Mini Cart");
      }
    }
  }
  updateQuickStats() {
    if (!this.shadowRoot) return;
    const cartState = useCartStore.getState();
    const cartItemsEl = this.shadowRoot.querySelector('[data-debug-stat="cart-items"]');
    const cartTotalEl = this.shadowRoot.querySelector('[data-debug-stat="cart-total"]');
    const enhancedElementsEl = this.shadowRoot.querySelector('[data-debug-stat="enhanced-elements"]');
    if (cartItemsEl) cartItemsEl.textContent = cartState.totalQuantity.toString();
    if (cartTotalEl) cartTotalEl.textContent = cartState.totals.total.formatted;
    if (enhancedElementsEl) enhancedElementsEl.textContent = document.querySelectorAll("[data-next-]").length.toString();
  }
};
_DebugOverlay.EXPANDED_STORAGE_KEY = "debug-overlay-expanded";
_DebugOverlay.ACTIVE_PANEL_KEY = "debug-overlay-active-panel";
_DebugOverlay.ACTIVE_TAB_KEY = "debug-overlay-active-tab";
let DebugOverlay = _DebugOverlay;
const debugOverlay = DebugOverlay.getInstance();
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    debugOverlay.initialize();
  });
}
const DebugOverlay$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  DebugOverlay,
  debugOverlay
});
const baseCSS = ".enhanced-debug-overlay{position:fixed;bottom:0;left:0;right:0;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,SF Pro Display,sans-serif;font-size:13px;line-height:1.4;color:#fff;transition:all .3s cubic-bezier(.4,0,.2,1);box-shadow:0 -4px 32px #0000004d}.enhanced-debug-overlay.collapsed{height:60px}.enhanced-debug-overlay.expanded{height:40vh;min-height:450px;max-height:calc(100vh - 120px)}body:has(.enhanced-debug-overlay.expanded){padding-bottom:40vh}.debug-body-expanded{padding-bottom:40vh!important;box-sizing:border-box}html.debug-body-expanded{overflow-x:hidden}.debug-bottom-bar{display:flex;align-items:center;justify-content:space-between;height:60px;background:linear-gradient(135deg,#1a1a1a,#2d2d2d);border-top:1px solid #3C7DFF;padding:0 20px;backdrop-filter:blur(20px)}.debug-logo-section{display:flex;align-items:center;gap:12px}.debug-logo{color:#3c7dff;filter:drop-shadow(0 0 8px rgba(60,125,255,.3))}.debug-title{font-weight:600;font-size:16px;color:#fff;letter-spacing:-.2px}.debug-status{display:flex;align-items:center;gap:6px;margin-left:12px;padding:4px 8px;background:#3c7dff1a;border-radius:12px;border:1px solid rgba(60,125,255,.2)}.status-indicator{width:6px;height:6px;border-radius:50%;background:#0f8;box-shadow:0 0 6px #0f8;animation:pulse 2s infinite}@keyframes pulse{0%,to{opacity:1}50%{opacity:.5}}.status-text{font-size:11px;color:#3c7dff;font-weight:500}.debug-quick-stats{display:flex;align-items:center;gap:24px}.stat-item{display:flex;flex-direction:column;align-items:center;gap:2px}.stat-value{font-size:16px;font-weight:700;color:#3c7dff;min-width:40px;text-align:center}.stat-label{font-size:10px;color:#888;text-transform:uppercase;font-weight:500;letter-spacing:.5px}.debug-controls{display:flex;align-items:center;gap:8px}.debug-control-btn,.debug-expand-btn{width:36px;height:36px;border:none;border-radius:8px;background:#ffffff1a;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease;position:relative;overflow:hidden}.debug-control-btn:hover,.debug-expand-btn:hover{background:#3c7dff33;transform:translateY(-1px);box-shadow:0 4px 12px #3c7dff4d}.debug-control-btn.active{background:#3c7dff4d;color:#87b4ff;box-shadow:inset 0 0 0 1px #3c7dff80}.debug-control-btn.active:hover{background:#3c7dff66}.debug-expand-btn{background:#3c7dff;color:#fff}.debug-expand-btn:hover{background:#2563eb;transform:translateY(-1px) scale(1.05)}.expand-icon{transition:transform .3s ease}.expand-icon.rotated{transform:rotate(180deg)}.close-btn:hover{background:#ff475733!important;color:#ff4757}.debug-expanded-content{display:flex;height:calc(100% - 60px);background:#1a1a1a}.debug-highlight{outline:2px solid #3C7DFF!important;outline-offset:2px!important;background:#3c7dff1a!important;position:relative!important;z-index:999998!important}.debug-highlight:after{content:attr(data-debug-label);position:absolute;top:-30px;left:0;background:#3c7dff;color:#fff;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:500;white-space:nowrap;z-index:999999}@media (max-width: 768px){.debug-quick-stats{display:none}.debug-bottom-bar{padding:0 12px}}@media (max-width: 640px){.debug-title{display:none}}";
const sidebarCSS = '.debug-sidebar{width:240px;background:linear-gradient(180deg,#222,#1a1a1a);border-right:1px solid #333;display:flex;flex-direction:column}.debug-panel-tabs{flex:1;padding:16px 0}.debug-panel-tab{width:100%;display:flex;align-items:center;gap:12px;padding:12px 20px;border:none;background:none;color:#888;cursor:pointer;transition:all .2s ease;position:relative;font-size:14px}.debug-panel-tab:hover{background:#3c7dff1a;color:#fff}.debug-panel-tab.active{background:#3c7dff26;color:#3c7dff;border-right:3px solid #3C7DFF}.debug-panel-tab.active:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#3c7dff}.tab-icon{font-size:16px;width:20px;text-align:center}.tab-label{font-weight:500;flex:1}.tab-badge{background:#3c7dff;color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;min-width:16px;text-align:center}.debug-sidebar-footer{padding:16px;border-top:1px solid #333;display:flex;flex-direction:column;gap:8px}.sidebar-btn{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#ffffff0d;color:#888;cursor:pointer;font-size:12px;transition:all .2s ease}.sidebar-btn:hover{background:#3c7dff1a;border-color:#3c7dff;color:#3c7dff}@media (max-width: 768px){.debug-sidebar{width:200px}}@media (max-width: 640px){.debug-sidebar{width:180px}}';
const panelsCSS = ".debug-main-content{flex:1;background:#1a1a1a;overflow:hidden;display:flex;flex-direction:column}.debug-panel-container{flex:1;display:flex;flex-direction:column;height:100%}.panel-header{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #333;background:linear-gradient(135deg,#222,#1a1a1a)}.panel-title{display:flex;align-items:center;gap:12px}.panel-icon{font-size:20px}.panel-title h2{margin:0;font-size:18px;font-weight:600;color:#fff}.panel-actions{display:flex;gap:8px}.panel-action-btn{padding:8px 16px;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s ease}.panel-action-btn.primary{background:#3c7dff;color:#fff}.panel-action-btn.secondary{background:#ffffff1a;color:#fff;border:1px solid #333}.panel-action-btn.danger{background:#ff47571a;color:#ff4757;border:1px solid rgba(255,71,87,.3)}.panel-action-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px #0000004d}.panel-action-btn.primary:hover{background:#2563eb}.panel-action-btn.secondary:hover{background:#ffffff26}.panel-action-btn.danger:hover{background:#ff475733}.panel-horizontal-tabs{display:flex;background:#1a1a1a;border-bottom:1px solid #333;overflow-x:auto}.horizontal-tab{display:flex;align-items:center;gap:8px;padding:12px 20px;background:none;border:none;color:#888;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s ease;white-space:nowrap;border-bottom:2px solid transparent}.horizontal-tab:hover{background:#ffffff0d;color:#ccc}.horizontal-tab.active{color:#3c7dff;border-bottom-color:#3c7dff;background:#3c7dff0d}.horizontal-tab .tab-icon{font-size:14px}.horizontal-tab .tab-label{font-weight:500}.panel-content{flex:1;padding:24px;overflow-y:auto;color:#ccc}.panel-content.no-padding{padding:0}.panel-content::-webkit-scrollbar{width:8px}.panel-content::-webkit-scrollbar-track{background:#ffffff05;border-radius:4px}.panel-content::-webkit-scrollbar-thumb{background:#ffffff1a;border-radius:4px;transition:background .2s ease}.panel-content::-webkit-scrollbar-thumb:hover{background:#fff3}.panel-content::-webkit-scrollbar-thumb:active{background:#ffffff4d}.panel-content{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) rgba(255,255,255,.02)}.panel-content>.enhanced-panel{margin-top:0}.panel-content>.enhanced-panel>*:first-child{margin-top:0}.panel-content .section:first-child,.panel-content .section:first-child .section-title,.panel-content h3:first-child,.panel-content .section-title:first-child,.panel-content h1,.panel-content h2,.panel-content h3,.panel-content h4,.panel-content h5,.panel-content h6{margin-top:0}.enhanced-panel{display:flex;flex-direction:column;gap:24px}.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px}.metric-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px;display:flex;align-items:center;gap:12px;transition:all .2s ease}.metric-card:hover{border-color:#3c7dff;box-shadow:0 4px 12px #3c7dff1a}.metric-icon{font-size:20px;width:32px;text-align:center}.metric-content{flex:1}.metric-value{font-size:18px;font-weight:700;color:#3c7dff;line-height:1}.metric-label{font-size:11px;color:#888;text-transform:uppercase;font-weight:500;letter-spacing:.5px;margin-top:2px}.section{display:flex;flex-direction:column;gap:16px}.section-title{font-size:16px;font-weight:600;color:#fff;margin:0;padding-bottom:8px;border-bottom:1px solid #333}.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.section-controls{display:flex;gap:8px}.sort-btn{background:#ffffff1a;border:1px solid #333;color:#ccc;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;transition:all .2s ease}.sort-btn:hover{background:#3c7dff1a;border-color:#3c7dff;color:#3c7dff}.empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 20px;color:#888;text-align:center}.empty-icon{font-size:32px;opacity:.5}.empty-text{font-size:14px}.empty-action{background:#3c7dff;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500}.json-viewer{background:#0f0f0f;border:1px solid #333;border-radius:8px;overflow:hidden}.json-viewer pre{margin:0;padding:16px;overflow-x:auto;font-family:SF Mono,monospace;font-size:12px;line-height:1.6;color:#e6e6e6}.debug-metric{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #2a2a2a}.debug-metric:last-child{border-bottom:none}.metric-label{color:#888;font-weight:500}.metric-value{color:#3c7dff;font-family:SF Mono,monospace;font-weight:600}@media (max-width: 768px){.panel-header,.panel-content{padding:16px}.metrics-grid{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}}";
const componentsCSS = ".cart-items-list{display:flex;flex-direction:column;gap:8px}.cart-item-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px;display:flex;align-items:center;gap:16px}.item-info{flex:1}.item-title{font-weight:600;color:#fff;margin-bottom:4px}.item-details{font-size:12px;color:#888}.item-quantity{display:flex;align-items:center;gap:8px}.qty-btn{width:24px;height:24px;border:1px solid #333;background:#ffffff0d;color:#fff;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:600}.qty-btn:hover{background:#3c7dff1a;border-color:#3c7dff}.qty-value{font-weight:600;color:#3c7dff;min-width:20px;text-align:center}.item-total{font-weight:600;color:#3c7dff}.remove-btn{width:24px;height:24px;border:1px solid rgba(255,71,87,.3);background:#ff47571a;color:#ff4757;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:600}.remove-btn:hover{background:#ff475733}.elements-list{display:flex;flex-direction:column;gap:8px}.element-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px;cursor:pointer;transition:all .2s ease}.element-card:hover{border-color:#3c7dff;box-shadow:0 4px 12px #3c7dff1a}.element-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.element-tag{background:#3c7dff;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase}.element-index{color:#888;font-size:12px}.element-attributes,.element-enhancers{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.attribute-tag{background:#ffffff1a;color:#ccc;padding:2px 6px;border-radius:3px;font-size:10px;font-family:SF Mono,monospace}.enhancer-tag{background:#3c7dff33;color:#3c7dff;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:500}.requests-list{display:flex;flex-direction:column;gap:8px}.request-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px}.request-card.error{border-color:#ff47574d}.request-card.success{border-color:#00ff884d}.request-header{display:flex;align-items:center;gap:12px;margin-bottom:8px}.request-method{padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase}.request-method.get{background:#0f83;color:#0f8}.request-method.post{background:#3c7dff33;color:#3c7dff}.request-method.put{background:#ffc10733;color:#ffc107}.request-method.delete{background:#ff475733;color:#ff4757}.request-url{flex:1;color:#ccc;font-family:SF Mono,monospace;font-size:12px}.request-status{padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600}.request-status.status-2xx{background:#0f83;color:#0f8}.request-status.status-4xx,.request-status.status-5xx{background:#ff475733;color:#ff4757}.request-time{color:#888;font-size:11px;font-family:SF Mono,monospace}.request-timestamp{color:#666;font-size:11px;margin-bottom:8px}.request-details summary{cursor:pointer;color:#3c7dff;font-size:12px;margin-top:8px}.request-data,.response-data{margin-top:12px}.request-data h4,.response-data h4{margin:0 0 8px;color:#fff;font-size:12px}.event-types{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}.event-type-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:6px;padding:12px;text-align:center;cursor:pointer;transition:all .2s ease}.event-type-card:hover{border-color:#3c7dff;box-shadow:0 2px 8px #3c7dff1a}.event-type-name{font-size:12px;color:#fff;font-weight:500}.event-type-count{font-size:16px;color:#3c7dff;font-weight:700;margin-top:4px}.events-timeline{display:flex;flex-direction:column;gap:12px}.timeline-event{display:flex;gap:16px;background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px}.event-time{color:#888;font-size:11px;font-family:SF Mono,monospace;white-space:nowrap;width:80px}.event-content{flex:1}.event-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}.event-type-badge{background:#3c7dff;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase}.event-source{color:#888;font-size:10px;text-transform:uppercase;font-weight:500}.event-data-preview{color:#ccc;font-size:12px;font-family:SF Mono,monospace}.event-item{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:12px;transition:all .2s ease}.event-item:hover{border-color:#3c7dff;box-shadow:0 4px 12px #3c7dff1a}.event-item .event-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.event-type{background:#3c7dff;color:#fff;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase}.event-data{background:#0f0f0f;border-radius:4px;padding:12px;font-family:SF Mono,monospace;font-size:11px;color:#ccc;max-height:120px;overflow-y:auto}.debug-mini-cart-display{position:fixed;top:20px;right:20px;background:#000000f2;border:1px solid #333;border-radius:8px;padding:0;min-width:280px;max-width:350px;max-height:400px;box-shadow:0 8px 32px #00000080;font-family:SF Mono,monospace;font-size:12px;color:#ccc;z-index:10000;display:none;overflow:hidden}.debug-mini-cart-display.show{display:block}.debug-mini-cart-header{background:linear-gradient(135deg,#1a1a1a,#111);padding:12px 16px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;font-weight:600;color:#3c7dff}.debug-mini-cart-header span{display:flex;align-items:center;gap:8px}.mini-cart-close{background:transparent;border:none;color:#888;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all .2s ease}.mini-cart-close:hover{background:#ff475733;color:#ff4757}.debug-mini-cart-empty{padding:40px 20px;text-align:center;color:#666;font-style:italic}.debug-mini-cart-items{max-height:280px;overflow-y:auto;padding:8px}.debug-mini-cart-item{background:#ffffff08;border:1px solid rgba(255,255,255,.05);border-radius:6px;padding:10px;margin-bottom:6px;transition:all .2s ease}.debug-mini-cart-item:hover{background:#3c7dff0d;border-color:#3c7dff33}.debug-mini-cart-item:last-child{margin-bottom:0}.mini-cart-item-info{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.mini-cart-item-id{color:#3c7dff;font-weight:600;font-size:11px}.mini-cart-item-qty{color:#ffc107;font-weight:600;font-size:11px}.mini-cart-upsell-badge{background:#ff4757;color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin:0 4px}.mini-cart-item-title{color:#fff;font-size:11px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mini-cart-item-price{color:#0f8;font-weight:600;font-size:12px;text-align:right}.debug-mini-cart-footer{background:linear-gradient(135deg,#1a1a1a,#111);border-top:1px solid #333;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}.mini-cart-stat{display:flex;align-items:center;gap:6px}.mini-cart-stat span:first-child{color:#888;font-size:11px}.mini-cart-stat span:last-child{color:#fff;font-weight:600}.mini-cart-total{color:#0f8!important;font-size:14px}.debug-mini-cart-items::-webkit-scrollbar{width:6px}.debug-mini-cart-items::-webkit-scrollbar-track{background:#ffffff05;border-radius:3px}.debug-mini-cart-items::-webkit-scrollbar-thumb{background:#3c7dff4d;border-radius:3px}.debug-mini-cart-items::-webkit-scrollbar-thumb:hover{background:#3c7dff80}";
const campaignCSS = ".campaign-overview{background:linear-gradient(135deg,#2a2a2a,#1a1a1a);border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:24px}.campaign-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.campaign-name{margin:0;font-size:24px;font-weight:700;color:#fff;background:linear-gradient(135deg,#3c7dff,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.campaign-badges{display:flex;gap:8px}.campaign-badge{padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}.campaign-badge.currency{background:#3c7dff33;color:#3c7dff}.campaign-badge.language{background:#0f83;color:#0f8}.packages-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;margin-bottom:32px}.package-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:12px;overflow:hidden;transition:all .3s ease;position:relative}.package-card:hover{border-color:#3c7dff;box-shadow:0 8px 32px #3c7dff1a;transform:translateY(-2px)}.package-card.in-cart{border-color:#0f8;background:linear-gradient(135deg,#00ff881a,#1a1a1a)}.package-image-container{position:relative;height:140px;background:#f8f9fa;display:flex;align-items:center;justify-content:center;overflow:hidden}.package-image{max-width:100%;max-height:100%;object-fit:contain}.recurring-badge,.cart-badge{position:absolute;top:8px;right:8px;background:#3c7dff;color:#fff;padding:4px 8px;border-radius:12px;font-size:10px;font-weight:600}.cart-badge{background:#0f8;color:#000;top:8px;left:8px}.package-info{padding:16px}.package-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}.package-name{margin:0;font-size:16px;font-weight:600;color:#fff;line-height:1.3}.package-id{font-size:11px;color:#888;font-family:SF Mono,monospace}.package-details{display:flex;gap:16px;margin-bottom:12px;font-size:12px;color:#888}.package-pricing{margin-bottom:16px}.price-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.price-label{font-size:12px;color:#888}.price-value{font-weight:600;font-family:SF Mono,monospace}.sale-price{color:#3c7dff;font-size:16px}.retail-price{color:#888;text-decoration:line-through}.recurring-price{color:#ff6b6b}.savings{background:#00ff881a;color:#0f8;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;text-align:center;margin-top:8px}.recurring-pricing{border-top:1px solid #333;padding-top:8px;margin-top:8px}.package-actions{display:flex;gap:8px;align-items:center}.package-btn{padding:8px 12px;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s ease;flex:1}.add-btn{background:#3c7dff;color:#fff}.add-btn:hover{background:#2563eb}.remove-btn{background:#ff47571a;color:#ff4757;border:1px solid rgba(255,71,87,.3)}.remove-btn:hover{background:#ff475733}.inspect-btn{background:#ffffff1a;color:#ccc;border:1px solid #333;flex:0 0 auto}.inspect-btn:hover{background:#ffffff26;color:#fff}.qty-controls{display:flex;align-items:center;gap:8px;flex:0 0 auto}.qty-controls button{width:24px;height:24px;border:1px solid #333;background:#ffffff0d;color:#fff;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:600}.qty-controls span{font-weight:600;color:#3c7dff;min-width:20px;text-align:center}.shipping-methods{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-bottom:24px}.shipping-method-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px;display:flex;align-items:center;gap:16px;transition:all .2s ease}.shipping-method-card:hover{border-color:#3c7dff;box-shadow:0 4px 12px #3c7dff1a}.shipping-info{flex:1}.shipping-name{font-size:16px;font-weight:600;color:#fff;margin-bottom:4px}.shipping-id{font-size:11px;color:#888;font-family:SF Mono,monospace}.shipping-price{font-size:18px;font-weight:700;color:#3c7dff;font-family:SF Mono,monospace}.shipping-test-btn{background:#3c7dff1a;border:1px solid #3C7DFF;color:#3c7dff;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s ease}.shipping-test-btn:hover{background:#3c7dff33}.raw-data-section{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;overflow:hidden}.raw-data-summary{padding:16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none}.raw-data-summary:hover{background:#ffffff0d}.toggle-icon{color:#888;transition:transform .2s ease}.raw-data-section[open] .toggle-icon{transform:rotate(180deg)}.raw-data-section .json-viewer{border-top:1px solid #333;margin:0}@media (max-width: 768px){.packages-grid,.shipping-methods{grid-template-columns:1fr}.campaign-header{flex-direction:column;align-items:flex-start;gap:12px}.package-card{margin-bottom:16px}.package-actions{flex-direction:column;gap:8px}.package-btn{width:100%}}";
const panelComponentsCSS = ".enhanced-panel{display:flex;flex-direction:column;gap:24px}.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px}.metric-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px;display:flex;align-items:center;gap:12px;transition:all .2s ease}.metric-card:hover{border-color:#3c7dff;box-shadow:0 4px 12px #3c7dff1a}.metric-icon{font-size:20px;width:32px;text-align:center}.metric-content{flex:1}.metric-value{font-size:18px;font-weight:700;color:#3c7dff;line-height:1}.metric-label{font-size:11px;color:#888;text-transform:uppercase;font-weight:500;letter-spacing:.5px;margin-top:2px}.section{display:flex;flex-direction:column;gap:16px}.section-title{font-size:16px;font-weight:600;color:#fff;margin:0;padding-bottom:8px;border-bottom:1px solid #333}.empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 20px;color:#888;text-align:center}.empty-icon{font-size:32px;opacity:.5}.empty-text{font-size:14px}.empty-action{background:#3c7dff;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500}.config-groups{display:flex;flex-direction:column;gap:24px}.config-group{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:20px}.config-group-title{font-size:14px;font-weight:600;color:#fff;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #333}.config-items{display:flex;flex-direction:column;gap:12px}.config-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0}.config-key{font-size:12px;color:#ccc;font-weight:500}.config-value{font-size:12px;color:#fff;font-family:SF Mono,monospace}.config-value.enabled{color:#0f8}.config-value.disabled{color:#888}.form-fields-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}.field-status-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:6px;padding:12px;text-align:center;transition:all .2s ease}.field-status-card.filled{border-color:#00ff884d;background:linear-gradient(135deg,#00ff881a,#1a1a1a)}.field-status-card.error{border-color:#ff47574d;background:linear-gradient(135deg,#ff47571a,#1a1a1a)}.field-name{font-size:11px;color:#ccc;font-weight:500;margin-bottom:4px}.field-status{font-size:14px}.customer-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.info-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px}.info-card h4{margin:0 0 12px;font-size:14px;color:#fff;font-weight:600}.info-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.info-label{font-size:12px;color:#888}.info-value{font-size:12px;color:#fff;font-family:SF Mono,monospace}.info-empty{color:#666;font-style:italic;font-size:12px}.address-info,.validation-errors{display:flex;flex-direction:column;gap:8px}.error-item{background:linear-gradient(135deg,#ff47571a,#1a1a1a);border:1px solid rgba(255,71,87,.3);border-radius:6px;padding:12px;display:flex;gap:8px}.error-field{font-weight:600;color:#ff4757;font-size:12px}.error-message{color:#ccc;font-size:12px}.storage-items{display:flex;flex-direction:column;gap:12px}.storage-item-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px;transition:all .2s ease}.storage-item-card.next-item{border-color:#3c7dff4d;background:linear-gradient(135deg,#3c7dff0d,#1a1a1a)}.storage-item-header{display:flex;align-items:center;gap:12px;margin-bottom:8px}.storage-key{flex:1;font-family:SF Mono,monospace;font-size:12px;color:#fff;font-weight:500}.storage-type{padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase}.storage-type.local{background:#0f83;color:#0f8}.storage-type.session{background:#ffc10733;color:#ffc107}.storage-delete-btn{width:20px;height:20px;border:1px solid rgba(255,71,87,.3);background:#ff47571a;color:#ff4757;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px}.storage-delete-btn:hover{background:#ff475733}.storage-item-size{font-size:10px;color:#666;margin-bottom:8px}.storage-item-value{background:#0f0f0f;border:1px solid #333;border-radius:4px;overflow:hidden}.storage-item-value pre{margin:0;padding:12px;overflow-x:auto;font-family:SF Mono,monospace;font-size:11px;line-height:1.4;color:#e6e6e6;max-height:200px;overflow-y:auto}.json-viewer{background:#0f0f0f;border:1px solid #333;border-radius:8px;overflow:hidden}.json-viewer pre{margin:0;padding:16px;overflow-x:auto;font-family:SF Mono,monospace;font-size:12px;line-height:1.6;color:#e6e6e6;max-height:400px;overflow-y:auto}.analytics-charts{display:flex;flex-direction:column;gap:12px}.analytics-bar{display:flex;flex-direction:column;gap:4px}.bar-label{font-size:12px;color:#ccc;font-weight:500}.bar-container{position:relative;background:#0f0f0f;border:1px solid #333;border-radius:4px;height:24px;overflow:hidden}.bar-fill{background:linear-gradient(90deg,#3c7dff,#2563eb);height:100%;transition:width .3s ease}.bar-value{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;color:#fff;font-weight:500}.source-stats{display:flex;flex-direction:column;gap:8px}.source-stat-item{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:6px}.source-name{font-size:12px;color:#ccc}.source-count{font-size:12px;color:#3c7dff;font-weight:600}.method-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.method-stat-card{background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:8px;padding:16px}.method-name{font-size:14px;font-weight:600;color:#fff;margin-bottom:8px}.method-metrics{display:flex;flex-direction:column;gap:4px}.method-metrics .metric{font-size:11px;color:#888}.performance-chart{display:flex;flex-direction:column;gap:8px}.performance-bar{display:flex;flex-direction:column;gap:4px}.enhancer-distribution{display:flex;flex-direction:column;gap:8px}.enhancer-dist-item{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:6px}.enhancer-type{font-size:12px;color:#ccc}.enhancer-count{font-size:12px;color:#3c7dff;font-weight:600}.performance-metrics{display:flex;flex-direction:column;gap:12px}.performance-metric{display:flex;justify-content:space-between;align-items:center;padding:12px;background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:6px}.enhancement-timeline{display:flex;flex-direction:column;gap:8px}.timeline-item{display:flex;gap:16px;padding:8px 12px;background:linear-gradient(135deg,#222,#1a1a1a);border:1px solid #333;border-radius:6px}.timeline-time{font-size:11px;color:#888;font-family:SF Mono,monospace;min-width:60px}.timeline-event{font-size:12px;color:#ccc}@media (max-width: 768px){.metrics-grid,.form-fields-grid{grid-template-columns:repeat(2,1fr)}.customer-info{grid-template-columns:1fr}.config-groups{gap:16px}.storage-items{gap:8px}.method-stats{grid-template-columns:1fr}}";
const eventTimelineCSS = ".timeline-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f8f9fa;border-bottom:1px solid #e9ecef;border-radius:4px 4px 0 0;margin-bottom:12px}.timeline-stats{display:flex;gap:16px}.timeline-stat{display:flex;flex-direction:column;align-items:center;font-size:11px}.timeline-stat-label{color:#6c757d;margin-bottom:2px}.timeline-stat-value{font-weight:600;color:#495057}.timeline-stat-value.recording{color:#28a745}.timeline-stat-value.paused{color:#dc3545}.timeline-controls{display:flex;gap:8px}.timeline-control-btn{padding:6px 12px;border:1px solid #dee2e6;border-radius:3px;background:#fff;font-size:11px;cursor:pointer;transition:all .2s}.timeline-control-btn:hover{background:#f8f9fa;transform:translateY(-1px)}.timeline-control-btn.record{background:#28a745;color:#fff;border-color:#28a745}.timeline-control-btn.pause{background:#ffc107;color:#212529;border-color:#ffc107}.timeline-control-btn.clear{background:#dc3545;color:#fff;border-color:#dc3545}.timeline-control-btn.export{background:#007bff;color:#fff;border-color:#007bff}.timeline-events{max-height:500px;overflow-y:auto;padding:0 4px}.timeline-event{background:#fff;border:1px solid #e9ecef;border-radius:4px;margin-bottom:8px;transition:all .2s;position:relative}.timeline-event:hover{box-shadow:0 2px 8px #0000001a;transform:translateY(-1px)}.timeline-event-header{padding:8px 12px;border-bottom:1px solid #f8f9fa;display:flex;justify-content:space-between;align-items:center}.timeline-event-meta{display:flex;align-items:center;gap:8px;font-size:11px}.timeline-event-icon{font-size:14px}.timeline-event-type{font-weight:600;text-transform:uppercase;letter-spacing:.5px}.timeline-event-time{color:#6c757d;font-style:italic}.timeline-event-name{font-weight:600;color:#495057;font-size:13px}.timeline-event-details{padding:8px 12px;font-size:11px}.timeline-event-source{color:#6c757d;margin-bottom:8px}.timeline-event-data-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.timeline-toggle-data{background:none;border:1px solid #dee2e6;border-radius:2px;padding:2px 6px;font-size:10px;cursor:pointer;color:#007bff}.timeline-toggle-data:hover{background:#f8f9fa}.timeline-event-data-content{background:#f8f9fa;border:1px solid #e9ecef;border-radius:3px;padding:8px;margin:4px 0;font-family:Monaco,Consolas,monospace;font-size:10px;line-height:1.4;max-height:200px;overflow-y:auto}.timeline-event-data-preview{background:#f8f9fa;border:1px solid #e9ecef;border-radius:3px;padding:6px;font-family:Monaco,Consolas,monospace;font-size:10px;color:#6c757d;white-space:pre-wrap;word-break:break-all}.timeline-empty{text-align:center;padding:40px 20px;color:#6c757d}.timeline-empty-icon{font-size:48px;margin-bottom:16px}.timeline-empty-title{font-size:16px;font-weight:600;margin-bottom:8px;color:#495057}.timeline-empty-subtitle{font-size:13px}.analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.analytics-card{background:#fff;border:1px solid #e9ecef;border-radius:4px;padding:12px}.analytics-card-full{grid-column:1 / -1}.analytics-card-title{font-weight:600;margin-bottom:12px;color:#495057;font-size:13px;border-bottom:1px solid #f8f9fa;padding-bottom:6px}.analytics-stats{display:flex;flex-direction:column;gap:8px}.analytics-stat{display:flex;justify-content:space-between;font-size:11px}.analytics-stat-label{color:#6c757d}.analytics-stat-value{font-weight:600;color:#495057}.analytics-distribution{display:flex;flex-direction:column;gap:6px}.analytics-distribution-item{display:flex;align-items:center;gap:8px;font-size:11px}.analytics-distribution-bar{flex:1;height:16px;background:#f8f9fa;border-radius:8px;overflow:hidden;position:relative}.analytics-distribution-fill{height:100%;border-radius:8px;transition:width .3s ease}.analytics-distribution-label{min-width:80px;color:#495057;font-weight:500}.analytics-sources{display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto}.analytics-source-item{display:flex;justify-content:space-between;padding:4px 8px;background:#f8f9fa;border-radius:3px;font-size:11px}.analytics-source-name{color:#495057;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.analytics-source-count{color:#6c757d;font-weight:600;min-width:20px;text-align:right}.timeline-chart{display:flex;align-items:end;gap:4px;height:100px;padding:8px;background:#f8f9fa;border-radius:4px}.timeline-chart-bar{flex:1;background:linear-gradient(to top,#007bff,#66b3ff);border-radius:2px 2px 0 0;min-height:2px;position:relative;cursor:pointer;transition:all .2s}.timeline-chart-bar:hover{opacity:.8;transform:scaleY(1.1)}.timeline-chart-value{position:absolute;top:-16px;left:50%;transform:translate(-50%);font-size:9px;color:#495057;font-weight:600;opacity:0;transition:opacity .2s}.timeline-chart-bar:hover .timeline-chart-value{opacity:1}.filters-container{padding:12px;display:flex;flex-direction:column;gap:16px}.filter-group{border:1px solid #e9ecef;border-radius:4px;padding:12px;background:#fff}.filter-group-title{font-weight:600;margin-bottom:8px;color:#495057;font-size:12px}.filter-search-input{width:100%;padding:6px 8px;border:1px solid #dee2e6;border-radius:3px;font-size:11px}.filter-search-input:focus{outline:none;border-color:#007bff;box-shadow:0 0 0 2px #007bff40}.filter-checkboxes{display:flex;flex-direction:column;gap:6px}.filter-checkbox{display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:4px;border-radius:3px;transition:background .2s}.filter-checkbox:hover{background:#f8f9fa}.filter-checkbox input[type=checkbox]{margin:0}.filter-checkbox-icon{font-size:14px}.filter-checkbox-label{color:#495057}.filter-sources-list{max-height:150px;overflow-y:auto;border:1px solid #e9ecef;border-radius:3px;padding:4px}.filter-empty{color:#6c757d;font-style:italic;text-align:center;padding:12px;font-size:11px}.filter-time-range{width:100%;padding:6px 8px;border:1px solid #dee2e6;border-radius:3px;font-size:11px;background:#fff}.filter-controls{display:flex;gap:8px}.filter-control-btn{flex:1;padding:8px 12px;border:1px solid #dee2e6;border-radius:3px;background:#fff;font-size:11px;cursor:pointer;transition:all .2s}.filter-control-btn:hover{background:#f8f9fa;transform:translateY(-1px)}@media (max-width: 768px){.timeline-header{flex-direction:column;gap:12px;align-items:stretch}.timeline-stats{justify-content:space-around}.analytics-grid{grid-template-columns:1fr}.filter-controls{flex-direction:column}}@keyframes eventAdded{0%{opacity:0;transform:translate(-20px)}to{opacity:1;transform:translate(0)}}.timeline-event.new{animation:eventAdded .3s ease-out}.timeline-events::-webkit-scrollbar,.analytics-sources::-webkit-scrollbar,.filter-sources-list::-webkit-scrollbar{width:6px}.timeline-events::-webkit-scrollbar-track,.analytics-sources::-webkit-scrollbar-track,.filter-sources-list::-webkit-scrollbar-track{background:#f8f9fa;border-radius:3px}.timeline-events::-webkit-scrollbar-thumb,.analytics-sources::-webkit-scrollbar-thumb,.filter-sources-list::-webkit-scrollbar-thumb{background:#dee2e6;border-radius:3px}.timeline-events::-webkit-scrollbar-thumb:hover,.analytics-sources::-webkit-scrollbar-thumb:hover,.filter-sources-list::-webkit-scrollbar-thumb:hover{background:#adb5bd}";
const _DebugStyleLoader = class _DebugStyleLoader {
  static async loadDebugStyles() {
    if (this.isLoading || this.styleElement) return;
    this.isLoading = true;
    try {
      const combinedCSS = await this.getDebugStyles();
      this.styleElement = document.createElement("style");
      this.styleElement.id = "debug-overlay-styles";
      this.styleElement.textContent = combinedCSS;
      document.head.appendChild(this.styleElement);
      console.log("🎨 Debug styles injected");
    } catch (error) {
      console.error("Failed to load debug styles:", error);
    } finally {
      this.isLoading = false;
    }
  }
  static async getDebugStyles() {
    return [
      baseCSS,
      sidebarCSS,
      panelsCSS,
      componentsCSS,
      campaignCSS,
      panelComponentsCSS,
      eventTimelineCSS
    ].join("\n");
  }
  static removeDebugStyles() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    const existingStyle = document.getElementById("debug-overlay-styles");
    if (existingStyle) {
      existingStyle.remove();
    }
  }
};
_DebugStyleLoader.styleElement = null;
_DebugStyleLoader.isLoading = false;
let DebugStyleLoader = _DebugStyleLoader;
const DebugStyleLoader$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  DebugStyleLoader
});
export {
  DebugOverlay$1 as D,
  useOrderStore as a,
  checkoutStore as c,
  testModeManager as t,
  useCheckoutStore as u
};

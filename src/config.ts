// Development config module with HMR support

// This config is ONLY loaded in debug mode (?debug=true) via loader.js
// In production, merchants provide their own window.nextConfig

const config = {
    apiKey: "kLGpgEfCX3iUZG16hpI5zrCH9qxcOdahDY1im6ud",
    debug: true, // Always true since this file only loads in debug mode
    paymentConfig: {
      expressCheckout: {
        requireValidation: true,
        requiredFields: ['email', 'fname', 'lname'],
        methodOrder: ['paypal', 'apple_pay', 'google_pay']
      }
    },
    addressConfig: {
      // ⚠️ OPTIONAL: defaultCountry is now a low-priority fallback
      // Automatic fallback when detected country unavailable:
      //   1. United States (US) - if in shipping list
      //   2. First available country - if US not in list
      //   3. This defaultCountry - only if list is empty (rare)
      // defaultCountry: "US",

      // ⚠️ DEPRECATED: showCountries is no longer needed!
      // Countries are now automatically loaded from campaign API (available_shipping_countries)
      // This ensures your country dropdown always matches what your campaign can ship to.
      // You can still use this for testing, but production should rely on the API.
      // showCountries: ["US", "CA", "GB", "BR"],

      // Hide specific US territories from state dropdowns
      dontShowStates: ["AS", "GU", "PR", "VI"]
    },
    discounts: {
      SAVE10: {
        code: "SAVE10",
        type: "percentage",
        value: 10,
        scope: "order",
        description: "10% off entire order",
        combinable: true
      }
    },
    googleMaps: {
      apiKey: "AIzaSyBmrv1QRE41P9FhFOTwUhRMGg6LcFH1ehs",
      region: "US",
      enableAutocomplete: true
    },
    tracking: "auto",
    analytics: {
      enabled: true,
      mode: 'auto', // auto | manual | disabled
      providers: {
        nextCampaign: {
          enabled: true
        },
        gtm: {
          enabled: true,
          settings: {
            containerId: "GTM-MCGB3JBM",
            dataLayerName: "dataLayer"
          }
        },
        facebook: {
          enabled: true,
          settings: {
            pixelId: "286865669194576"
          }
        },
        rudderstack: {
          enabled: true,
          settings: {
            // RudderStack configuration is handled by the RudderStack SDK itself
            // This just enables the adapter
          }
        },
        custom: {
          enabled: false,
          settings: {
            endpoint: "https://your-analytics.com/track",
            apiKey: "your-api-key"
          }
        }
      }
    },
    // Error monitoring removed - add externally via HTML/scripts if needed,
    utmTransfer: {
      enabled: true,
      applyToExternalLinks: false,
      debug: true,
      // excludedDomains: ['example.com', 'test.org'],
      // paramsToCopy: ['utm_source', 'utm_medium']
    }
};

// Set on window for compatibility
(window as any).nextConfig = config;

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('[Config] Hot update received');
    window.location.reload();
  });
}

export default config;
// Fallback config, only fetched when `/src/config.ts` fails to load (loader.js
// `configScript.onerror`) — i.e. when the repo is served without the Vite dev server.
// With `npm run dev` running, config.ts wins and this file is never requested.
//
// Credentials are deliberately empty: this file is tracked in git and, unlike
// config.ts, it is loaded as a classic script, so `import.meta.env` is not available
// to read them from `.env.local`. Fill them in locally if you need this path, and do
// not commit the result. Prefer config.ts, which does read the environment.
window.nextConfig = {
    apiKey: "",
    debug: true,
    paymentConfig: {
      expressCheckout: {
        enabled: true,
        requireValidation: false,
        requiredFields: ['email', 'fname', 'lname'],
        methodOrder: ['paypal', 'apple_pay', 'google_pay']
      }
    },
    addressConfig: {
      defaultCountry: "US",
      showCountries: ["US", "CA", "GB"],
      // dontShowStates: ["AS", "GU", "PR", "VI"]
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
      // Empty means Google Maps autocomplete stays off and the SDK's own is used.
      // A Google Maps key is billable — never commit one, demo or otherwise.
      apiKey: "",
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
        custom: {
          enabled: false,
          settings: {
            endpoint: "https://your-analytics.com/track",
            apiKey: "your-api-key"
          }
        }
      }
    },
  };
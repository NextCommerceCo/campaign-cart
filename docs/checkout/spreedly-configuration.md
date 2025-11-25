# Card Input Configuration

Configure credit card input fields through `window.nextConfig`. All options are **optional** - the SDK works perfectly with defaults.

> **Note**: This configuration was previously named `spreedly`. Both `cardInputConfig` (recommended) and the legacy `spreedly`/`spreedlyConfig` names are supported for backward compatibility.

## Basic Usage (No Config Needed)

The SDK automatically loads the payment environment key from your campaign API. No configuration needed:

```javascript
// That's it! Card input works out of the box
```

## Custom Configuration (Optional)

Add custom card input settings to control field types, styling, security, and more:

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',

  // Optional card input configuration (recommended naming)
  cardInputConfig: {
    // Field types (controls mobile keyboards)
    fieldType: {
      number: 'tel',    // Options: 'text' | 'tel' | 'number'
      cvv: 'number'     // Options: 'text' | 'tel' | 'number'
    },

    // Number format
    numberFormat: 'prettyFormat',  // 'prettyFormat' | 'plainFormat' | 'maskedFormat'

    // Custom placeholders
    placeholders: {
      number: 'Enter Card Number',
      cvv: 'CVV'
    },

    // Custom styling (CSS string)
    styles: {
      number: 'font-size: 16px; color: #333; padding: 12px;',
      cvv: 'font-size: 16px; color: #333; padding: 12px;',
      placeholder: 'color: #999; font-style: italic;'
    },

    // Security parameters (for enhanced authentication)
    nonce: 'unique-session-uuid',              // Generated per session
    timestamp: '1738252535',                   // Epoch time
    certificateToken: 'your-cert-token',       // From payment provider
    signature: 'server-generated-signature',   // SHA256 hash

    // Fraud detection
    fraud: true,  // or { siteId: 'your-fraud-site-id' }

    // Other options
    enableAutoComplete: false,
    allowBlankName: false,
    allowExpiredDate: false
  }
};
```

## Configuration Options

### Field Types

Control keyboard display on mobile devices:

```javascript
cardInputConfig: {
  fieldType: {
    number: 'tel',    // Shows telephone keypad
    cvv: 'number'     // Shows numeric keypad
  }
}
```

**Options**: `'text'`, `'tel'`, `'number'`

### Number Format

```javascript
cardInputConfig: {
  numberFormat: 'prettyFormat'  // 4111 1111 1111 1111
  // numberFormat: 'plainFormat'   // 4111111111111111
  // numberFormat: 'maskedFormat'  // ****************
}
```

### Placeholders

```javascript
cardInputConfig: {
  placeholders: {
    number: 'Card Number',
    cvv: 'Security Code'
  }
}
```

### Labels (Accessibility)

```javascript
cardInputConfig: {
  labels: {
    number: 'Credit Card Number',
    cvv: 'CVV Code'
  }
}
```

### Titles (Accessibility)

```javascript
cardInputConfig: {
  titles: {
    number: 'Enter your card number',
    cvv: 'Enter security code'
  }
}
```

### Custom Styling

Apply CSS to iFrame fields:

```javascript
cardInputConfig: {
  styles: {
    number: 'font-size: 18px; color: #000; font-family: Arial;',
    cvv: 'font-size: 18px; color: #000;',
    placeholder: 'color: #aaa; font-weight: 300;'
  }
}
```

### Security Parameters

For enhanced security (optional):

```javascript
cardInputConfig: {
  nonce: generateUUID(),                    // Unique per session
  timestamp: Math.floor(Date.now() / 1000).toString(),
  certificateToken: 'your-certificate-token',
  signature: generateSignatureOnServer()    // Server-generated
}
```

**Note**: The signature must be generated server-side using your private key.

### Fraud Detection

Enable fraud prevention:

```javascript
cardInputConfig: {
  fraud: true  // Uses default fraud detection
}

// OR with custom fraud site

cardInputConfig: {
  fraud: { siteId: 'your-fraud-site-id' }  // BYOC fraud
}
```

### Validation Options

```javascript
cardInputConfig: {
  allowBlankName: false,      // Skip name validation
  allowExpiredDate: false,    // Allow expired cards
  enableAutoComplete: false   // Disable autocomplete
}
```

### Required Attributes

Control HTML `required` attribute:

```javascript
cardInputConfig: {
  requiredAttributes: {
    number: true,  // Default
    cvv: true      // Default
  }
}
```

## Naming Conventions (Backward Compatibility)

The following property names are all supported. Priority order (highest to lowest):

1. `cardInputConfig` - **Recommended** (generic naming)
2. `spreedly` - Legacy naming (still supported)
3. `spreedlyConfig` - Legacy naming (still supported)

```javascript
window.nextConfig = {
  // Recommended (new projects)
  cardInputConfig: { /* config */ }

  // OR legacy naming (existing projects)
  spreedly: { /* config */ }

  // OR alternative legacy naming
  spreedlyConfig: { /* config */ }
};
```

## Default Values

If you don't provide configuration, these defaults are used:

```javascript
{
  fieldType: {
    number: 'text',
    cvv: 'text'
  },
  numberFormat: 'prettyFormat',
  placeholders: {
    number: 'Card Number',
    cvv: 'CVV *'
  },
  styles: {
    number: 'color: #212529; font-size: .925rem; font-weight: 400; width: 100%; height:100%;',
    cvv: 'color: #212529; font-size: .925rem; font-weight: 400; width: 100%; height:100%;'
  },
  requiredAttributes: {
    number: true,
    cvv: true
  },
  enableAutoComplete: true,
  allowBlankName: false,
  allowExpiredDate: false
}
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="next-api-key" content="your-api-key">

  <script>
    window.nextConfig = {
      apiKey: 'your-api-key',

      cardInputConfig: {
        // Mobile-friendly keyboards
        fieldType: {
          number: 'tel',
          cvv: 'number'
        },

        // Pretty formatting (4111 1111 1111 1111)
        numberFormat: 'prettyFormat',

        // Custom styling to match your design
        styles: {
          number: 'font-size: 16px; color: #2c3e50; padding: 14px; font-family: -apple-system, sans-serif;',
          cvv: 'font-size: 16px; color: #2c3e50; padding: 14px; font-family: -apple-system, sans-serif;',
          placeholder: 'color: #95a5a6; font-weight: 300;'
        },

        // Custom placeholders
        placeholders: {
          number: 'Enter your card number',
          cvv: 'CVV'
        },

        // Enable fraud detection
        fraud: true
      }
    };
  </script>

  <script src="https://campaign-cart-v2.pages.dev/loader.js"></script>
</head>
<body>
  <form data-next-checkout="form">
    <!-- Card input iFrame fields -->
    <div data-next-checkout-field="cc-number"></div>
    <div data-next-checkout-field="cvv"></div>

    <button type="submit">Complete Order</button>
  </form>
</body>
</html>
```

## Debugging

Enable debug logging to see applied configuration:

```javascript
window.nextConfig = {
  debug: true,
  cardInputConfig: { /* your config */ }
};
```

Check browser console for:
```
[CreditCardService] Card input configuration applied: {
  fieldType: { number: 'tel', cvv: 'number' },
  numberFormat: 'prettyFormat',
  ...
}
```

## Migration Guide

If you're migrating from the legacy `spreedly` naming:

**Before (still works):**
```javascript
window.nextConfig = {
  spreedly: {
    fieldType: { number: 'tel' },
    styles: { number: 'font-size: 16px;' }
  }
};
```

**After (recommended):**
```javascript
window.nextConfig = {
  cardInputConfig: {
    fieldType: { number: 'tel' },
    styles: { number: 'font-size: 16px;' }
  }
};
```

No code changes are required - the legacy naming will continue to work indefinitely.

## Related Documentation

- [Checkout Configuration](../guides/configuration.md)
- [Payment Integration](./payment-integration.md)

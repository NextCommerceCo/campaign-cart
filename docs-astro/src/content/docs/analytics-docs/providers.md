# Analytics Providers Overview

Configure multiple analytics providers to send events simultaneously to GTM, Facebook Pixel, RudderStack, and custom platforms.

Configure analytics providers to send events to multiple platforms. The SDK supports Google Tag Manager, Direct GA4 integration, Facebook Pixel, RudderStack, and custom webhooks.

## Provider Configuration

Enable multiple providers in your configuration:

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  storeName: 'my-store',  // Important for Facebook deduplication
  analytics: {
    enabled: true,
    mode: 'auto',
    providers: {
      gtm: { enabled: true },
      facebook: { enabled: true, settings: { pixelId: 'xxx' } },
      rudderstack: { enabled: true },
      custom: { enabled: true, settings: { endpoint: 'https://...' } }
    }
  }
};
```

## Providers Comparison

| Provider | Best For | Setup Complexity | Auto-Deduplication |
|----------|----------|------------------|--------------------|
| **Google Tag Manager** | Event tracking & conversion measurement | Low | Yes (via GTM) |
| **Direct GA4 (No GTM)** | Simple GA4 tracking without GTM | Very Low | Yes (automatic) |
| **Facebook Pixel** | Conversion tracking & audience building | Medium | Yes (with storeName) |
| **RudderStack** | Data warehouse integration & CDP | High | Yes (via RudderStack) |
| **Custom Webhook** | Third-party integrations & APIs | Medium | Manual |

## Provider Independence

Each provider operates independently. If one provider fails or is temporarily unavailable:

- Other providers continue to receive and process events normally
- Failed requests do not block the event pipeline
- Your analytics data is safely distributed across multiple platforms
- No single point of failure exists

## Using Multiple Providers

You can enable any combination of providers simultaneously:

### All Providers

Enable all providers for data collection across multiple platforms:

```javascript
analytics: {
  providers: {
    gtm: { enabled: true },
    facebook: { enabled: true, settings: { pixelId: 'YOUR_PIXEL_ID' } },
    rudderstack: { enabled: true },
    custom: { enabled: true, settings: { endpoint: 'https://your-api.com/events' } }
  }
}
```

### Selective Providers

Choose only the providers you need:

```javascript
analytics: {
  providers: {
    gtm: { enabled: true },
    facebook: { enabled: true, settings: { pixelId: 'YOUR_PIXEL_ID' } },
    rudderstack: { enabled: false },
    custom: { enabled: false }
  }
}
```

> **Tip:** Enable multiple providers to send analytics data to all required platforms. If one service fails, others continue operating.

## Provider Setup Guides

### Built-in Providers

- **[Google Tag Manager](./google-tag-manager.md)** - Container setup and variable configuration
- **[Facebook Pixel](./facebook-pixel.md)** - Conversion tracking and audience building
- **[RudderStack](./rudderstack.md)** - Data warehouse and CDP integration
- **[Custom Webhook](./custom-webhook.md)** - Third-party API integration

### Alternative Integrations

- **[Direct GA4 (No GTM)](./direct-ga4.md)** - Send events directly to Google Analytics 4 without GTM
- **[Event Transformers](./event-transformers.md)** - Build custom transformers for any platform (TikTok, Snapchat, Pinterest, etc.)

## Next Steps

1. Choose which providers you need
2. Follow the provider-specific setup guide
3. Test event delivery in your development environment
4. Deploy to production

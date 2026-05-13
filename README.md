# Next Commerce Cart SDK

TypeScript SDK for building campaign pages on [NextCommerce](https://nextcommerce.com). Provides cart management, checkout flows, upsell sequences, and analytics through a data-attribute-driven HTML API.

## Links

- **Docs**: [developers.nextcommerce.com/docs/campaigns](https://developers.nextcommerce.com/docs/campaigns)
- **Starter templates**: [github.com/NextCommerceCo/campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)

## Development

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Type check | `npm run type-check` |
| Lint | `npm run lint` |
| Unit tests | `npm run test` |
| E2E tests | `npm run test:e2e` |

See [CLAUDE.md](CLAUDE.md) for architecture overview and contribution guidelines.

## Test Mode API

Automation can enable checkout test mode without synthesizing the Konami key
sequence:

```js
document.dispatchEvent(new CustomEvent('next:test-mode-activate', {
  detail: { method: 'qa-automation', fillCard: true }
}));
```

This activates test mode, emits `next:test-mode-activated`, and fills test
checkout/card fields when requested. It does not create an order or redirect.
Test orders still require an explicit submit click through the rendered checkout.

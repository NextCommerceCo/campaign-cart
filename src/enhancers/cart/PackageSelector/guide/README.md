# PackageSelectorEnhancer Guide

The `PackageSelectorEnhancer` manages a group of mutually-exclusive selectable package cards.
The visitor picks exactly one package. It supports two modes: **swap** (immediate cart write on
selection) and **select** (external button handles the cart action).

---

## Contents

| File | Description |
|---|---|
| [overview.md](overview.md) | How it works, modes, CSS classes |
| [attributes.md](attributes.md) | All `data-next-*` attributes — container, card, quantity controls, price slots |
| [prices.md](prices.md) | Price slots, when prices re-fetch, shipping and upsell pricing |
| [events.md](events.md) | Events emitted, payloads, listening examples |
| [template.md](template.md) | Auto-render mode — `data-next-packages` + template tokens |
| [cart-sync.md](cart-sync.md) | Cart sync behaviour, AddToCartEnhancer contract, per-card shipping |
| [upsell.md](upsell.md) | Upsell context (`data-next-upsell-context`) integration |
| [examples.md](examples.md) | HTML examples — swap, select, qty controls, shipping, JSON render, upsell |

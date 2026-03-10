# Behavior Enhancers

Behavior enhancers live in `src/enhancers/behavior/`. These are **not data-attribute driven** — they are instantiated and controlled programmatically via JavaScript, typically through `window.next.*` SDK methods.

## Files

| File | Class | Access |
|---|---|---|
| `FomoPopupEnhancer.ts` | `FomoPopupEnhancer` | `new FomoPopupEnhancer()` |
| `SimpleExitIntentEnhancer.ts` | `ExitIntentEnhancer` | `new ExitIntentEnhancer()` |

---

## FomoPopupEnhancer

Shows social proof popups ("Jessica from Sydney just purchased: Premium Bundle") at regular intervals. Attaches to `document.body`.

### Usage

```js
const fomo = new FomoPopupEnhancer();
await fomo.initialize();

fomo.setup({
  items: [
    { text: 'Premium Bundle', image: 'https://...' }
  ],
  country: 'US',
  displayDuration: 5000,
  delayBetween: 12000,
  initialDelay: 3000,
});

fomo.start();
// Later:
fomo.stop();
```

### `setup(config)` Options

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `{ text, image }[]` | Campaign packages | Product items to cycle through |
| `customers` | `{ [country]: string[] }` | Built-in names | Customer names by country |
| `maxMobileShows` | `number` | `2` | Max popups on mobile before stopping |
| `displayDuration` | `number` | `5000` | ms to show each popup |
| `delayBetween` | `number` | `12000` | ms between popups |
| `initialDelay` | `number` | `0` | ms before first popup |
| `country` | `string` | Auto-detected | Country code for customer names (`US`, `AU`, `GB`, `CA`) |

### Default Items

On construction, `FomoPopupEnhancer` loads items from `campaignStore.data.packages` (first 5 packages with images). Falls back to a generic placeholder if no campaign packages are available.

### Country Auto-Detection

Detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`:
- `Australia/*` → `AU`
- `Europe/London`, `Europe/Dublin` → `GB`
- `America/Toronto`, `America/Vancouver` → `CA`
- Everything else → `US`

### Popup HTML Structure (injected into body)

```html
<div class="next-fomo-wrapper [next-fomo-show]">
  <div class="next-fomo-inner">
    <div class="next-fomo-item">
      <div class="next-fomo-thumb">
        <img class="next-fomo-image">
      </div>
      <div class="next-fomo-desc">
        <p>
          <span class="next-fomo-customer">Jessica from Sydney</span><br>
          Just purchased:<br>
          <span class="next-fomo-product">Premium Bundle</span><br>
          <span class="next-fomo-time">JUST NOW</span>
        </p>
      </div>
    </div>
  </div>
</div>
```

CSS is auto-injected into `<head>` on first use (`id="next-fomo-styles"`).

### Animation

- Default position: `bottom: 20px; left: 20px; transform: translateY(120%)` (off screen)
- Show: adds `next-fomo-show` class → `transform: translateY(0)` (CSS transition: `0.8s ease`)
- Hide: removes `next-fomo-show`

### Mobile Behavior

On mobile (viewport ≤ 768px), popup uses `width: calc(100% - 40px)` up to 320px max. After `maxMobileShows` popups, `stop()` is called automatically.

### Events Emitted

- `fomo:shown` — `{ customer, product, image }` — fired when popup content is updated (before animation)

### API Methods

| Method | Description |
|---|---|
| `initialize()` | Waits for DOM ready, injects styles |
| `setup(config)` | Configure items, timing, country |
| `start()` | Begin cycling popups |
| `stop()` | Stop and hide all popups |

---

## ExitIntentEnhancer

Shows a popup when the user is about to leave the page. On **desktop**: triggers when the mouse leaves the viewport upward (`mouseout` on `document.documentElement` with `clientY <= 10`). On **mobile**: optionally triggers when the user scrolls past 50% of the page.

### Usage

```js
const exitIntent = new ExitIntentEnhancer();
await exitIntent.initialize();

// Image-based popup
exitIntent.setup({
  image: 'https://example.com/exit-offer.png',
  action: () => { /* called on image/button click */ },
  maxTriggers: 1,
});

// Template-based popup
exitIntent.setup({
  template: 'exit-popup',  // matches <template data-template="exit-popup">
  showCloseButton: true,
  overlayClosable: true,
});

// Control
exitIntent.disable();
exitIntent.reset(); // clears session storage trigger count
```

### `setup(options)` Options

| Option | Type | Default | Description |
|---|---|---|---|
| `image` | `string` | — | URL of popup image (mutually exclusive with `template`) |
| `template` | `string` | — | Name of `<template data-template="name">` element |
| `action` | `() => void` | — | Callback on image click / button click / `custom` action |
| `disableOnMobile` | `boolean` | `true` | Disable trigger on mobile devices |
| `mobileScrollTrigger` | `boolean` | `false` | Enable scroll-based trigger on mobile |
| `maxTriggers` | `number` | `1` | Max times popup can be shown |
| `useSessionStorage` | `boolean` | `true` | Persist trigger count across page refreshes |
| `sessionStorageKey` | `string` | `"exit-intent-dismissed"` | Storage key |
| `overlayClosable` | `boolean` | `true` | Click overlay to close |
| `showCloseButton` | `boolean` | `false` | Show × button on popup |
| `imageClickable` | `boolean` | `true` | Image click fires action (image mode) |
| `actionButtonText` | `string` | — | Shows a CTA button instead of clickable image |

### Two Popup Modes

**Image mode** (`image` option):
- Centered image + optional action button
- Image click (or button click) fires `action` callback, emits `exit-intent:clicked`, closes popup
- Overlay click: emits `exit-intent:dismissed`, closes popup

**Template mode** (`template` option):
```html
<template data-template="exit-popup">
  <div class="my-popup">
    <h2>Wait! Special Offer</h2>
    <button data-exit-intent-action="close">No Thanks</button>
    <button data-exit-intent-action="apply-coupon" data-coupon-code="SAVE20">
      Apply 20% Off
    </button>
    <button data-exit-intent-action="custom">Custom Action</button>
  </div>
</template>
```

Template `data-exit-intent-action` values auto-wired:
- `"close"` — hides popup
- `"apply-coupon"` — applies `data-coupon-code` via `cartStore.applyCoupon()`, then closes
- `"custom"` — calls `action` callback, then closes

### Trigger Logic

`shouldTrigger()` returns false if:
- `isEnabled` is false
- Popup is already showing
- `triggerCount >= maxTriggers`
- Less than 30 seconds since last trigger (cooldown period)
- `disableOnMobile` and device is mobile

### Mobile Detection

Device is "mobile" if: `(ontouchstart OR maxTouchPoints > 0) AND (viewport < 768px OR mobile user agent)`.

### Session Storage

When `useSessionStorage` is true, trigger count and timestamp are saved to `sessionStorage` under `sessionStorageKey`. On `initialize()`, these values are restored. Use `reset()` to clear them.

### Animation

Popup appears with scale-up + fade-in (`0.3s ease`), disappears with scale-down + fade-out (`0.2s ease`).

### Events Emitted

| Event | When |
|---|---|
| `exit-intent:shown` | On popup show |
| `exit-intent:clicked` | On image/button click (image mode) |
| `exit-intent:dismissed` | On overlay click or Escape key |
| `exit-intent:closed` | On × button click |
| `exit-intent:action` | On template action buttons (`{ action, couponCode? }`) |

### API Methods

| Method | Description |
|---|---|
| `initialize()` | Loads session storage state, waits for DOM |
| `setup(options)` | Configure and arm event listeners |
| `disable()` | Remove event listeners, hide popup |
| `reset()` | Clear session storage trigger count |
| `hidePopup()` | Programmatically hide popup |

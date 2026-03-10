# UI Enhancers

UI enhancers live in `src/enhancers/ui/`. These provide generic interactive UI components not tied to cart/order business logic.

## Files

| File | Class | Attribute |
|---|---|---|
| `AccordionEnhancer.ts` | `AccordionEnhancer` | `data-next-accordion="id"` |
| `TooltipEnhancer.ts` | `TooltipEnhancer` | `data-next-tooltip="text"` |
| `ScrollHintEnhancer.ts` | `ScrollHintEnhancer` | `data-next-component="scroll-hint"` |

---

## AccordionEnhancer

**Attribute:** `data-next-accordion="<id>"` on a container element

Expandable/collapsible section with smooth height animation. Supports keyboard accessibility (Enter/Space), ARIA attributes, and multiple instances per page.

### Container Attributes

| Attribute | Description |
|---|---|
| `data-next-accordion` | (required) Unique ID for this accordion |
| `data-open-text` | Button text when accordion is open (default: `"Hide"`) |
| `data-close-text` | Button text when accordion is closed (default: `"Show"`) |
| `data-toggle-class` | CSS class added to container/panel when open (default: `"next-expanded"`) |
| `data-initial-state="open\|closed"` | Starting state (default: `"closed"`) |
| `data-animation-duration="300"` | Height transition duration in ms |

### Child Element Attributes (matched by accordion ID)

| Attribute | Role |
|---|---|
| `data-next-accordion-trigger="<id>"` | Clickable trigger(s) — toggle on click or Enter/Space |
| `data-next-accordion-panel="<id>"` | Collapsible panel(s) — animated height 0 ↔ auto |
| `data-next-accordion-text="<id>"` | Text element — swaps between open/close text |

### HTML Example

```html
<div data-next-accordion="order-summary"
     data-open-text="Hide Order Summary"
     data-close-text="Show Order Summary"
     data-initial-state="closed">

  <div data-next-accordion-trigger="order-summary" style="cursor:pointer">
    <span data-next-accordion-text="order-summary">Show Order Summary</span>
    <span>▼</span>
  </div>

  <div data-next-accordion-panel="order-summary">
    <!-- Panel content here -->
  </div>
</div>
```

### Initial State Detection

On init, the enhancer checks whether the panel or container already has the `toggleClass` applied. If so, it treats it as open regardless of `data-initial-state`. This allows server-side-rendered open state to be preserved.

### Animation

- **Open:** panel height animated from `0px` → measured `auto` height → then set to `auto` (for responsive resize)
- **Close:** panel height animated from current height → `0px`
- Uses `requestAnimationFrame` + `setTimeout` to ensure CSS transitions run correctly

### CSS Classes

The `data-toggle-class` (default `next-expanded`) is added to both the container element and the panel element when open, removed when closed.

### Accessibility

- Trigger elements get `tabindex="0"` if not already focusable
- `aria-expanded="true/false"` on triggers
- `aria-controls` on triggers pointing to panel ID
- `aria-labelledby` on panels

### Events Emitted

| Event | Payload |
|---|---|
| `accordion:toggled` | `{ id, isOpen, element }` |
| `accordion:opened` | `{ id, element }` |
| `accordion:closed` | `{ id, element }` |

### Public API (on the enhancer instance)

- `openAccordionById(id)` — programmatically open
- `closeAccordionById(id)` — programmatically close
- `toggleAccordionById(id)` — toggle
- `getAccordionState(id)` — returns `boolean | null`
- `getAllAccordions()` — returns array of IDs

---

## TooltipEnhancer

**Attribute:** `data-next-tooltip="<text>"` on any element

Adds a floating tooltip popup to an element. Uses **Floating UI** (`@floating-ui/dom`) for smart positioning with flip/shift/arrow middleware. Styles are auto-injected into `<head>` once (singleton pattern).

### Attributes

| Attribute | Description |
|---|---|
| `data-next-tooltip` | (required) Tooltip text content |
| `data-next-tooltip-placement` | `top` (default), `bottom`, `left`, `right` |
| `data-next-tooltip-offset` | Distance from element in px (default: `8`) |
| `data-next-tooltip-delay` | Show delay in ms (default: `500`) |
| `data-next-tooltip-max-width` | Max tooltip width (default: `"200px"`) |
| `data-next-tooltip-class` | Additional CSS class on tooltip element |

### HTML Example

```html
<span data-next-tooltip="This field is required"
      data-next-tooltip-placement="top"
      data-next-tooltip-delay="300">
  ?
</span>
```

### Behavior

- **mouseenter** → schedules show after `delay` ms
- **mouseleave** → schedules hide after 150ms (allows moving mouse to tooltip)
- Hovering over tooltip itself cancels the hide timer
- **focus** / **blur** → same as mouseenter/mouseleave (keyboard accessible)
- **touchstart** → toggles tooltip on/off
- **Escape key** → hides tooltip

### Tooltip Structure

```html
<div class="next-tooltip" role="tooltip" data-placement="top">
  <div class="next-tooltip__content">Tooltip text</div>
  <div class="next-tooltip__arrow"></div>
</div>
```

Appended to `document.body`. Positioned using `position: fixed` via Floating UI.

### CSS Classes on Tooltip

| Class | Purpose |
|---|---|
| `next-tooltip` | Base styles (injected) |
| `next-tooltip--visible` | Shown state (opacity 1, scale 1) |
| `next-tooltip--light` | Light theme variant |
| `next-tooltip--error` | Red variant |
| `next-tooltip--success` | Green variant |
| `next-tooltip--warning` | Yellow variant |
| `next-tooltip--large` / `--small` | Size variants |

Apply variant classes via `data-next-tooltip-class="next-tooltip--light"`.

### ARIA

- Target element gets `aria-describedby` pointing to tooltip ID while tooltip is visible

---

## ScrollHintEnhancer

**Attribute:** `data-next-component="scroll-hint"` on the hint element itself

Shows/hides a visual scroll indicator based on whether a nearby scrollable container has overflow content and whether the user is at the top of it.

### Attributes

| Attribute | Description |
|---|---|
| `data-next-component="scroll-hint"` | (required) Marks the hint element |
| `data-next-scroll-target` | CSS selector for the scrollable container |
| `data-next-scroll-threshold` | Pixels from top before hint hides (default: `5`) |

### HTML Example

```html
<div class="cart-wrapper">
  <ul data-next-cart-items class="cart-items__list">
    <!-- cart items rendered here -->
  </ul>
  <div data-next-component="scroll-hint"
       class="scroll-hint cart-items__scroll-hint--active">
    Scroll for more items ↓
  </div>
</div>
```

### Scroll Target Auto-Discovery

If `data-next-scroll-target` is not set, the enhancer walks up the DOM and searches siblings/ancestors for elements matching (in priority order):
1. `.cart-items__list`
2. `[data-next-cart-items]`
3. `[data-next-order-items]`
4. `.order-items__list`
5. `.scrollable-content`

If found inside `.order-summary`, `.cart-items`, or `.modal-content`, those containers are also searched.

### Behavior

- **Active** (`cart-items__scroll-hint--active` class present): content is scrollable AND user is at the top (`scrollTop <= threshold`)
- **Inactive** (class removed): content is not scrollable, OR user has scrolled down past threshold
- Listens to `scroll` events on the target (throttled at 16ms / ~60fps)
- Listens to `resize` events on window (debounced at 100ms)
- Uses `MutationObserver` to detect when items are added/removed (content height changes)
- All updates use `requestAnimationFrame` for batching

### CSS Classes Managed

- `cart-items__scroll-hint--active` — present when hint should be visible (class name is hardcoded)

### Events Emitted

- `scroll-hint:updated` — `{ isVisible, scrollTop, scrollHeight, clientHeight }`

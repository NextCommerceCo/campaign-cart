# Profile Enhancers

Profile enhancers live in `src/enhancers/profile/`. They allow users to switch between different pricing profiles (e.g., wholesale, VIP, regional pricing) on the page.

## Files

| File | Classes |
|---|---|
| `ProfileSwitcherEnhancer.ts` | `ProfileSwitcherEnhancer`, `ProfileSelectorEnhancer` |

---

## ProfileSwitcherEnhancer

**Attribute:** `data-next-profile="<profileId>"` on any clickable element (button, div, etc.)

Switches the active pricing profile on click. Uses `ProfileManager.applyProfile()` which updates `profileStore` and causes all price display enhancers to re-render with the new pricing.

### Attributes

| Attribute | Description |
|---|---|
| `data-next-profile` | (required) Profile ID to activate |
| `data-next-clear-cart="true"` | Clears cart contents before applying profile |
| `data-next-preserve-quantities="false"` | Resets all item quantities to 1 when switching |
| `data-next-active-text` | Text content when this profile is active |
| `data-next-inactive-text` | Text content when this profile is inactive |

### HTML Example

```html
<!-- Simple toggle button -->
<button data-next-profile="wholesale"
        data-next-active-text="Remove Wholesale Pricing"
        data-next-inactive-text="Apply Wholesale Pricing">
  Apply Wholesale Pricing
</button>

<!-- With cart clear -->
<button data-next-profile="vip" data-next-clear-cart="true">
  Switch to VIP Pricing
</button>
```

### Behavior

- Calls `ProfileManager.getInstance().applyProfile(profileId, { clearCart, preserveQuantities })`
- If clicked when the profile is already active, does nothing (no-op)
- Shows `next-loading` class + `aria-busy="true"` during the API call
- Listens to `profile:applied` and `profile:reverted` events to sync active state across all switchers on the page

### CSS Classes Managed

| Class | When |
|---|---|
| `next-profile-switcher` | Always present (added on init) |
| `next-profile-active` | When this profile is the currently active profile |
| `next-loading` | During profile switch API call |

### Events Listened

- `profile:applied` — updates active state
- `profile:reverted` — updates active state

### Events Emitted (via EventBus)

- `action:success` — after successful profile switch (`{ action: 'profile-switch', data: { profileId } }`)
- `action:failed` — on error

### ARIA

- `aria-pressed="true/false"` — reflects whether this profile is active
- `aria-busy="true/false"` — reflects loading state

---

## ProfileSelectorEnhancer

**Attribute:** `data-next-profile-selector` on a `<select>` element

Dropdown version of `ProfileSwitcherEnhancer`. Selecting an option applies that profile ID; selecting the empty option reverts to default pricing.

### Attributes

| Attribute | Description |
|---|---|
| `data-next-profile-selector` | (required, on `<select>`) Marks element as profile selector |
| `data-next-auto-populate="true"` | Populates `<option>` elements from `profileStore.getAllProfiles()` |
| `data-next-clear-cart` / `data-next-preserve-quantities` | Same behavior as ProfileSwitcherEnhancer |

### HTML Example

```html
<!-- Manual options -->
<select data-next-profile-selector>
  <option value="">Regular Pricing</option>
  <option value="wholesale">Wholesale</option>
  <option value="vip">VIP Members</option>
</select>

<!-- Auto-populated from store -->
<select data-next-profile-selector data-next-auto-populate="true"></select>
```

### Behavior

- On `change` event: if value is non-empty, calls `ProfileManager.applyProfile(value, ...)`
- If value is empty, calls `ProfileManager.revertProfile()`
- On error during profile switch, reverts select back to previously active profile value
- Listens to `profile:applied` and `profile:reverted` to keep select value in sync

### CSS Classes Managed

- `next-profile-selector` — always present on the select element

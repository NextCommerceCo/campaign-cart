# Errors

## `Element validation failed: missing required attribute`

| | |
|---|---|
| Type | Fatal |
| Cause | The container element does not have `data-next-package-selector`. `AttributeScanner` matched the element by a different rule, or the attribute was removed before the enhancer initialized. |

**Fix:**

Ensure the container element has `data-next-package-selector` as a bare attribute (no value required):

```html
<div data-next-package-selector data-next-selector-id="main-selector">
  ...
</div>
```

If the attribute is present and the error still fires, check that no other script is removing it before the SDK initializes.

---

## `Selector card is missing data-next-package-id` *(not thrown — logged as warn)*

| | |
|---|---|
| Type | Recoverable |
| Cause | A `[data-next-selector-card]` element was found but has no `data-next-package-id` attribute. |

**Fix:**

Add the attribute to every card:

```html
<div data-next-selector-card data-next-package-id="101">...</div>
```

The selector continues to work with the cards that do have valid IDs.

---

## `Invalid data-next-package-id on selector card <value>` *(not thrown — logged as warn)*

| | |
|---|---|
| Type | Recoverable |
| Cause | `data-next-package-id` is present but its value is not a valid integer (e.g., an empty string, a non-numeric string, or a float). |

**Fix:**

Use a valid integer package `ref_id`:

```html
<!-- wrong -->
<div data-next-selector-card data-next-package-id="pkg-101">...</div>

<!-- correct -->
<div data-next-selector-card data-next-package-id="101">...</div>
```

---

## `Invalid JSON in data-next-packages, ignoring auto-render <value>` *(not thrown — logged as warn)*

| | |
|---|---|
| Type | Recoverable |
| Cause | `data-next-packages` contains a string that cannot be parsed as JSON. Auto-render is disabled; no cards are generated. |

**Fix:**

Validate the JSON value. It must be a valid JSON array:

```html
<!-- wrong -->
data-next-packages="[{packageId: 101}]"

<!-- correct -->
data-next-packages='[{"packageId": 101}]'
```

---

## `Failed to fetch price for package <packageId>` *(not thrown — logged as warn)*

| | |
|---|---|
| Type | Recoverable |
| Cause | The bundle price API returned an error or the fetch threw (e.g., network failure, invalid package ID, API not reachable). |

**Fix:**

1. Open DevTools → Network and find the failed bundle price API request.
2. Check the response status and error body.
3. Verify the `packageId` exists in the campaign and is accessible under the current store/currency.
4. If prices are expected in a specific currency, verify the currency value in `campaignStore.data.currency` is one the API accepts.

Price slots remain blank until the fetch succeeds. All other selector functionality (selection, cart write) continues working.

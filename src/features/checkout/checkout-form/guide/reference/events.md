---
title: "Features/Checkout/Checkout Form/Events"
group: "Features"
category: "Checkout Form"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `checkout:form-initialized`

**When:** The checkout form finished wiring up its fields, validation, and payment.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `form` | `HTMLFormElement` | The form element that was initialized. |

---

## `checkout:spreedly-ready`

**When:** The Spreedly card iframe is ready to accept card details.

---

## `checkout:location-fields-shown`

**When:** The shipping address fields were revealed — the visitor moved past the collapsed autocomplete input, so state, city, and postcode are now on screen. Also dispatched as a DOM `CustomEvent` on `document`, for code that listens outside the SDK: `document.addEventListener('checkout:location-fields-shown', …)`.

---

## `checkout:billing-location-fields-shown`

**When:** The billing address fields were revealed. Also dispatched as a DOM `CustomEvent`.

---

## `checkout:started`

**When:** The visitor submitted the checkout form and the order request is about to go out. Fires before the payment call, so the order does not exist yet.

---

## `payment:tokenized`

**When:** Card details were exchanged for a payment token. The raw card number never reaches SDK code — only this token does.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `token` | `string` | The payment token to submit with the order. |
| `pmData` | `any` | Payment method metadata returned with the token, e.g. card brand and last four. |
| `paymentMethod` | `string` | Which payment method produced the token. |

---

## `payment:error`

**When:** Payment failed. Fires both for card-field errors before submission and for a declined order attempt.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `message` | `string` | The failure, already worded for display to the visitor. When the payment form reported several problems at once they arrive joined into this one string, in the order the form reported them. |
| `code?` | `string` | The gateway's response code, when the failure came back from an order attempt. |
| `details?` | `unknown` | The raw error response, for logging. Absent for card-field errors. |

**Example:**

```json
{ "message": "Your card was declined.", "code": "gateway_declined" }
```

---

## `order:redirect-missing`

**When:** The order succeeded but carried no redirect URL, so the SDK could not send the visitor onward. Handle this to avoid stranding them on the checkout page.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `order` | `any` | The created order, as returned by the API. |

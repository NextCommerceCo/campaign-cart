# Use Cases

## Single fixed upsell offer

> Effort: lightweight

**When:** After checkout, a page offers one specific product (e.g., a warranty or a complementary item) at a discounted price. The offer is the same for every customer and does not vary.

**Why this enhancer:** A fixed `data-next-package-id` is all that is needed. No selector, no extra state — the enhancer resolves the package directly from the attribute.

**Watch out for:** Make sure the package ID matches a package that exists in the campaign and is set up to support post-purchase upsells on the server side. A wrong package ID will cause the API call to fail.

---

## Upsell with variant selection (quantity or product choice)

> Effort: moderate

**When:** The upsell page lets the customer choose between two or three options — for example, buy 1 bottle for $29 or 3 bottles for $69. Only one button should trigger the submission.

**Why this enhancer:** Pair a `PackageSelectorEnhancer` with `data-next-upsell-context` (which disables cart writes) and link it to this enhancer via a shared `data-next-selector-id`. The selector handles the visual choice; this enhancer reads the selection and submits it.

**Watch out for:** Do not set `data-next-package-id` on the button when also using `data-next-selector-id`. If both are present, the selector wins, but the intent is ambiguous. Use one or the other.

---

## Multi-step upsell funnel

> Effort: moderate

**When:** The campaign has two or three sequential upsell pages (e.g., upsell-1 → upsell-2 → receipt). Each page has its own accept button with a `data-next-url` pointing to the next page.

**Why this enhancer:** The enhancer navigates to `data-next-url` after a successful submit. Chain pages by setting the URL on each button. The `orderStore` persists across pages (sessionStorage) so the order context is carried through.

**Watch out for:** Each accept button emits `upsell:accepted` with the specific package it submitted. If you are tracking this in analytics, make sure each page's package ID is distinct so you can attribute revenue correctly.

---

## Programmatic submission (no button click)

> Effort: lightweight

**When:** You want to submit the upsell from JavaScript — for example, after a countdown expires or a payment confirmation event fires.

**Why this enhancer:** Call `element.triggerAcceptUpsell()` where `element` is the DOM element the enhancer is bound to. This goes through the same duplicate check and redirect logic as a manual click.

**Watch out for:** `triggerAcceptUpsell()` is only available after `initialize()` has resolved. Call it after `DOMContentLoaded` or in response to a known initialization event.

---

## When NOT to use this

### Adding an item to the cart before checkout

**Why not:** This enhancer writes to the **order** via the post-purchase API. It does not touch the cart store. Using it before checkout will fail because there is no order in `orderStore` yet.

**Use instead:** `AddToCartEnhancer` — writes to the cart store and is designed for the pre-checkout flow.

### Displaying or tracking the upsell offer

**Why not:** This enhancer only handles the accept action. It does not render the offer, show pricing, or track that the user viewed the page.

**Use instead:** `UpsellEnhancer` — handles offer display and view tracking. Use both together: `UpsellEnhancer` for the offer card, `AcceptUpsellEnhancer` for the accept button.

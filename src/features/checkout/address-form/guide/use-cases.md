---
title: "Features/Checkout/Address Form/Use Cases"
group: "Features"
category: "Address Form"
---

# Use Cases

## Selling into more than one country from one page

> Effort: lightweight

**When:** A campaign ships to several countries and the page has one address block written
for whichever market it was built in first.

**Why this enhancer:** The alternative is a field set per market, kept in sync by hand,
where "we do not ship there yet" and "nobody has written those fields yet" look the same
from the outside.

**Watch out for:** The country dropdown is still filled from the campaign's shipping
countries, so a country the campaign does not ship to never appears and its layout is
never asked for.

---

## A market whose address does not fit the US shape

> Effort: lightweight

**When:** Orders from one country keep arriving with the state field holding something
that is not a state, or with a postcode in a field that country does not use.

**Why this enhancer:** The field is not collected at all where the country does not use
it, so there is nothing to put the wrong value into.

**Watch out for:** Values already stored against the old field set do not move. This
changes what new orders collect.

---

## When NOT to use this

### A page that collects one country's addresses and always will

**Why not:** Fields written into the page load with it and cost no request. This block
waits for a layout before it can build anything.

**Use instead:** Plain `data-next-checkout-field` inputs, as
[checkout-form](../../checkout-form/guide/overview.md) documents.

### A billing address

**Why not:** The checkout form builds the billing address by copying the shipping one, so
a second block would put two sets of `billing-*` fields on the page.

**Use instead:** `data-next-component="billing-form"`, which the checkout form fills.

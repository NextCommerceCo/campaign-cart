---
title: "Features/Checkout/Address Form/Glossary"
group: "Features"
category: "Address Form"
---

# Glossary

## Field set

Which pieces of an address a country asks for. Germany's has no state in it; Japan's has
no second name line. A field outside a country's set is not shown, not required and not
collected.

---

## Layout

The field set plus the order and grouping the country writes it in. The United States puts
city, state and postcode on one row; Japan starts the whole form with the postcode.

---

## Fallback layout

The generic field set served for a country that has no rules of its own. It is an answer,
not an error: a visitor from that country still has to be able to check out.

---

## Subdivision

The administrative area inside a country — a state, province, prefecture, county or
emirate. This SDK collects it in the `province` field whatever the country calls it.

---
title: "Features/Behavior/FOMO Popup/Glossary"
group: "Features"
category: "FOMO Popup"
---

# Glossary

Terms used across this feature's guide.

## Customer line

One entry from the `customers` option — the person a notification names, written
as a whole phrase such as `Sarah from Denver, CO`. Lines are grouped by country
code so the names suit the visitor's region. They are content you supply, not
people who bought anything; if a country has no list and no fallback list applies,
a notification reads "Someone".

---

## Detected country

The country code the feature uses to pick a customer list, guessed from the
browser's timezone. Australian timezones map to `AU`, London and Dublin to `GB`,
Toronto and Vancouver to `CA`, and everything else to `US` — so `US` is the
fallback for every unrecognised region, and its list is also used when the detected
country has no list of its own.

---

## Mobile show cap

The maximum number of notifications a visitor on a screen of 768px or less will
see in one page view, set by `maxMobileShows` and defaulting to 2. It exists
because the notification is fixed to the bottom of the viewport, where on a phone
it competes with the buy button. Reaching the cap ends the rotation for that page
view.

---

## Social proof notification

The small card this feature shows: a product image, a customer line, and the words
"Just purchased". Its purpose is to tell a visitor that other people are buying, so
a quiet page does not read as an abandoned one. In this SDK the content is
generated from the options passed to `next.fomo()` — it is not a record of a real
order.

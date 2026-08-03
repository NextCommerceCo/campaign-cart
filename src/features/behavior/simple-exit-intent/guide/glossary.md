---
title: "Features/Behavior/Simple Exit Intent/Glossary"
group: "Features"
category: "Simple Exit Intent"
---

# Glossary

Terms used across this feature's guide.

## Accept action

The control in the popup that means "yes, I want this". In an image popup it is the
image itself, or the button created by `actionButtonText`, and it reports
`exit-intent:clicked`. In a template popup it is an element carrying
`data-exit-intent-action`, and it reports `exit-intent:action`. Anything else the
visitor does — close button, backdrop, Escape — is a rejection, reported as
`exit-intent:closed` or `exit-intent:dismissed`.

---

## Cooldown period

A fixed 30-second wait after the popup has been triggered, during which no exit
gesture will show it again. It is not configurable. Together with `maxTriggers` it
is why a second exit gesture moments later does nothing.

---

## Exit intent

The guess that a visitor is about to leave the page. On desktop the signal is the
pointer leaving the document within 10px of the top edge, on its way to the address
bar or the tabs. On a touch device there is no pointer, so the substitute signal is
scroll depth — half the page or more — which is a much weaker guess and is
therefore opt-in.

---

## Trigger count

How many times the popup has been shown, compared against `maxTriggers` (default
1) before every showing. With `useSessionStorage` on, the count is written to
session storage under `next-exit-intent-dismissed` so a reload cannot earn the
visitor a second showing. It resets when the browser session ends.

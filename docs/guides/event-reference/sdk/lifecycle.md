---
title: 'SDK lifecycle'
group: 'Event Reference/SDK'
---

# SDK lifecycle

![SDK lifecycle: starting, ready and failed, with the events each step sends](sdk-lifecycle.svg)

| State      | Means                                                     |
| ---------- | --------------------------------------------------------- |
| `starting` | The SDK is loading the campaign                           |
| `ready`    | The campaign is in and the page shows its values          |
| `failed`   | The campaign could not load and the tab has no copy of it |

| From       | What happens                                                                    | To       | Events                                         |
| ---------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------- |
| `starting` | The campaign is in, from the tab's copy or from the API                         | `ready`  | `sdk.ready`, once; late listeners get it too   |
| `starting` | The campaign cannot load and the tab has no copy                                | `failed` | `sdk.error` (`action: 'load'`); no `sdk.ready` |
| `ready`    | An action fails: `calculate`, `quote`, `coupon`, `order`, `upsell` or `storage` | `ready`  | `sdk.error`                                    |

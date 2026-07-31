---
title: "Features/Behavior/Simple Exit Intent/Logs"
group: "Features"
category: "Simple Exit Intent"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `simple-exit-intent` can print, under the logger prefix `ExitIntentEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Error

Something did not work. Each of these means a visitor saw the wrong thing, or nothing at all.

| Message | Source | Extra context |
|---|---|---|
| `Exit intent requires either an image URL or a template name` | `simple-exit-intent.enhancer.ts:84` | — |
| `Exit intent template not found: <template data-template="{templateName}">` | `simple-exit-intent.enhancer.ts:108` | — |
| `Failed to load exit intent image:` | `simple-exit-intent.enhancer.ts:444` | yes |
| `Exit intent action failed:` | `simple-exit-intent.enhancer.ts:482` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Failed to load session storage data:` | `simple-exit-intent.enhancer.ts:53` | yes |
| `Exit intent disabled on mobile device` | `simple-exit-intent.enhancer.ts:115` | — |
| `Simple exit intent setup complete` | `simple-exit-intent.enhancer.ts:121` | — |
| `Failed to clear session storage:` | `simple-exit-intent.enhancer.ts:139` | yes |
| `Failed to save to session storage:` | `simple-exit-intent.enhancer.ts:222` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.

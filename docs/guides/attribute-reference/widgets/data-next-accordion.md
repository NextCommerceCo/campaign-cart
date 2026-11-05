---
title: 'data-next-accordion'
group: 'Attribute Reference/Widgets'
order: 902
---

# data-next-accordion

A section that opens and closes. Triggers, panels and texts are matched to the accordion by the
same id.

```html
<div data-next-accordion="summary">
  <button data-next-accordion-trigger="summary">
    <span data-next-accordion-text="summary">Show</span> order summary
  </button>
  <div data-next-accordion-panel="summary">…</div>
</div>
```

## Attributes

| Attribute                            | Means                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `data-next-accordion="<id>"`         | The accordion                                                                              |
| `data-next-accordion-trigger="<id>"` | Inside it: toggles it on click, Enter or Space                                             |
| `data-next-accordion-panel="<id>"`   | Inside it: what opens and closes; its height animates                                      |
| `data-next-accordion-text="<id>"`    | Inside it: text set to `data-open-text` when open and `data-close-text` when closed        |
| `data-initial-state="open"`          | Start open. It also starts open when the accordion or a panel already has the toggle class |
| `data-toggle-class`                  | The class set while open. Default `next-expanded`                                          |
| `data-open-text`, `data-close-text`  | Default `Hide` and `Show`                                                                  |
| `data-animation-duration`            | Milliseconds of the opening animation. Default `300`                                       |

## Set by the SDK

| On                       | Set                                                                         |
| ------------------------ | --------------------------------------------------------------------------- |
| The accordion and panels | The toggle class while open; a panel's `height` (`0px` closed, `auto` open) |
| Panels                   | An `id`, when they have none (`<id>-content`)                               |
| Triggers                 | `role="button"`, `tabindex="0"`, `aria-controls`, `aria-expanded`           |

## 0.4.x

`next.on('accordion:opened' | 'accordion:closed', fn)` still fire with `{ id, element }`, and
`accordion:toggled` with `{ id, isOpen, element }`.

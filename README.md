# NEXT Campaign SDK

One headless **Engine** owns all campaign state (Action → State → Event). DOM bindings,
analytics and debug tools are subscribers to its events. See
[docs/architecture/design.md](docs/architecture/design.md) and
[docs/architecture/redesign-review.md](docs/architecture/redesign-review.md).

```html
<script type="module" src=".../dist/loader.js" data-campaign="pk_live_…" data-funnel="my-funnel"></script>
```

Old pages keep working: `window.nextConfig.apiKey`, `<meta name="next-api-key">`,
`<meta name="next-funnel">`, `window.nextReady` and `next:initialized` are still read.

| Command | |
|---|---|
| `npm test` | unit tests (the Engine suite runs in plain Node) |
| `npm run typecheck` | TypeScript |
| `npm run build` | build to `dist/` (CI artifact, not committed) and fail if a chunk is over its gzip budget |

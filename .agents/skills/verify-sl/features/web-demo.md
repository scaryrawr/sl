# Web demo surfaces

The demo site renders the wasm train in two user surfaces - the interactive home page form and the query-param iframe embed - and must fall back to a static train with an accessibility note when the visitor prefers reduced motion.

## Sub-features

- `web-form` - home page: checkboxes, train-type select, messages textarea drive the live terminal.
- `web-embed` - `/sl/embed.html` configured entirely by query params (`trainType`, `accident`, `fly`, `smoke`, `messages`, colors).
- `web-reduced-motion` - `prefers-reduced-motion: reduce` shows a centered static train + `Static view - Animation disabled due to reduced motion preference`.
- `web-clock` - animation advances exactly one column per ~60 ms tick (harness seizes the clock for determinism).

## How to get to it (user POV)

- Browse to `/sl/` (served by `apps/page/playwright-server.mjs` on :4173, or `bun run dev` on :8080 for development).
- Embed `/sl/embed.html?...` in any page.
- Enable "reduce motion" in the OS accessibility settings.

## Driving it with verify-sl scripts

Preconditions: `bun run build:page` current; chromium complete.

- **Embed.** `bun .agents/skills/verify-sl/scripts/web-verify.mjs embed` - art, both car labels, >20 distinct pumped frames, no `Failed to load animation`.
- **Variants.** `embed-logo`, `embed-accident`, `embed-fly` as in accident/train-animation maps.
- **Form.** `home-form` - select default `d51`, typed messages persist in `#messages-textarea`, art animates, typed labels reach the cars.
- **Reduced motion.** `reduced-motion` - static locomotive plus the accessibility note render with no pumping.
- **Proof.** Screenshots (`terminal-step*.png`) and `frames.json` per run under `evidence/`.

## Gotchas

- `reducedMotion` is a **context** option; setting it in launch options silently does nothing.
- A stale warm server on :4173 serves an old `lib/` build - rebuild then restart it, or let web-verify start its own.
- The service worker caches assets (offline is a feature); fresh verification relies on the server-owned `lib/` on disk.
- `addInitScript` patching must not run for `home-form` (the form needs its real timers).
- Console warning "using deprecated parameters for the initialization function" is known noise.

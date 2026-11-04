---
name: verify-sl
description: Drive the real sl app and prove its protected behavior - train animations (D51/C51/logo/fly), accident mode (people crying for help), and passenger-car labels - on both surfaces: the CLI/TUI binary (asciinema PTY captures with golden frames + invariants) and the web demo (Playwright chromium with per-step frame sampling). Use when changing libsl sprites/rendering, the websl wasm bridge, the CLI flags, or the demo site, or when asked to verify or regression-test that the trains still work.
---

# Verify sl

One skill drives both surfaces because they render the same three protected things
from one source of truth (`libraries/libsl`):

- **CLI drive** - asciinema PTY capture of `target/release/sl` -> reconstructed terminal grids -> golden frames + behavioral invariants.
- **Web drive** - Playwright chromium against the built demo site, with the animation clock seized so every frame is deterministic.

Always run from the **repo root** (the harnesses resolve paths relative to the skill directory).

## Launch

There is no long-lived process for the CLI: each drive is its own short PTY run, and the web harness starts and stops its own server.

```bash
# CLI (one-time): build the binary
cargo build --release --manifest-path apps/sl/Cargo.toml
# Web (one-time), in order:
export PATH="$HOME/.cargo/bin:$PATH"   # required if Homebrew rustc also exists; wasm-pack picks rustc from PATH
bun install
bun run build:websl
bun run build:page
bun run --cwd apps/page playwright:install   # downloads chromium + chromium-headless-shell
```

Machine quirk seen here: `playwright:install` downloads complete but Playwright's own unzip stalls forever on this machine. The zips survive under `$TMPDIR/playwright-download-*/`; finish manually:

```bash
ditto -x -k "$TMPDIR"/playwright-download-*/playwright-download-chromium-mac15-arm64-1217.zip \
  ~/Library/Caches/ms-playwright/chromium-1217
# same pattern for chromium-headless-shell-1217
```

Ready means: `scripts/doctor.sh` passes, and `scripts/web-verify.mjs embed` renders (a headless-shell error means the browser binaries are missing/incomplete).

Teardown: CLI runs self-terminate; `web-verify.mjs` kills only the server it started.

## Doctor

```bash
.agents/skills/verify-sl/scripts/doctor.sh
```

Read-only: binary present and `-V`-able, asciinema/script/python3/bun installed, page + wasm built, chromium complete, and whether port 4173 is already answered by someone else's server. Run it first whenever a drive misbehaves.

## Drive

### CLI (scenarios: `d51`, `d51-accident`, `c51`, `logo`, `fly`)

```bash
cast=$(.agents/skills/verify-sl/scripts/record-cast.sh d51)          # prints the evidence dir
python3 .agents/skills/verify-sl/scripts/check-invariants.py "$cast/sl.cast" --scenario d51
python3 .agents/skills/verify-sl/scripts/extract-frames.py "$cast/sl.cast" --golden .agents/skills/verify-sl/goldens/d51.json
```

How it works: `run.sl` pipes `fixtures/cars.txt` into the binary with stdin forced off-tty by `script`, so car labels are deterministic regardless of the working directory; asciinema records the PTY. Asciicast events are transport chunks (a draw can span events, and chunking shifts between runs), so `castgrid.py` samples at fixed **cumulative output-byte offsets** - identical grids regardless of chunking - and reconstructs full screens (sl only emits cursor-move, NUL-padded car writes, printable text, and erase-display, which the mini-grid understands). Goldens are size-bound: always record at the default `--term 80x24`, or pass the same `--term` to both record and golden flows.

### Web (scenarios: `embed`, `embed-logo`, `embed-accident`, `embed-fly`, `reduced-motion`, `home-form`)

```bash
bun .agents/skills/verify-sl/scripts/web-verify.mjs embed
```

The embedded page is configured purely by URL query params (`trainType`, `accident`, `fly`, `smoke`, `messages` as an encoded JSON array), so every check drives the real user surface. Determinism: `stepPatch` (installed before the bundle loads) queues the app's `requestAnimationFrame` callbacks (the 60 ms `setTimeout` that only reschedules is executed synchronously), so `__slPump(n)` advances exactly n train columns - no timing races. `reduced-motion` uses the chromium context option `reducedMotion: "reduce"` (launch options do NOT apply it) to verify the static accessibility fallback. `home-form` exercises the interactive form: train-type select, messages textarea, checkboxes.

## Evidence

Everything lands in `.agents/skills/verify-sl/evidence/<timestamp>-<scenario>/` (git-ignored; goldens in `goldens/` ARE committed):

- CLI: `sl.cast` (full recording), `run.sl` (exact command driven)
- Web: `frames.json` (sampled grids, nbsp normalized to spaces), `terminal-step*.png` screenshots

Proof standards:
- Exercise the real user path: the CLI binary through a PTY (never libsl unit functions), the built site through a browser (never wasm setters).
- Capture the motion, not just a screen: CLI goldens diff ~12 evenly-spread full-screen frames (fixed byte-offset sampling) across a complete run; web asserts >20 distinct frames.
- Verify the effects, not just the art: car labels must render, scroll right-to-left, and the train must exit and clear the screen; accident mode must show `Help!` and non-accident runs must not (`(O)` alone is not an accident marker - it is part of the logo sprite).
- No mocks anywhere; wasm and sprites are the shipped ones.

Regenerating goldens after an intentional art change: rerun `extract-frames.py ... --golden ... --update` for each size used, and commit the `goldens/` diff together with the sprite change.

## Cleanup

- CLI runs and `web-verify.mjs` exit on their own; cleanup is nothing to kill.
- If a killed run strands the verification server: `pkill -f playwright-server.mjs` (only your own; doctor warns when 4173 was already warm so you don't kill someone else's).
- Cleanup never touches `evidence/` or `goldens/`.

## Gotchas (proven the hard way)

- **Type into the messages textarea with `pressSequentially`, not `fill()`**: with a programmatic fill the labels never reached the animation in testing, while real keystrokes worked. After a messages change the running train does not redraw with the new labels - toggle a checkbox (fly) to restart the animation so the labels ride the next train in (the effect restart preserves the off-screen x position).
- Viewports are large: the embed grid is ~164 columns, so the short logo train needs ~260 pumps and full trains ~320 before trailing cars appear.
- `Help!` is the accident marker; `(O)` and `\O/` occur inside train art.
- The wasm deprecation warning ("pass a single object instead") in console is noise, not failure.
- `bunx playwright install` hangs during extraction on this machine (see Launch for the ditto workaround); stale `~/Library/Caches/ms-playwright/__dirlock` blocks retries - remove it after killing a stuck install.

## Helpers

All in `scripts/`, invoked as shown above: `doctor.sh`, `record-cast.sh`, `castgrid.py` (library), `extract-frames.py`, `check-invariants.py`, `web-verify.mjs`. Feature-by-feature journeys live in `features/`.

# SL (Steam Locomotive)

Monorepo for the `sl` terminal train. Rust workspace plus a Bun workspace for the demo site.

## Packages

- `libraries/libsl` — core train frames/rendering (`TrainFrames`); the heart of the project, keep changes minimal
- `apps/sl` — the `sl` CLI (clap + crossterm); see `apps/sl/AGENTS.md` for the `build.rs`/`src/cli.rs` `include!`
  constraint
- `libraries/websl` — wasm-bindgen bindings; built with wasm-pack, output in `libraries/websl/pkg/` (generated, not a
  Bun workspace member)
- `apps/page` — Preact demo site (Bun workspace member); `apps/page/src/websl.ts` is a hand-written adapter over the
  generated `pkg/` bindings

## Commands (from repo root unless noted)

- Setup: `bun install`, then `bun run setup` (installs wasm tooling; build/test scripts re-check prereqs and print this
  command when missing)
- Rust build/test: `cargo build --release`, `cargo test` (workspace root covers all three crates); `bun run test:libsl`
  runs only libsl
- WASM: `bun run build:websl`, `bun run test:websl` (headless Firefox via wasm-pack)
- Site: `bun run dev` / `bun run build` / `bun run test:page`; e2e: `bun run test:page:e2e` (Playwright chromium, tests
  in `apps/page/playwright/`)
- Lint/format/typecheck: `bun run lint`, `bun run format` (or `bun run format:rust` for the Rust workspace),
  `bun run typecheck`
- Format gate: `bun run format:check` (`bun fmt --check` plus `cargo fmt --all --check`) is a CI step in
  `.github/workflows/lint.yml`, so a pull request cannot merge with unformatted files
- CLI smoke test: `cargo run -- -h` and `cargo run -- -V` (CI only checks `-h`/`-V`, not animation)

## Stop hook

- `scripts/stop-check.ts` holds the checks for every agent: `cargo clippy --workspace --all-targets -- -D warnings`
  (build errors + clippy warnings), `bunx oxlint . --format=agent`, `bunx oxlint . --type-aware ... --format=agent`
  (`lint:types`), `bun run typecheck`, `bun fmt --check`, and `cargo fmt --all --check`. `--format=agent` keeps one
  diagnostic per line so parsing works inside a hook, where oxlint otherwise prints multi-line code frames.
- `.codex/hooks.json` declares the Codex Stop hook, and `.github/hooks/stop-check.json` the Copilot one; both run that
  script before a turn may finish.
- OpenCode has no Stop hook, so `.opencode/plugins/sl-stop-check.ts` plays the same part: it watches
  `session.execution.succeeded`, which the server streams when a session finishes a prompt (`session.idle` exists in the
  API schema but never reaches a plugin), runs that script in a child process with the same stdin payload, and turns a
  `block` verdict into a queued prompt for the same session. A `systemMessage` becomes a synthetic message instead.
- OpenCode turns carry no id, so the plugin reports the id of the user message that started the turn, and marks its own
  queued prompts in message metadata (which the model never sees) so a hand-back keeps reporting that turn id and a real
  prompt opens a fresh budget. Message ids derive from the event id, so OpenCode returns the original item instead of
  adding a second hand-back when an event is redelivered or two plugin instances serve one server.
- Editing the plugin does not take effect on its own: local plugin files are watched, but the running instance reloads
  only when its location reloads, so use `/reload` or `opencode api post /api/location/reload` after a change.
  `.opencode/plugins/**/*.ts` is in `tsconfig.json` and typed by the pinned `@opencode/plugin` devDependency, so
  oxlint's type-aware pass and the editor check it like the files under `scripts/`.
- A failing formatter step names the repair command (`bun fmt` or `cargo fmt --all`) in the hand-back, so the agent
  rewrites the files instead of hand-editing them.
- Step budgets sum to 720s under a 780s shared deadline, inside the 900s `timeout` declared in `.codex/hooks.json` and
  the 900s the plugin gives its child process, so no agent kills the hook mid-run; steps left over after the deadline
  are reported as skipped, not failed.
- Every diagnostic counts, errors and warnings alike, so `bun run lint` has to stay warning-free. The skill scripts'
  `window.__slQueue`, `__slPump` and `__slPerformance` globals are allowlisted in `.oxlintrc.json` rather than tolerated
  through a baseline file, and cargo advisories with no `-->` location concern the manifest instead of code, so they
  never reach the agent. `SL_STOP_CHECK=off` skips one check.
- Failures make the script return `{"decision":"block","reason":...}`, so each agent hands the failing commands and
  diagnostics back to itself instead of ending the turn: Codex and Copilot keep the turn running, and the OpenCode
  plugin queues the reason as a prompt. A turn is handed back at most twice, then only warned. Each excerpt is capped at
  2400 characters and the whole hand-back prompt at 6000.
- Nothing is cached: the suite costs ~0.8s on a warm tree and ~5s from a cold cargo target, cheaper than tracking
  whether the working tree changed, so there is no fingerprint that could go stale and skip validation. The only state
  is the hand-back counter at `~/.codex/cache/sl-stop-check/<sha256(sessionId + repo root)>.json`, keyed to the current
  turn id, so each agent's session — Codex, Copilot, or an OpenCode session id — keeps its own counter.
- Project-local hooks only load for trusted projects, and Codex prompts once to trust `.codex/hooks.json`. That file's
  contents are hashed for the trust record, so editing it needs re-approval; editing `scripts/stop-check.ts` alone does
  not.

## Gotchas

- `apps/sl/build.rs` generates shell completions and `completions/sl.1` only when `COMPLETION_DIR` is set. After CLI
  flag changes, run `cargo clean -p sl`, then `COMPLETION_DIR="$(pwd)/completions" cargo build --release`, and commit
  the diff in `completions/`. Cleaning forces regeneration if a prior build ran without `COMPLETION_DIR`, since the
  build script does not track changes to that variable.
- Single version source: `apps/sl/Cargo.toml` (currently 6.1.5); `sl.spec` derives its version from git.
- Releases trigger on `sl-*` tags and require all four platform builds (Fedora, Ubuntu/macOS POSIX, Windows) in
  `.github/workflows/build.yml`.
- Keep docs in sync: `README.md` and `README.ja.md`, plus Japanese man page `sl.1.ja`.
- TS linting uses oxlint with vendored anti-slop plugin rules (`tools/oxlint/anti-slop/`, config in `.oxlintrc.json`) —
  no ESLint.
- Do not commit build artifacts: `target/`, `node_modules/`, `libraries/websl/pkg/`, `apps/page/lib/`.

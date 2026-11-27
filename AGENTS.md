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
- OpenCode has no Stop hook, so `.opencode/plugins/sl-stop-check.ts` watches successful executions with a completed
  model step, excluding control-only runs, and runs that script with the same stdin payload. A `block` verdict becomes a
  queued prompt for the same session; a `systemMessage` becomes a non-resuming synthetic message.
- Pi likewise has no Stop protocol, so `.pi/extensions/sl-stop-check.ts` runs the same script at Pi's
  `agent_before_settle` boundary. A `block` verdict becomes a `custom_message` hand-back plus `continue: true`; a
  `systemMessage` becomes a notification that resumes nothing. Pi turns carry no id, so the extension derives one from
  the entry id of the last user message on the session branch, and its injected hand-backs are custom messages rather
  than user messages, so they never reset that budget. Pi binds one session to one process, so the shared counter needs
  no cross-instance lock. Project-local `.pi/extensions` load only after the project is trusted, and `/reload` reloads
  them after an edit. `.pi/extensions/**/*.ts` is in `tsconfig.json` and typed by the pinned
  `@earendil-works/pi-coding-agent` devDependency, like the OpenCode plugin.
- OpenCode turns carry no id, so the plugin reports the id of the user message that started the turn, and marks its own
  queued prompts in message metadata (which the model never sees) so a hand-back keeps reporting that turn id and a real
  prompt opens a fresh budget. Sequence-bounded prompt delivery records preserve the turn id across compaction, and
  unknown deliveries are skipped rather than attributed to the wrong turn. Atomic per-event claims prevent duplicate
  charges, and per-session repository locks serialize checks across instances.
- Editing the plugin does not take effect on its own: local plugin files are watched, but the running instance reloads
  only when its location reloads, so use `/reload` or `opencode api post /api/location/reload` after a change.
  `.opencode/plugins/**/*.ts` is in `tsconfig.json` and typed by the pinned `@opencode/plugin` devDependency, so
  oxlint's type-aware pass and the editor check it like the files under `scripts/`.
- A failing formatter step names the repair command (`bun fmt` or `cargo fmt --all`) in the hand-back, so the agent
  rewrites the files instead of hand-editing them.
- Step budgets sum to 720s under a 780s shared deadline, inside the 900s `timeout` declared in `.codex/hooks.json` and
  the 900s the OpenCode plugin and the Pi extension give their child processes, so no agent kills the hook mid-run;
  steps left over after the deadline are reported as skipped, not failed.
- Every diagnostic counts, errors and warnings alike, so `bun run lint` has to stay warning-free. The skill scripts'
  `window.__slQueue`, `__slPump` and `__slPerformance` globals are allowlisted in `.oxlintrc.json` rather than tolerated
  through a baseline file, and cargo advisories with no `-->` location concern the manifest instead of code, so they
  never reach the agent. `SL_STOP_CHECK=off` skips one check.
- Failures make the script return `{"decision":"block","reason":...}`, so each agent hands the failing commands and
  diagnostics back to itself instead of ending the turn: Codex and Copilot keep the turn running, and the OpenCode
  plugin queues the reason as a prompt. A turn is handed back at most twice, then only warned. Each excerpt is capped at
  2400 characters and the whole hand-back prompt at 6000.
- Check results are not cached: the suite costs ~0.8s on a warm tree and ~5s from a cold cargo target, cheaper than
  tracking whether the working tree changed. Hand-back counters live at
  `~/.codex/cache/sl-stop-check/<sha256(sessionId + repo root)>.json`, keyed to the current turn id. OpenCode also keeps
  per-event claims under `~/.codex/cache/sl-stop-check/opencode-events/`, locks under `opencode-locks/`, and turn ids in
  plugin storage. A lock left behind by a crashed process must be removed after confirming its owner has stopped.
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

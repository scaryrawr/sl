# SL (Steam Locomotive)

Monorepo for the `sl` terminal train. Rust workspace plus a Bun workspace for the demo site.

## Packages

- `libraries/libsl` — core train frames/rendering (`TrainFrames`); the heart of the project, keep changes minimal
- `apps/sl` — the `sl` CLI (clap + crossterm); see `apps/sl/AGENTS.md` for the `build.rs`/`src/cli.rs` `include!` constraint
- `libraries/websl` — wasm-bindgen bindings; built with wasm-pack, output in `libraries/websl/pkg/` (generated, not a Bun workspace member)
- `apps/page` — Preact demo site (Bun workspace member); `apps/page/src/websl.ts` is a hand-written adapter over the generated `pkg/` bindings

## Commands (from repo root unless noted)

- Setup: `bun install`, then `bun run setup` (installs wasm tooling; build/test scripts re-check prereqs and print this command when missing)
- Rust build/test: `cargo build --release`, `cargo test` (workspace root covers all three crates); `bun run test:libsl` runs only libsl
- WASM: `bun run build:websl`, `bun run test:websl` (headless Firefox via wasm-pack)
- Site: `bun run dev` / `bun run build` / `bun run test:page`; e2e: `bun run test:page:e2e` (Playwright chromium, tests in `apps/page/playwright/`)
- Lint/format/typecheck: `bun run lint`, `bun run format`, `bun run typecheck`
- CLI smoke test: `cargo run -- -h` and `cargo run -- -V` (CI only checks `-h`/`-V`, not animation)

## Stop hooks

- `.codex/hooks.json` and `.github/hooks/stop-check.json` declare matching Codex and Copilot Stop hooks that run
  `scripts/stop-check.ts` before a turn may finish: `cargo clippy --workspace --all-targets -- -D warnings` (build
  errors + clippy warnings), `bunx oxlint . --format=agent`, `bunx oxlint . --type-aware ... --format=agent`
  (`lint:types`), and `bun run typecheck`. `--format=agent` keeps one diagnostic per line so parsing works inside
  a hook, where oxlint otherwise prints multi-line code frames.
- Step budgets sum to 660s under a 780s shared deadline, inside the 900s timeout declared by both hook files, so
  the agent never kills the hook mid-run; steps left over after the deadline are reported as skipped, not failed.
- Every diagnostic counts, errors and warnings alike, so `bun run lint` has to stay warning-free. The skill
  scripts' `window.__slQueue`, `__slPump` and `__slPerformance` globals are allowlisted in `.oxlintrc.json` rather
  than tolerated through a baseline file, and cargo advisories with no `-->` location concern the manifest instead
  of code, so they never reach the agent. `SL_STOP_CHECK=off` skips one check.
- Failures make the hook return `{"decision":"block","reason":...}`, so the agent receives the failing commands
  and diagnostics instead of ending the turn. Codex hands a turn back at most twice; Copilot uses
  `stop_hook_active` to hand it back once. Each excerpt is capped at 2400 characters and the whole hand-back
  prompt at 6000.
- Nothing is cached: the suite costs ~0.8s on a warm tree and ~5s from a cold cargo target, cheaper than tracking
  whether the working tree changed, so there is no fingerprint that could go stale and skip validation. The only
  state is Codex's hand-back counter at `~/.codex/cache/sl-stop-check/<sha256(sessionId + repo root)>.json`,
  keyed to the current turn id; Copilot's continuation state comes from the hook payload.
- Project-local hooks only load for trusted projects. Codex prompts once to trust `.codex/hooks.json`; its contents
  are hashed for the trust record, so editing it needs re-approval. Editing `scripts/stop-check.ts` alone does not
  change the Codex trust record.

## Gotchas

- `apps/sl/build.rs` generates shell completions and `completions/sl.1` only when `COMPLETION_DIR` is set. After CLI flag changes, run `cargo clean -p sl`, then `COMPLETION_DIR="$(pwd)/completions" cargo build --release`, and commit the diff in `completions/`. Cleaning forces regeneration if a prior build ran without `COMPLETION_DIR`, since the build script does not track changes to that variable.
- Single version source: `apps/sl/Cargo.toml` (currently 6.1.5); `sl.spec` derives its version from git.
- Releases trigger on `sl-*` tags and require all four platform builds (Fedora, Ubuntu/macOS POSIX, Windows) in `.github/workflows/build.yml`.
- Keep docs in sync: `README.md` and `README.ja.md`, plus Japanese man page `sl.1.ja`.
- TS linting uses oxlint with vendored anti-slop plugin rules (`tools/oxlint/anti-slop/`, config in `.oxlintrc.json`) — no ESLint.
- Do not commit build artifacts: `target/`, `node_modules/`, `libraries/websl/pkg/`, `apps/page/lib/`.

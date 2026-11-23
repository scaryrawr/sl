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

## Stop hook

- `.codex/hooks.json` declares a Codex Stop hook that runs `scripts/stop-check.ts` before a turn may finish:
  `cargo clippy --workspace --all-targets -- -D warnings` (build errors + clippy warnings), `bunx oxlint .`,
  `bunx oxlint . --type-aware ...` (`lint:types`), and `bun run typecheck`.
- Failures - errors and any warning beyond the baseline - make the hook return
  `{"decision":"block","reason":...}`, so Codex hands the failing commands and diagnostics back to the agent
  instead of ending the turn. It hands a turn back at most twice, then only warns.
- Warnings that predated the hook are tolerated through a baseline at `~/.codex/cache/sl-stop-check/baseline.json`,
  seeded on the hook's first run; delete that file to re-baseline after accepting new warnings.
  `SL_STOP_CHECK=off` skips one check, and re-running on an unchanged working tree reuses the cached verdict.
- Project-local hooks only load for trusted projects, and Codex prompts once to trust `.codex/hooks.json`; commit
  changes to that file or `scripts/stop-check.ts` and re-approve the hook.

## Gotchas

- `apps/sl/build.rs` generates shell completions and `completions/sl.1` only when `COMPLETION_DIR` is set. After CLI flag changes, run `cargo clean -p sl`, then `COMPLETION_DIR="$(pwd)/completions" cargo build --release`, and commit the diff in `completions/`. Cleaning forces regeneration if a prior build ran without `COMPLETION_DIR`, since the build script does not track changes to that variable.
- Single version source: `apps/sl/Cargo.toml` (currently 6.1.5); `sl.spec` derives its version from git.
- Releases trigger on `sl-*` tags and require all four platform builds (Fedora, Ubuntu/macOS POSIX, Windows) in `.github/workflows/build.yml`.
- Keep docs in sync: `README.md` and `README.ja.md`, plus Japanese man page `sl.1.ja`.
- TS linting uses oxlint with vendored anti-slop plugin rules (`tools/oxlint/anti-slop/`, config in `.oxlintrc.json`) — no ESLint.
- Do not commit build artifacts: `target/`, `node_modules/`, `libraries/websl/pkg/`, `apps/page/lib/`.

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

## Gotchas

- `apps/sl/build.rs` generates shell completions and `completions/sl.1` only when `COMPLETION_DIR` is set (CI: `COMPLETION_DIR="$(pwd)/completions" cargo build --release`). After CLI flag changes, regenerate that way and commit the diff in `completions/`; otherwise the vendored files go stale.
- Single version source: `apps/sl/Cargo.toml` (currently 6.1.5); `sl.spec` derives its version from git.
- Releases trigger on `sl-*` tags and require all four platform builds (Fedora, Ubuntu/macOS POSIX, Windows) in `.github/workflows/build.yml`.
- Keep docs in sync: `README.md` and `README.ja.md`, plus Japanese man page `sl.1.ja`.
- TS linting uses oxlint with vendored anti-slop plugin rules (`tools/oxlint/anti-slop/`, config in `.oxlintrc.json`) — no ESLint.
- Do not commit build artifacts: `target/`, `node_modules/`, `libraries/websl/pkg/`, `apps/page/lib/`.

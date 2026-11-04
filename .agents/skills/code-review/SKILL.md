---
name: code-review
description: Review pull requests in the SL repo. Maps changed paths to the right owners, regenerated artifacts, and validation commands across the Rust CLI, libsl, websl WASM, and the Preact demo site.
---

# SL code review

Start from the diff: list the changed paths, then work through each section that matches. Reference `AGENTS.md` (and `apps/sl/AGENTS.md` for CLI internals) for the command inventory instead of re-deriving it.

## libsl (`libraries/libsl/`)

- Confirm the change preserves the train animation's spirit; frame/timing changes should be minimal and justified.
- `cargo test` from repo root exercises libsl plus dependent crates; require it green.
- Check that `apps/sl` and `libraries/websl` still compile against changed public types (same `cargo build --release` run covers both).

## CLI (`apps/sl/`)

- Respect the `build.rs` `include!("src/cli.rs")` constraint: no `//!` inner docs or `mod` declarations in `src/cli.rs`.
- Flagged flag changes: check backward compatibility and whether `--help`/`-V` still work (`cargo run -- -h`).
- Required companion updates for any clap flag change: regenerated `completions/` (build with `COMPLETION_DIR="$(pwd)/completions"`), `README.md`, `README.ja.md`, and `sl.1.ja` where relevant. Missing regenerated completions is an actionable finding — CI bakes the committed `completions/` into packages.

## WASM (`libraries/websl/`)

- `pkg/` is generated output; review `src/` and require the diff to not hand-edit `pkg/`.
- Interface changes must be mirrored in `apps/page/src/websl.ts`; a mismatch is a blocker.
- Validation: `bun run test:websl` (needs wasm-pack; `bun run setup` installs it) and `bun run build`.

## Demo site (`apps/page/`)

- Map changed source to tests: unit tests live beside sources as `*.test.ts` (`bun run test:page`); service-worker/offline behavior is covered by `apps/page/playwright/offline.e2e.js` (`bun run test:page:e2e`, chromium only).
- TS must pass `bun run lint` (oxlint incl. type-aware + anti-slop plugin rules) and `bun run typecheck`; new ESLint config or disable comments are findings.
- Offline/service-worker changes: check that cached embed navigation still works — recent regressions landed here twice (cache-version bumps, navigation handling).

## Cross-cutting

- Docs: user-visible behavior changes need `README.md` and `README.ja.md` updates.
- Version: only `apps/sl/Cargo.toml` carries the version; flag version bumps in other manifests.
- Workflows (`.github/workflows/`): changes must keep all four build legs (Fedora, POSIX/macOS, Ubuntu, Windows) and the `sl-*` tag release gate intact.
- Lockfiles (`Cargo.lock`, `bun.lock`) should only change with intentional dependency updates.

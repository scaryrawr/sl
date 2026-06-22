# SL CLI App

## Important: `src/cli.rs` is `include!`d into `build.rs`

The file `src/cli.rs` is included via `include!("src/cli.rs")` inside `build.rs` for generating shell completions and the man page. Because of this:

- **Do not use `//!` inner doc comments** in `cli.rs` — they cause `E0753` ("inner doc comments are not allowed in this position") when the file is included inside a function scope. Use `///` outer doc comments instead.
- Keep `cli.rs` free of `mod` declarations or other items that would be invalid when `include!`d inside `main()`.

## Build validation

- Rust: `cargo check` (run from repo root)
- Web app: `cd apps/page && bun build ./src/index.tsx --outdir ./lib --target=browser`

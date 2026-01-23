# GitHub Copilot Instructions for SL Repository

## Project Overview

SL (Steam Locomotive) is a joke command that runs a train across your terminal when you type "sl" instead of "ls". This repository contains:

- **Rust CLI application** (`apps/sl`): The main terminal application
- **Rust library** (`libraries/libsl`): Core train rendering logic
- **WASM library** (`libraries/websl`): WebAssembly bindings for web embedding
- **Web page** (`apps/page`): TypeScript/React application for embedding SL in browsers

## Tech Stack

- **Languages**: Rust (2021 edition), TypeScript, JavaScript
- **Build Tools**: Cargo, wasm-pack, Bun (v1.3.3)
- **Testing**: Cargo test, wasm-pack test, Bun test
- **Key Dependencies**:
  - Rust: clap, crossterm, filedescriptor
  - TypeScript: React, Vite (for page app)
  - WASM: wasm-pack for building WebAssembly

## Build and Test Commands

### Building

```bash
# Build all projects
bun run build

# Build specific components
cargo build --release                    # Rust CLI
bun run build:websl                      # WASM library
bun run build:page                       # Web page

# Build WASM from Rust source
bun run build:websl:rust
```

### Testing

```bash
# Run all tests
bun run test

# Test specific components
cargo test --manifest-path libraries/libsl/Cargo.toml  # Rust library tests
bun run test:websl                                      # WASM tests
bun run test:page                                       # Page tests
wasm-pack test --headless --firefox libraries/websl    # WASM browser tests
```

### Linting and Formatting

```bash
# Lint JavaScript/TypeScript
bun run lint
bun run lint:fix

# Format code
bun run format
cargo fmt
```

### Development

```bash
# Start development server for web page
bun run dev
bun run dev:page

# Watch and check Rust code
bun run dev:websl
```

## Project Structure

```
sl/
├── apps/
│   ├── sl/           # Rust CLI application
│   └── page/         # Web application for embedding
├── libraries/
│   ├── libsl/        # Core Rust library with train rendering
│   └── websl/        # WASM bindings
├── completions/      # Shell completions (bash, fish, zsh)
└── .github/
    └── workflows/    # CI/CD workflows for multiple platforms
```

## Code Style Guidelines

### Rust
- Follow standard Rust conventions (use `cargo fmt`)
- Use the 2021 edition
- Optimize for release builds with LTO enabled
- Use descriptive error messages
- Leverage existing types from `libsl` for train rendering

### TypeScript/JavaScript
- Use Prettier for formatting (configured in `.prettierrc.js`)
- Use ESLint rules (configured in `eslint.config.mjs`)
- Organize imports automatically
- Use TypeScript strict mode where possible

### Documentation
- Update README files when adding new features or changing behavior
- Maintain both English (`README.md`) and Japanese (`README.ja.md`) versions
- Document CLI options in help text and man pages

## Boundaries and Constraints

### DO NOT modify:
- **License files**: `LICENSE` file is MIT licensed
- **Build artifacts**: Don't commit compiled binaries, `target/`, `node_modules/`, `pkg/`, or `dist/` directories
- **Lock files unnecessarily**: `Cargo.lock`, `bun.lock` should only change when dependencies are intentionally updated
- **Git configuration**: `.gitignore`, `.gitattributes`
- **Core animation logic**: The train ASCII art and animation in `libsl` is the heart of the project; changes should be minimal and preserve the original spirit

### DO modify with care:
- **Dependencies**: Only update when necessary for security or features
- **CI/CD workflows**: Changes should maintain cross-platform builds (Fedora, Ubuntu, macOS, Windows)
- **CLI arguments**: Changes should maintain backward compatibility where possible

## Platform Support

This project supports:
- **macOS** (x64, ARM64)
- **Linux** (Fedora, Ubuntu/Debian, other distributions)
- **Windows** (x64, ARM64)

When making changes, ensure they work across all platforms or use conditional compilation appropriately.

## Testing Expectations

- Always run relevant tests before submitting changes
- For Rust changes: Run `cargo test` and ensure CLI still works
- For WASM changes: Run `wasm-pack test --headless --firefox libraries/websl`
- For web page changes: Run `bun run test:page` and manually test in browser
- Verify the CLI works by running `cargo run -- --help` and testing basic animation

## Common Tasks

### Adding a new CLI option
1. Update `apps/sl/src/main.rs` with new clap argument
2. Update `build.rs` to regenerate completions
3. Update man pages (`sl.1.ja`)
4. Update README files
5. Test with `cargo run -- --new-option`

### Modifying train animations
1. Core animation is in `libraries/libsl/src/`
2. Update both Rust library and WASM bindings if needed
3. Test with CLI and web embed
4. Ensure frame timing works correctly

### Web embed changes
1. Modify TypeScript in `apps/page/`
2. Update WASM interface in `libraries/websl/` if needed
3. Test query parameters work correctly
4. Ensure build produces correct WASM filename references

## Security

- Never commit secrets or API keys
- Validate all user input (though this is a joke command, still follow best practices)
- Keep dependencies updated for security patches
- Use safe Rust practices (avoid unsafe unless necessary)

## Success Criteria

A successful change:
- Passes all existing tests
- Builds successfully on all platforms
- Maintains backward compatibility for CLI options
- Includes updated documentation where relevant
- Follows the existing code style
- Preserves the fun, whimsical nature of the project

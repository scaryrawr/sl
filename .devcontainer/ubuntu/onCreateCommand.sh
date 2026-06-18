#!/usr/bin/env bash
set -e

# Setup Rust toolchain for wasm-pack
rustup default stable
bun run setup
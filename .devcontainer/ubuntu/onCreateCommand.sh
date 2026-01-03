#!/usr/bin/env bash
set -e

# Setup Rust toolchain for wasm-pack
rustup default stable
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

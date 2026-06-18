#!/usr/bin/env bash
set -e

sudo dnf install -y dnf-plugins-core cargo @c-development @rpm-development-tools rpkg gh

# Setup Rust toolchain for wasm-pack
rustup default stable
bun run setup
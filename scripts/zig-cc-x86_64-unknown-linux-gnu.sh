#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$script_dir/zig-cc-linker.sh" x86_64-unknown-linux-gnu "$@"

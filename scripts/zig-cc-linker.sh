#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "usage: zig-cc-linker.sh <rust-target> [linker-args...]" >&2
  exit 64
fi

rust_target=$1
shift

case "$rust_target" in
  x86_64-unknown-linux-gnu)
    zig_target=x86_64-linux-gnu.2.17
    ;;
  aarch64-unknown-linux-gnu)
    zig_target=aarch64-linux-gnu.2.17
    ;;
  *)
    echo "unsupported Rust target for Zig linker: $rust_target" >&2
    exit 65
    ;;
esac

exec "${ZIG:-zig}" cc -target "$zig_target" "$@"

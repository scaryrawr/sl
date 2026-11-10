#!/usr/bin/env bash
# Record one sl CLI run into an asciinema cast for frame/invariant analysis.
#
# Usage: record-cast.sh <scenario> [--term cols:rows]
# Scenarios: d51 | d51-accident | c51 | logo | fly
#
# stdin is forced off-tty via `script`, so car labels always come from
# fixtures/cars.txt (deterministic) instead of the current directory listing.
# Prints the created evidence directory (contains run.sl, sl.cast) on stdout.
set -euo pipefail
scenario="${1:?usage: record-cast.sh <scenario> [--term cols:rows]}"
shift || true
term="80x24"
while [ $# -gt 0 ]; do
  case "$1" in
    --term) term="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
case "$scenario" in
  d51) flags="" ;;
  d51-accident) flags="--accident" ;;
  c51) flags="--c51" ;;
  logo) flags="--logo" ;;
  fly) flags="--fly" ;;
  *) echo "unknown scenario: $scenario" >&2; exit 2 ;;
esac
for tool in asciinema script; do
  command -v "$tool" >/dev/null || { echo "missing tool: $tool (see SKILL.md Launch)" >&2; exit 1; }
done
skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$skill_dir/../../.." && pwd)"
binary="$repo_root/target/release/sl"
if [ ! -x "$binary" ]; then
  echo "building sl (release)..." >&2
  (cd "$repo_root" && cargo build --release --manifest-path apps/sl/Cargo.toml >&2)
fi
evidence_dir="$skill_dir/evidence/$(date +%Y%m%d-%H%M%S)-$scenario"
mkdir -p "$evidence_dir"
printf '#!/bin/sh\ncat "%s" | "%s" %s\n' "$skill_dir/fixtures/cars.txt" "$binary" "$flags" > "$evidence_dir/run.sl"
chmod +x "$evidence_dir/run.sl"
asciinema rec -q --headless --output-format asciicast-v2 --window-size "$term" --idle-time-limit 0.05 --overwrite \
  -c "$evidence_dir/run.sl" "$evidence_dir/sl.cast"
echo "$evidence_dir"

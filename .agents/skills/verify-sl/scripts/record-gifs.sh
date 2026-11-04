#!/usr/bin/env bash
# Regenerate recordings/ (the GIFs embedded in the PR description) from fresh
# runs: CLI casts recorded with record-cast.sh rendered via agg, and the live
# web demo captured by web-record.mjs. Run after verification passes.
#
# Usage: record-gifs.sh   (needs agg + ffmpeg on PATH)
set -euo pipefail
skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$skill_dir/recordings"
mkdir -p "$out"
for tool in agg ffmpeg bun asciinema; do
  command -v "$tool" >/dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done
for sc in d51 d51-accident c51 logo fly; do
  dir=$("$skill_dir/scripts/record-cast.sh" "$sc")
  agg --font-size 12 --speed 2 "$dir/sl.cast" "$out/cli-$sc.gif"
  echo "wrote $out/cli-$sc.gif"
done
bun "$skill_dir/scripts/web-record.mjs" "$out"
# Keep the whole set small enough for PR bodies.
du -sh "$out"

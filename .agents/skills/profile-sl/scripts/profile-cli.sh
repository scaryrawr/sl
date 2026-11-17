#!/usr/bin/env bash
# Record a symbolized native CLI flamegraph for diagnosis, not timed comparison.
set -euo pipefail

scenario="${1:-d51}"
skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$skill_dir/../../.." && pwd)"
fixture="$repo_root/.agents/skills/verify-sl/fixtures/cars.txt"
binary="$repo_root/target/release/sl"

case "$scenario" in
  d51) flags="" ;;
  d51-accident) flags="--accident" ;;
  c51) flags="--c51" ;;
  logo) flags="--logo" ;;
  fly) flags="--fly" ;;
  *)
    echo "usage: profile-cli.sh d51|d51-accident|c51|logo|fly" >&2
    exit 2
    ;;
esac

for tool in asciinema flamegraph; do
  command -v "$tool" >/dev/null || {
    echo "missing tool: $tool (run scripts/doctor.sh cli; do not infer a profile)" >&2
    exit 1
  }
done

(
  cd "$repo_root"
  CARGO_PROFILE_RELEASE_DEBUG=true cargo build --release --manifest-path apps/sl/Cargo.toml
)

stamp="$(date +%Y%m%d-%H%M%S)"
evidence="$skill_dir/evidence/${stamp}-cli-${scenario}"
mkdir -p "$evidence"
run="$evidence/run.sh"
cast="$evidence/sl.cast"
graph="$evidence/flamegraph.svg"

printf '#!/usr/bin/env bash\ncat %q | %q %s\n' "$fixture" "$binary" "$flags" > "$run"
chmod +x "$run"

printf '%s\n' \
  "flamegraph --deterministic --notes \"$(git -C "$repo_root" rev-parse --short HEAD) cli:$scenario\" -o \"$graph\" -- asciinema rec -q --headless --output-format asciicast-v2 --window-size 80x24 --idle-time-limit 0.05 --overwrite -c \"$run\" \"$cast\"" \
  > "$evidence/command.txt"

flamegraph \
  --deterministic \
  --notes "$(git -C "$repo_root" rev-parse --short HEAD) cli:$scenario" \
  -o "$graph" \
  -- asciinema rec \
  -q \
  --headless \
  --output-format asciicast-v2 \
  --window-size 80x24 \
  --idle-time-limit 0.05 \
  --overwrite \
  -c "$run" \
  "$cast"

echo "$evidence"


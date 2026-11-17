#!/usr/bin/env bash
# Check whether a native or web profiling surface is ready to drive.
set -u

surface="${1:-all}"
skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$skill_dir/../../.." && pwd)"
fail=0

report() {
  if [ "$2" = "ok" ]; then
    echo "OK   $1"
  else
    echo "FAIL $1"
    fail=1
  fi
}

case "$surface" in
  cli|web|all) ;;
  *)
    echo "usage: doctor.sh cli|web|all" >&2
    exit 2
    ;;
esac

if [ "$surface" = "cli" ] || [ "$surface" = "all" ]; then
  command -v cargo >/dev/null && report "cargo installed" ok || report "cargo missing" fail
  command -v asciinema >/dev/null && report "asciinema installed" ok \
    || report "asciinema missing -> install the PTY recorder before profiling the CLI" fail
  if command -v flamegraph >/dev/null; then
    report "flamegraph installed" ok
  elif command -v samply >/dev/null; then
    report "samply installed (use its interactive command from SKILL.md)" ok
  else
    report "no flamegraph or samply -> install a profiler before native diagnosis" fail
  fi
  if [ -x "$repo_root/target/release/sl" ]; then
    if version=$("$repo_root/target/release/sl" -V 2>/dev/null); then
      report "release sl is executable ($version)" ok
    else
      report "release sl fails to run -> rebuild it" fail
    fi
  else
    report "release sl missing -> CARGO_PROFILE_RELEASE_DEBUG=true cargo build --release --manifest-path apps/sl/Cargo.toml" fail
  fi
fi

if [ "$surface" = "web" ] || [ "$surface" = "all" ]; then
  command -v bun >/dev/null && report "bun installed" ok || report "bun missing" fail
  [ -d "$repo_root/apps/page/lib" ] && report "page production build present" ok \
    || report "page build missing -> bun run build:page" fail
  [ -d "$repo_root/libraries/websl/pkg" ] && report "websl package present" ok \
    || report "websl package missing -> bun run build:websl" fail
  if (cd "$repo_root/apps/page" && bun -e 'await import("playwright")' >/dev/null 2>&1); then
    report "Playwright package present" ok
  else
    report "Playwright package missing -> bun install" fail
  fi
fi

exit "$fail"

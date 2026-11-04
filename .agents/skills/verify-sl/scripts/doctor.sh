#!/usr/bin/env bash
# One read-only health check: is this environment ready to drive sl for verification?
# Never starts or kills anything. Exit 0 = ready; exit 1 = something must be fixed first.
set -u
skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$skill_dir/../../.." && pwd)"
fail=0
report() { [ "$2" = ok ] && echo "OK   $1" || { echo "FAIL $1"; fail=1; }; }

if [ -x "$repo_root/target/release/sl" ]; then
  report "sl binary present ($("$repo_root/target/release/sl" -V))" ok
else
  report "sl binary missing -> cargo build --release --manifest-path apps/sl/Cargo.toml" fail
fi
for tool in asciinema script python3 bun; do
  command -v "$tool" >/dev/null && report "$tool installed" ok || report "$tool missing" fail
done
[ -d "$repo_root/apps/page/lib" ] && report "web page built (apps/page/lib)" ok \
  || report "web page not built -> bun run build:page" fail
[ -d "$repo_root/libraries/websl/pkg" ] && report "websl pkg built" ok \
  || report "websl pkg missing -> bun run build:websl (needs ~/.cargo/bin first on PATH when Homebrew rustc also exists)" fail
if [ -n "${PLAYWRIGHT_PORT:-4173}" ] && curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PLAYWRIGHT_PORT:-4173}/sl/"; then
  report "verification server already answering on ${PLAYWRIGHT_PORT:-4173} (not started by you: do not kill it)" ok
else
  report "verification server not answering on ${PLAYWRIGHT_PORT:-4173} (web-verify.mjs starts its own)" ok
fi
# Resolve the headless shell through Playwright itself (dry-run reports the
# platform-correct, PLAYWRIGHT_BROWSERS_PATH-aware install location).
hs_dir=$(cd "$repo_root/apps/page" && bunx playwright install chromium-headless-shell --dry-run 2>/dev/null \
  | grep -A1 "Headless Shell" | grep "Install location" | sed 's/.*Install location: *//' | head -1)
hs_bin=$(find "$hs_dir" -name chrome-headless-shell -type f 2>/dev/null | head -1)
if [ -n "$hs_bin" ] && [ -x "$hs_bin" ]; then
  report "playwright chromium headless shell present" ok
else
  report "playwright chromium missing/incomplete -> bun run --cwd apps/page playwright:install (see SKILL.md Launch if extraction hangs)" fail
fi
exit "$fail"

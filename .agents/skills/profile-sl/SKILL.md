---
name: profile-sl
description: "Analyze sl runtime performance and find evidence-backed improvements on the CLI/TUI, libsl renderer, websl/WASM bridge, and Preact demo. Use when investigating a slow train animation, CPU or frame-time regressions, flamegraphs, samply profiles, browser long tasks, benchmark comparisons, or optimization work."
---

# Profile sl

Profile the shipped behavior before proposing an optimization. Separate **finding the limiter**
from **proving a speedup**: flamegraphs, samply, Chrome traces, and code inspection locate a
candidate hot path; repeated, fixed measurements without a sampling profiler decide whether a
change wins.

Always run from the repository root. Keep evidence under
`.agents/skills/profile-sl/evidence/`; it is git-ignored.

## Pick the workload

Choose the smallest workload that contains the suspected cost, then repeat on the user-facing
surface that contains the whole path.

| Surface | What it exercises | Primary metric | Guard |
| --- | --- | --- | --- |
| `libsl` | one renderer call through `add_d51`, `add_c51`, or `add_logo` into a deterministic in-memory `RenderTarget` | render calls/second or CPU time per fixed number of frames | same emitted draw operations and complete output |
| CLI | optimized `target/release/sl` in a fixed 80x24 PTY | CPU time per complete traversal; output correctness | invoke `verify-sl` for the matching scenario |
| WASM/native boundary | `websl::add_*`, JavaScript array conversion, and callback crossing | browser callback cost and allocation/GC behavior | same frames and labels |
| Web demo | production-built `/sl/embed.html` under normal browser time | animation callback p50/p95, frame interval p50/p95, and long-task count/duration | `verify-sl` plus no page errors |

Use `--files` for a deterministic empty-car CLI workload. Use the two-car fixture in
`.agents/skills/verify-sl/fixtures/cars.txt` when passenger-car formatting or bridge cost is part of
the hypothesis. For the core renderer, hold train type, option flags, screen size, `x`, and car
count constant. Do not benchmark smoke across unrelated initial states: `Smoke` is stateful and
must advance through the same sequence on both sides.

## Start with a measurement card

Write these before changing code:

- **Claim:** the end-user sentence to prove, including metric and workload.
- **Baseline/candidate:** exact Git refs and build commands.
- **Workload:** scenario, terminal/browser dimensions, input, sample duration, and runs.
- **Metric and guard:** one primary number plus correctness, output-size, or memory cost.
- **Keep bar:** an effect larger than the unchanged A/A variation on p50 **and** p95. Pre-register it;
  do not choose it after seeing results.
- **Leash:** one suspected limiter and one change at a time. Stop if the instrument cannot confirm
  that the work happened or the effect stays inside the noise floor.

Record the host from `uname -srm`, load from `uptime`, and available cores
(`sysctl -n hw.logicalcpu` on macOS or `nproc` on Linux). Do not stop unrelated processes.
If load is changing, report it and interleave baseline/candidate runs rather than treating a
single low-noise sample as representative.

## Build

Profile optimized code with debug symbols available, never a debug binary:

```bash
CARGO_PROFILE_RELEASE_DEBUG=true cargo build --release --manifest-path apps/sl/Cargo.toml
bun install
bun run build:websl
bun run build:page
```

`bun install` is for an existing, dependency-missing checkout; do not change dependency manifests
for profiling. Obtain the required approval if this environment requires network access before
running a download.

`CARGO_PROFILE_RELEASE_DEBUG=true` adds symbols without committing a profiling setting. The
current workspace emits a warning that `[profile.release]` in `apps/sl/Cargo.toml` is ignored for
non-root packages. The measured baseline therefore uses Cargo's root workspace release defaults,
not that member's `lto = true` setting. Treat moving the profile to the virtual workspace as a
separate, pre-registered optimization; do not tune one side implicitly. Rebuild both sides from
clean or identically configured targets because a stale `target/release/sl` invalidates a
comparison.

Run `.agents/skills/profile-sl/scripts/doctor.sh cli` for native tooling or
`.agents/skills/profile-sl/scripts/doctor.sh web` for browser tooling. Missing profiler support is
a prerequisite, not a reason to infer a result.

## Find the limiter

Run a profiler on a separate diagnostic run. Do not report timings collected while profiling.

### Native CPU

`flamegraph-rs/flamegraph` is the portable first view. It uses `perf` on Linux, `xctrace` on macOS,
and native tooling on Windows. Linux builds with lld may require `-C link-arg=-Wl,--no-rosegment`
for accurate stacks. Prefer Samply when an interactive Firefox Profiler timeline and off-CPU
samples are useful, especially on macOS or Windows.

Capture a deterministic D51 traversal:

```bash
.agents/skills/profile-sl/scripts/profile-cli.sh d51
```

The helper profiles an `asciinema`-allocated 80x24 PTY and keeps `command.txt`, `sl.cast`, and
`flamegraph.svg` together. The recorder is a stable user-path wrapper; this run is diagnostic
because recorder and profiler overhead are inside it. The available cases are `d51`,
`d51-accident`, `c51`, `logo`, and `fly`.

For interactive diagnosis with Samply:

```bash
samply record asciinema rec -q --headless --output-format asciicast-v2 \
  --window-size 80x24 --idle-time-limit 0.05 --overwrite \
  -c 'target/release/sl --files' .agents/skills/profile-sl/evidence/sl.cast
```

Interpret the profile against the source:

- `main.rs` deliberately spends about 40 ms waiting in `crossterm::event::poll`; an on-CPU
  flamegraph can omit that sleep. A slow traversal wall clock can therefore be pacing or I/O, not
  excessive renderer CPU. Use CPU time and an off-CPU/timeline view for that question.
- `TerminalRenderer::draw_str` queues cursor movement plus bytes; `stdout.flush()` is the terminal
  I/O boundary. Do not optimize sprite computation while the wide frame is actually flush time.
- `libsl::add_train` visits every sprite row and every visible car. `print_car` formats labels;
  `mvaddstr` clips Unicode display width; smoke advances separately. Attribute a hot frame to the
  function and branch, not merely to `libsl`.
- The train only examines a visible subset of cars, but a large `names` list still determines
  offscreen geometry and, in the web bridge, JavaScript strings are copied in `names_from_array`
  for every call. Hold car count constant when comparing.

For memory or allocation suspicion, inspect frame construction and bridge conversions first, then
use a platform allocator or heap profile only after repeated CPU timings show a relevant limiter.

### Web callback and browser work

Use the real production build at fixed 1280x900 and normal animation time:

```bash
bun .agents/skills/profile-sl/scripts/profile-web.mjs embed --runs 7 --sample-ms 5000
```

This helper wraps the real `requestAnimationFrame` callback before the shipped bundle loads,
records callback duration and interval in the page, observes long tasks, and saves raw per-run
JSON. It proves that frames rendered and that the animation callback ran. Its wrapper overhead is
small and identical on both sides, but still report the metric as instrumented callback cost rather
than whole-browser time. It does **not** use the verification skill's pumped clock; that harness
proves frames but intentionally removes timing.

Use Chromium Performance/trace tooling when a wide callback needs finer attribution. Distinguish:

1. Rust/WASM work inside `add_d51`, `add_c51`, or `add_logo`.
2. JavaScript conversion and `Display` callback crossings.
3. `Array.from(row.textContent)`, `textContent` replacement, layout, and paint.
4. The deliberate 60 ms `setTimeout` plus `requestAnimationFrame` pacing.

The web display callback currently mutates each affected row immediately, often from many
`draw_str` calls in one frame. A large `Display`/WASM sample alone does not prove that DOM updates
or paint are the limiter. Require trace or callback evidence before proposing a JS/WASM boundary
rewrite.

## Prove a change

1. Run the unchanged code at least twice, and the final timing workload at least five times. Use
   seven or more for a small CLI/browser effect.
2. Warm each workload equally before measured runs. On the web, use the script's warmup outside
   the reset measurement window. Do not profile timed comparison runs.
3. Interleave A, B, A, B when comparing two built binaries or refs. Preserve the same machine, PTY
   size, viewport, terminal labels, screen state, and build flags.
4. Prefer CPU time, instructions, or callback cost for work intentionally paced by sleeps. Wall
   clock is the correct metric only when the claim is about complete user-visible traversal.
5. Use Hyperfine when commands truly terminate:

   ```bash
   hyperfine --warmup 1 --runs 7 --metrics=time_wall_clock,time_cpu,memory_peak_resident \
     --export-json .agents/skills/profile-sl/evidence/results.json '<same deterministic command>'
   ```

   The native helper's recorder cost is not zero. If the recorder becomes the limiter, move the
   timing to a dedicated deterministic `RenderTarget` benchmark and keep the PTY run for the
   end-to-end guard. For a direct child process through a controlling PTY, use:

   ```bash
   uv --version
   uv run --no-project python .agents/skills/profile-sl/scripts/measure-cli.py \
     evidence/baseline-sl evidence/candidate-sl --runs 7 --sl-arg=--files
   ```

   This command alternates binary runs, reports the child process's `wait4` CPU time, fixes the PTY
   at 80x24, and rejects differing PTY output hashes. For memory measurements, use an external
   launcher that measures the exec'd target rather than the forked Python child's inherited RSS.
6. Confirm work and output. A rejected/errored frame, unloaded WASM module, or timeout is not a
   faster sample. Check exit status, callback count, output hash/frame count, and visible train
   art. Use `verify-sl` after any rendering, bridge, or animation-loop candidate:

   ```bash
   uv --version
   uv run --no-project python -m unittest discover \
     -s .agents/skills/verify-sl/scripts -p 'test_*.py'
   cast=$(.agents/skills/verify-sl/scripts/record-cast.sh d51)
   uv run --no-project python .agents/skills/verify-sl/scripts/check-invariants.py \
     "$cast/sl.cast" --scenario d51
   uv run --no-project python .agents/skills/verify-sl/scripts/extract-frames.py \
     "$cast/sl.cast" --golden .agents/skills/verify-sl/goldens/d51.json
   bun .agents/skills/verify-sl/scripts/web-verify.mjs embed
   ```

   Replace `d51` with the matching CLI scenario and golden when the candidate affects C51, logo,
   accident, fly, or another protected rendering path.

7. Check the end-to-end share. A helper that costs 5% of one complete frame cannot yield a
   30% end-to-end improvement.

## Report a finding

Lead with `faster`, `slower`, `no measurable difference`, or `inconclusive`. Include:

- exact claim, workload, optimized build/ref, hardware and host-load note;
- median plus min/max and run count for every measured side;
- limiter and the profiling/trace evidence that identifies it;
- output/work checks and correctness guard;
- end-to-end share and any memory, binary-size, or frame-jank cost;
- evidence paths and rejected hypotheses.

Call the result **inconclusive** if the profiler and timing disagree, a side ran with different
build settings, the wrapper dominates, the work/output was not checked, or the effect is inside
the A/A range. A flamegraph alone never proves an improvement.

## References

- [flamegraph-rs/flamegraph](https://github.com/flamegraph-rs/flamegraph): CPU sampling, platform
  backends, symbol/debug-info guidance.
- [mstange/samply](https://github.com/mstange/samply): local interactive timelines and off-CPU
  samples; profiles remain local unless explicitly uploaded.
- [sharkdp/hyperfine](https://github.com/sharkdp/hyperfine): repeat runs and statistical exports.


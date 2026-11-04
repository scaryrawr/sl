# sl verification map

This directory is the maintained source for verifying sl's protected user-facing behavior: the train animations, the accident scene, and the passenger-car labels, on both the CLI and the web demo. Read this index before driving, then use the matching feature file as the recipe.

## Baseline preconditions

- Run from the repo root; `scripts/doctor.sh` passes.
- CLI: `target/release/sl` built; car labels always come from `fixtures/cars.txt` (stdin forced off-tty), so the working directory never changes results.
- Web: `bun run build:page` current (rebuild after any websl/page source change); chromium + headless shell complete.
- Never drive a verification server on :4173 that this run did not start (doctor reports warm ports).

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer stable handles: CLI flags and recorded casts; web query params and ARIA names (`[role="img"][aria-label*="Animated ASCII art"]`, `#train-type-select`, `#messages-textarea`, `#fly-checkbox`).
- Treat every command as literal. Keep quoted fixture names (`VERIFCAR-A`) unchanged - they are the probe strings.
- Sample CLI frames at cumulative output-byte offsets; asciicast events are transport chunks, so never count events or sample by wall-clock time.
- Keep `evidence/` artifacts after cleanup; commit goldens only with the change that intentionally alters art.

## Proof and skip reporting

- Capture the motion, not just a final screen: golden frame sets (CLI) or >20 distinct pumped frames (web).
- Pair visible art proof with effect proof: labels render and travel right-to-left, train exits and clears, `Help!` appears only under accident mode.
- Report an unreachable path with the attempted command and unmet precondition; do not report a skipped entry point as verified through another path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph of user-visible behavior, then exactly four H2 sections: `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, `Gotchas`.

## Index

- `train-animation.md` - the locomotives: D51, C51, logo, fly; wheel animation; scroll-and-exit.
- `accident.md` - accident mode: people crying for help.
- `train-cars.md` - passenger-car labels from piped input, directory listings, and the web form.
- `web-demo.md` - the two web surfaces: interactive home form and query-param embed, plus the reduced-motion fallback.

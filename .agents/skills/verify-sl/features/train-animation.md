# Train animation

The locomotive scrolls right-to-left across the terminal with its wheels turning, in three variants (D51 default, C51 with `-c`, small logo with `-l`) and a flying mode (`-F`) that lifts the train diagonally; the web embed renders the same trains from wasm.

## Sub-features

- `anim-d51` - default D51 scrolls, wheels alternate, exits left.
- `anim-c51` - C51 variant via `--c51` / `trainType=c51`.
- `anim-logo` - small logo train via `--logo` / `trainType=logo`.
- `anim-fly` - flying mode starts at the bottom and rises.
- `anim-web` - same variants pumped step-by-step in the browser.

## How to get to it (user POV)

- Type `sl` (optionally `-c`, `-l`, `-F`) in a terminal.
- Open `/sl/embed.html?trainType=d51|c51|logo&fly=true` in a browser.
- Switch the `Train Type` select on the demo home page.

## Driving it with verify-sl scripts

Preconditions: doctor passes; binary and page built.

- **D51 CLI.** Run `.agents/skills/verify-sl/scripts/record-cast.sh d51`, then `check-invariants.py <dir>/sl.cast --scenario d51` and `extract-frames.py <dir>/sl.cast --golden .agents/skills/verify-sl/goldens/d51.json`. All invariants pass and 12 golden frames match byte-for-byte.
- **C51 / logo / fly CLI.** Same pair of commands with scenario `c51`, `logo`, `fly`; the invariant names differ (wheel patterns, fly starts low).
- **Web variants.** Run `bun .agents/skills/verify-sl/scripts/web-verify.mjs embed|embed-logo|embed-fly`; `frames.json` shows the variant's art (`_D _|`, `+------`) and >20 distinct frames.
- **Home select switch.** Covered in `web-demo.md`.

## Gotchas

- Goldens depend on terminal size: record at default `--term 80x24`; a `--window-size` mismatch invalidates them.
- Wheels alternate every 12 columns - a capture that stops before the train enters shows a static engine and hides wheel-animation regressions; always run the full recording (it self-terminates on exit).
- The embed viewport is ~164 columns wide; allow >=260 pumps (320 for full trains) before judging trailing cars/art.
- `(O)` appears inside the logo sprite; it is not an accident marker.

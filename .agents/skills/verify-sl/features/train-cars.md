# Train car labels

Passenger cars render text labels: piped stdin lines when stdin is not a tty, current-directory entries otherwise (`--files` disables), and `messages` on the web (query param on the embed, textarea on the home form). Long/wide labels truncate to the car's display width.

## Sub-features

- `cars-pipe` - piped lines appear on successive cars (CLI).
- `cars-dir` - directory listing appears when stdin is a tty and `--files` is not set.
- `cars-web-embed` - `messages=["A","B"]` query param drives the cars.
- `cars-web-form` - typing into `#messages-textarea` changes the next train's labels.

## How to get to it (user POV)

- `some-command | sl` in a terminal.
- Run `sl` in a directory (labels are its entries).
- Open the embed with `messages=%5B%22VERIFCAR-A%22%5D`.
- Type into the `Messages` textarea on the demo home page.

## Driving it with verify-sl scripts

Preconditions: doctor passes.

- **Piped labels (CLI).** `record-cast.sh d51` pipes `fixtures/cars.txt`; `check-invariants.py --scenario d51` proves >=2 of the 7-char label prefixes render and `car label travels right-to-left` moves >40 columns across the run.
- **Web embed labels.** `web-verify.mjs embed` asserts `VERIFCAR-` and `VERIFCAR-B` appear in pumped frames (needs >=320 pumps at the default viewport - trailing cars enter late).
- **Home form labels.** `web-verify.mjs home-form` types labels via keyboard, toggles fly to restart the animation, and asserts the labels reach the cars.
- **Proof.** `frames.json`/golden frames show labels inside the car sprites (`{}` placeholders).

## Gotchas

- Without the harness's forced-pipe, labels come from the current directory - never assert specific labels from a bare `sl` run.
- Cars hold ~22 display cells (16 for logo); longer fixture names intentionally truncate - assert 7-char prefixes.
- Use `pressSequentially` for the textarea: programmatic `fill()` never showed its labels on the cars in testing; real keystrokes did.
- After a messages change the current train does NOT redraw with new labels; the next train cycle does (the fly checkbox forces the restart).

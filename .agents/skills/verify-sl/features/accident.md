# Accident mode

With `--accident` (CLI) or `accident=true` (embed) the train crashes: little ASCII people appear below the car windows crying `Help!`, and the CLI also lists hidden files.

## Sub-features

- `acc-cli` - `sl --accident` renders `Help!` figures while the train scrolls.
- `acc-web` - embed with `accident=true` renders the same figures.
- `acc-absent` - without the flag, no `Help!` ever appears.
- `acc-home` - the home page `Accident` checkbox (defaults to checked on the demo).

## How to get to it (user POV)

- Run `sl -a` / `sl --accident` in a terminal.
- Open `/sl/embed.html?accident=true`.
- Tick/untick the `Accident` checkbox (`#accident-checkbox`) on the demo home page.

## Driving it with verify-sl scripts

Preconditions: doctor passes.

- **CLI present.** Run `record-cast.sh d51-accident` then `check-invariants.py <dir>/sl.cast --scenario d51-accident`; the `accident: people cry for help` invariant passes (`Help!` present in frames).
- **CLI absent.** Run `record-cast.sh d51` then invariants with `--scenario d51`; `no accident figures without --accident` passes.
- **Web present.** Run `bun .agents/skills/verify-sl/scripts/web-verify.mjs embed-accident`; the accident check passes against pumped frames.
- **Proof.** Each run leaves `sl.cast` / `frames.json` under `evidence/` showing the figures between the car wheels.

## Gotchas

- `Help!` is the only reliable marker; `(O)` and `\O/` also exist inside train sprites.
- `Help!` flickers (alternates with `(O) \O/` every 12 columns) - scan across the whole recording, not a single frame.
- CLI accident mode lists dotfiles by default; the harness pipes `fixtures/cars.txt` anyway, so labels stay deterministic.

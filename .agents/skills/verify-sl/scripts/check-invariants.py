#!/usr/bin/env python3
"""Behavioral invariants for one sl CLI cast (no golden files needed).

Usage: check-invariants.py <cast> --scenario d51|d51-accident|c51|logo|fly

Checks the real user-visible guarantees: correct locomotive art, wheel
animation running, the train scrolling left and exiting, passenger-car labels
rendered, and (for the accident scenario) people crying for help.
Exit code 0 = all invariants hold; 1 = at least one failed.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from castgrid import sampled_frames  # noqa: E402

# Distinctive substrings taken from the sprite constants in libraries/libsl/src/.
ART = {
    "d51": ["_D _|", "\\O=====O=====O=====O_/", "O=====O=====O=====O   |"],
    "c51": ["D__/", "O=======O=======O", "\\_/  \\____/  \\____/"],
    "logo": ["+------", "/---------", "\\_O========O", "/O========O"],
}
ART["d51-accident"] = ART["d51"]
ART["fly"] = ART["d51"]
# Wheel animation needs BOTH alternating engine frames present across the run.
# Each pair above occurs in exactly ONE engine sprite frame (verified against
# libraries/libsl/src/{d51,c51,logo}.rs), so seeing BOTH in a recording proves the
# wheels actually changed pose; a frozen train cannot pass.
WHEEL_ANIMATION = {
    "d51": ["\\O=====O=====O=====O_/", "O=====O=====O=====O   |"],
    "c51": ["/~\\____|___|/~\\_|  O=======O=======O", "/~\\____|___|/~\\_|    O=======O=======O "],
    "logo": ["/O========O", "\\_O========O"],
}
WHEEL_ANIMATION["d51-accident"] = WHEEL_ANIMATION["d51"]
WHEEL_ANIMATION["fly"] = WHEEL_ANIMATION["d51"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cast")
    parser.add_argument("--scenario", required=True, choices=sorted(ART))
    args = parser.parse_args()

    # Sample densely (but byte-offset-stably) so short-lived art is not missed.
    _header, _steps, frames = sampled_frames(args.cast, count=400)
    if len(frames) < 2:
        print("FAIL cast produced no frames (empty capture)")
        sys.exit(1)
    full = "\n".join("\n".join(frame) for frame in frames)
    first, last = frames[0], frames[-1]
    content_rows = [index for index, row in enumerate(first) if row.strip()]
    results = []

    art = ART[args.scenario]
    results.append(("locomotive art present", art[0] in full))
    results.append(("wheel animation alternates", all(part in full for part in WHEEL_ANIMATION[args.scenario])))

    cars = []
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fixtures", "cars.txt")) as handle:
        cars = [line.strip() for line in handle if line.strip()]
    short = {name[:7] for name in cars}
    found = {label for label in short if label in full}
    results.append(("car labels visible (>=2 of %d, 7-char prefix)" % len(cars), len(found) >= 2))

    if args.scenario == "d51-accident":
        # "(O)" alone appears in the logo sprite; "Help!" is the unique accident marker.
        results.append(("accident: people cry for help", "Help!" in full))
    elif args.scenario == "fly":
        fly_low = any(
            any(row.strip() for row in frame[20:]) and not any(row.strip() for row in frame[:6])
            for frame in frames[:80]
        )
        results.append(("fly: train starts low on screen", fly_low))
    else:
        no_accident = "Help!" not in full
        results.append(("no accident figures without --accident", no_accident))

    # Scroll check: with full-width cars piped in, the leftmost content column
    # must strictly decrease over the run and the screen must clear at the end.
    def leftmost(frame):
        for row in frame:
            stripped = row.rstrip()
            if stripped:
                return len(stripped) - len(stripped.lstrip())
        return None

    # Event 0 is just the cursor-hide; use the first frame that has content.
    head_start = next((leftmost(frame) for frame in frames if leftmost(frame) is not None), None)
    results.append(("train enters from the right edge", head_start is not None and head_start >= 60))
    tail_clear = not any(row.strip() for row in last)
    results.append(("train exits left (final screen empty)", tail_clear))
    # The head edge is the '_' of row art; instead prove leftward travel by the
    # car-label position moving from right to left over the recording.
    label = cars[0][:7]
    # Position is (row, column) within the frame; a flattened blob offset would
    # let per-row rstrip() noise masquerade as horizontal movement.
    def label_position(frame):
        for row_index, row in enumerate(frame):
            column = row.find(label)
            if column >= 0:
                return (row_index, column)
        return None

    positions = [p for p in (label_position(frame) for frame in frames) if p is not None]
    moved_left = len(positions) > 20 and positions[0][1] - positions[-1][1] >= 40
    if args.scenario != "fly":
        # Flat scroll: the label must hold one sprite row, otherwise the column
        # delta could come from comparing different rows. In fly mode the train
        # legitimately rises, so only the horizontal delta is meaningful.
        moved_left = moved_left and positions[0][0] == positions[-1][0]
    results.append(("car label travels right-to-left", moved_left))

    width = max((len(name) for name in ["train exits left (final screen empty)"] + [r[0] for r in results]), default=10)
    failed = 0
    for name, ok in results:
        print("%s %s" % ("PASS" if ok else "FAIL", name.ljust(width)))
        failed += 0 if ok else 1
    print("%d/%d invariants hold (scenario=%s, %d steps)" % (
        len(results) - failed, len(results), args.scenario, len(frames)))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

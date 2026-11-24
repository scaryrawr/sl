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
from castgrid import completed_frames  # noqa: E402

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

SMOKE = [
    ["(   )", "(    )", "(    )", "(   )", "(  )", "(  )", "( )", "( )", "()", "()",
     "O", "O", "O", "O", "O", " "],
    ["(@@@)", "(@@@@)", "(@@@@)", "(@@@)", "(@@)", "(@@)", "(@)", "(@)", "@@", "@@",
     "@", "@", "@", "@", "@", " "],
]
DY = [2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
DX = [-2, -1, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3]


def expected_last_smoke_frame(cols, rows, frame_count, engine_height, funnel, fly, spawn_min):
    particles = []
    last_visible = None

    for frame in range(frame_count):
        train_x = cols - 1 - frame
        funnel_x = train_x + funnel
        if funnel_x % 4 == 0:
            aged = []
            for y, x, pattern, kind in particles:
                pattern += 1
                if pattern < 16:
                    aged.append((y - DY[pattern - 1], x + DX[pattern - 1], pattern, kind))
            particles = aged

            if spawn_min <= funnel_x <= cols:
                if fly:
                    quotient = abs(train_x) // 7
                    if train_x < 0:
                        quotient = -quotient
                    y = quotient + rows - cols // 7 - engine_height - 1
                else:
                    y = rows // 2 - engine_height // 2 - 1
                kind = ((cols - funnel_x) // 4) % 2
                particles.append((y, funnel_x, 0, kind))

        for y, x, pattern, kind in particles:
            if not 0 <= y < rows:
                continue
            visible = [
                char
                for index, char in enumerate(SMOKE[kind][pattern])
                if 0 <= x + index < cols
            ]
            if any(char in "(@)" for char in visible):
                last_visible = frame

    return last_visible


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cast")
    parser.add_argument("--scenario", required=True, choices=sorted(ART))
    args = parser.parse_args()

    header, frames, final_frame = completed_frames(args.cast)
    if len(frames) < 2:
        print("FAIL cast produced no frames (empty capture)")
        sys.exit(1)
    full = "\n".join("\n".join(frame) for frame in frames)
    last = final_frame
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

    # Use the first completed frame that has content.
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

    # Smoke lifecycle: once the engine has left the screen, its trail must
    # finish aging out instead of freezing mid-puff in the top rows.
    engine_geometry = {
        "d51": ("(_)", 2, 11, 7),
        "d51-accident": ("(_)", 2, 11, 7),
        "c51": ("(_)", 2, 12, 7),
        "logo": ("|+-+ |", 1, 7, 4),
        "fly": ("(_)", 2, 11, 7),
    }

    anchor, anchor_offset, engine_rows, funnel = engine_geometry[args.scenario]

    def engine_y(frame):
        for row_index, row in enumerate(frame):
            if anchor in row:
                return row_index - anchor_offset
        return None

    rows = header["term"]["rows"]
    cols = header["term"]["cols"]
    fallback_y = rows // 2 - engine_rows // 2
    smoke_visible = []
    last_engine_y = fallback_y
    for frame in frames:
        frame_engine_y = engine_y(frame)
        if frame_engine_y is not None:
            last_engine_y = frame_engine_y
        smoke_visible.append(any(
            ch in "(@)"
            for row in frame[
                max(0, last_engine_y - 7):max(0, last_engine_y + 1)
            ]
            for ch in row
        ))

    engine_seen = [engine_y(frame) is not None for frame in frames]
    if not any(engine_seen):
        raise ValueError("capture has no identifiable engine for smoke lifecycle verification")
    last_engine = max(i for i, seen in enumerate(engine_seen) if seen)
    # A puff lives 16 emissions, one every four train columns. The funnel can
    # emit for four more column groups after crossing the left edge, because
    # those puffs can still drift back into view.
    settle = 20 * 4
    if last_engine + settle >= len(frames):
        raise ValueError("capture has no post-engine frames to verify smoke clearing")
    last_puff = max(
        (i for i, visible in enumerate(smoke_visible) if visible),
        default=None,
    )
    expected_last_puff = expected_last_smoke_frame(
        cols, rows, len(frames), engine_rows, funnel, args.scenario == "fly", -16
    )
    old_last_puff = expected_last_smoke_frame(
        cols, rows, len(frames), engine_rows, funnel, args.scenario == "fly", 0
    )
    if expected_last_puff != old_last_puff:
        results.append((
            "smoke follows engine off screen",
            last_puff == expected_last_puff,
        ))
    tail_rows_clear = all(
        not visible
        for visible in smoke_visible[last_engine + settle:]
    )
    results.append(("smoke trail clears after the engine exits", tail_rows_clear))

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

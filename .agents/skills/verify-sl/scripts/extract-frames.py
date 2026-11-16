#!/usr/bin/env python3
"""Sample deterministic frames from an sl cast and compare them to a golden file.

Usage:
  extract-frames.py <cast> --out-dir DIR            # dump sampled frames as text
  extract-frames.py <cast> --golden PATH [--update] # compare with (or create/update) golden

Goldens store completed frame indices, grids, frame count, and the final screen.
Comparisons reuse the baseline's indices, independent of output length or recorder
chunking. Incomplete captures and changed animation lengths fail explicitly.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from castgrid import completed_frames  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cast")
    parser.add_argument("--out-dir")
    parser.add_argument("--golden")
    parser.add_argument("--update", action="store_true")
    parser.add_argument("--frames", type=int, default=12)
    args = parser.parse_args()

    if args.frames < 1:
        parser.error("--frames must be positive")
    header, all_frames, final_frame = completed_frames(args.cast)
    expected = None
    if args.golden and os.path.exists(args.golden):
        with open(args.golden) as handle:
            expected = json.load(handle)
        if expected.get("version") != 2:
            parser.error("legacy byte-offset golden: migrate from a trusted baseline capture")
        steps = expected["steps"]
    else:
        count = min(args.frames, len(all_frames))
        steps = ([len(all_frames) - 1] if count == 1 else [
            index * (len(all_frames) - 1) // (count - 1) for index in range(count)
        ])
    if any(step < 0 or step >= len(all_frames) for step in steps):
        parser.error("capture is missing baseline frame indices (recording truncated?)")
    frames = [all_frames[step] for step in steps]

    if args.out_dir:
        os.makedirs(args.out_dir, exist_ok=True)
        for step, frame in zip(steps, frames):
            with open(os.path.join(args.out_dir, "frame-%08d.txt" % step), "w") as handle:
                handle.write("\n".join(frame) + "\n")
        print("wrote %d frames to %s" % (len(frames), args.out_dir))

    if args.golden:
        payload = {
            "version": 2,
            "cols": header["term"]["cols"],
            "rows": header["term"]["rows"],
            "frame_count": len(all_frames),
            "steps": steps,
            "frames": frames,
            "final_frame": final_frame,
        }
        if not os.path.exists(args.golden):
            os.makedirs(os.path.dirname(args.golden) or ".", exist_ok=True)
            with open(args.golden, "w") as handle:
                json.dump(payload, handle, indent=1)
            print("created golden %s (%d frames)" % (args.golden, len(frames)))
        elif args.update:
            with open(args.golden, "w") as handle:
                json.dump(payload, handle, indent=1)
            print("updated golden %s (%d frames)" % (args.golden, len(frames)))
        else:
            problems = []
            if expected["cols"] != payload["cols"] or expected["rows"] != payload["rows"]:
                problems.append("terminal size differs: golden %dx%d vs run %dx%d" % (
                    expected["cols"], expected["rows"], payload["cols"], payload["rows"]))
            if expected["frame_count"] != payload["frame_count"]:
                problems.append("animation frame count differs: golden %d vs run %d" % (
                    expected["frame_count"], payload["frame_count"]))
            for step, got, want in zip(payload["steps"], payload["frames"], expected["frames"]):
                if got != want:
                    first_row = next(
                        (r for r, (a, b) in enumerate(zip(got, want)) if a != b), 0)
                    problems.append("completed frame %d differs (first on row %d)" % (step, first_row))
            if expected["final_frame"] != final_frame:
                problems.append("final screen differs")
            if problems:
                print("GOLDEN MISMATCH (%d problems):" % len(problems))
                for problem in problems:
                    print("  - " + problem)
                sys.exit(1)
            print("golden OK (%d frames match)" % len(expected["frames"]))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Sample deterministic frames from an sl cast and compare them to a golden file.

Usage:
  extract-frames.py <cast> --out-dir DIR            # dump sampled frames as text
  extract-frames.py <cast> --golden PATH [--update] # compare with (or create/update) golden

Golden files are JSON: {cols, rows, output_bytes, steps (byte offsets), frames}.
Frames are sampled at fixed output-byte offsets (see castgrid.py), so results do
not depend on how the recorder chunks the stream. Exit code 1 on any mismatch,
including an empty or length-changed capture; created/unchanged/compared status
on stdout.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from castgrid import sampled_frames  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cast")
    parser.add_argument("--out-dir")
    parser.add_argument("--golden")
    parser.add_argument("--update", action="store_true")
    parser.add_argument("--frames", type=int, default=12)
    args = parser.parse_args()

    header, steps, frames = sampled_frames(args.cast, args.frames)

    if args.out_dir:
        os.makedirs(args.out_dir, exist_ok=True)
        for step, frame in zip(steps, frames):
            with open(os.path.join(args.out_dir, "frame-%08d.txt" % step), "w") as handle:
                handle.write("\n".join(frame) + "\n")
        print("wrote %d frames to %s" % (len(frames), args.out_dir))

    if args.golden:
        payload = {
            "cols": header["term"]["cols"],
            "rows": header["term"]["rows"],
            "output_bytes": steps[-1],
            "steps": steps,
            "frames": frames,
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
            with open(args.golden) as handle:
                expected = json.load(handle)
            problems = []
            if expected["cols"] != payload["cols"] or expected["rows"] != payload["rows"]:
                problems.append("terminal size differs: golden %dx%d vs run %dx%d" % (
                    expected["cols"], expected["rows"], payload["cols"], payload["rows"]))
            # An incomplete capture must fail loudly instead of comparing fewer frames.
            if len(expected["frames"]) != len(payload["frames"]):
                problems.append("sampled frame count differs: golden %d vs run %d (recording truncated?)" % (
                    len(expected["frames"]), len(payload["frames"])))
            if expected["steps"] != payload["steps"]:
                problems.append("sampled byte offsets differ: output stream changed "
                                "(golden %d bytes total, run %d)" % (
                                    expected["output_bytes"], payload["output_bytes"]))
            for step, got, want in zip(payload["steps"], payload["frames"], expected["frames"]):
                if got != want:
                    first_row = next(
                        (r for r, (a, b) in enumerate(zip(got, want)) if a != b), 0)
                    problems.append("frame at byte offset %d differs (first on row %d)" % (step, first_row))
            if problems:
                print("GOLDEN MISMATCH (%d problems):" % len(problems))
                for problem in problems:
                    print("  - " + problem)
                sys.exit(1)
            print("golden OK (%d frames match)" % len(expected["frames"]))


if __name__ == "__main__":
    main()

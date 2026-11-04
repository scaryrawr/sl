#!/usr/bin/env python3
"""Sample deterministic frames from an sl cast and compare them to a golden file.

Usage:
  extract-frames.py <cast> --out-dir DIR            # dump sampled frames as text
  extract-frames.py <cast> --golden PATH [--update] # compare with (or create/update) golden

Golden files are JSON: {cols, rows, sample_step, steps: [...], frames: [[rows...], ...]}.
Exit code 1 on mismatch; created/unchanged/compared status on stdout.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from castgrid import even_sample, grid_from_cast, load_cast  # noqa: E402


def sampled(cast_path, count):
    header, _events = load_cast(cast_path)
    frames = grid_from_cast(cast_path)
    indices = even_sample(frames, count)
    return header, frames, indices


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cast")
    parser.add_argument("--out-dir")
    parser.add_argument("--golden")
    parser.add_argument("--update", action="store_true")
    parser.add_argument("--frames", type=int, default=12)
    args = parser.parse_args()

    header, frames, indices = sampled(args.cast, args.frames)

    if args.out_dir:
        os.makedirs(args.out_dir, exist_ok=True)
        for index in indices:
            with open(os.path.join(args.out_dir, "frame-%03d.txt" % index), "w") as handle:
                handle.write("\n".join(frames[index]) + "\n")
        print("wrote %d frames to %s" % (len(indices), args.out_dir))

    if args.golden:
        payload = {
            "cols": header["term"]["cols"],
            "rows": header["term"]["rows"],
            "sample_step": len(frames) // max(len(indices), 1),
            "steps": indices,
            "frames": [frames[index] for index in indices],
        }
        if not os.path.exists(args.golden):
            os.makedirs(os.path.dirname(args.golden), exist_ok=True)
            with open(args.golden, "w") as handle:
                json.dump(payload, handle, indent=1)
            print("created golden %s (%d frames)" % (args.golden, len(indices)))
        elif args.update:
            with open(args.golden, "w") as handle:
                json.dump(payload, handle, indent=1)
            print("updated golden %s (%d frames)" % (args.golden, len(indices)))
        else:
            with open(args.golden) as handle:
                expected = json.load(handle)
            problems = []
            if expected["cols"] != payload["cols"] or expected["rows"] != payload["rows"]:
                problems.append("terminal size differs: golden %dx%d vs run %dx%d" % (
                    expected["cols"], expected["rows"], payload["cols"], payload["rows"]))
            for position, (step, got, want) in enumerate(zip(
                    expected["steps"], payload["frames"], expected["frames"])):
                if got != want:
                    first_row = next(
                        (r for r, (a, b) in enumerate(zip(got, want)) if a != b), 0)
                    problems.append("frame at step %d differs (first on row %d)" % (step, first_row))
            if problems:
                print("GOLDEN MISMATCH (%d problems):" % len(problems))
                for problem in problems:
                    print("  - " + problem)
                sys.exit(1)
            print("golden OK (%d frames match)" % len(expected["frames"]))


if __name__ == "__main__":
    main()

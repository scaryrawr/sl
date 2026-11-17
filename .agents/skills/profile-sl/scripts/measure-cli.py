#!/usr/bin/env python3
"""Measure direct sl child CPU time through a fixed-size PTY."""

import argparse
import errno
import fcntl
import hashlib
import json
import os
import pty
import statistics
import struct
import termios
import time
from pathlib import Path


def run(binary: Path, columns: int, rows: int, args: list[str]) -> dict[str, float | int | str]:
    dimension = struct.pack("HHHH", rows, columns, 0, 0)
    child_pid, parent_fd = pty.fork()
    if child_pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, dimension)
        os.execv(str(binary), [str(binary), *args])

    os.set_blocking(parent_fd, True)

    digest = hashlib.sha256()
    byte_count = 0
    started = time.monotonic()
    while True:
        try:
            chunk = os.read(parent_fd, 65536)
        except OSError as error:
            if error.errno == errno.EIO:
                break
            raise
        if not chunk:
            break
        digest.update(chunk)
        byte_count += len(chunk)

    elapsed = time.monotonic() - started
    _, status, usage = os.wait4(child_pid, 0)
    os.close(parent_fd)
    if not os.WIFEXITED(status) or os.waitstatus_to_exitcode(status) != 0:
        raise RuntimeError(f"{binary} failed with wait status {status}")
    if byte_count == 0:
        raise RuntimeError(f"{binary} emitted no PTY output")

    return {
        "wall_s": elapsed,
        "cpu_s": usage.ru_utime + usage.ru_stime,
        "bytes": byte_count,
        "max_rss": usage.ru_maxrss,
        "sha256": digest.hexdigest(),
    }


def summarize(samples: list[dict[str, float | int | str]]) -> dict[str, object]:
    numeric = {}
    for key in ("wall_s", "cpu_s", "bytes", "max_rss"):
        values = [float(sample[key]) for sample in samples]
        numeric[key] = {
            "median": statistics.median(values),
            "min": min(values),
            "max": max(values),
        }
    return {
        **numeric,
        "distinct_output_hashes": len({sample["sha256"] for sample in samples}),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("binaries", type=Path, nargs="+", help="one baseline and optional candidate binary")
    parser.add_argument("--runs", type=int, default=7)
    parser.add_argument("--warmup", type=int, default=1)
    parser.add_argument("--columns", type=int, default=80)
    parser.add_argument("--rows", type=int, default=24)
    parser.add_argument("--sl-arg", action="append", default=[], dest="sl_args")
    parsed = parser.parse_args()
    if parsed.runs < 5:
        parser.error("--runs must be at least 5")
    if parsed.warmup < 1:
        parser.error("--warmup must be at least 1")
    if not parsed.sl_args:
        parsed.sl_args = ["--files"]
    for binary in parsed.binaries:
        if not binary.is_file():
            parser.error(f"binary does not exist: {binary}")
    return parsed


def main() -> None:
    args = parse_args()
    binaries = [binary.resolve() for binary in args.binaries]
    for _ in range(args.warmup):
        for binary in binaries:
            run(binary, args.columns, args.rows, args.sl_args)

    samples = {str(binary): [] for binary in binaries}
    for _ in range(args.runs):
        for binary in binaries:
            samples[str(binary)].append(run(binary, args.columns, args.rows, args.sl_args))

    report = {
        "columns": args.columns,
        "rows": args.rows,
        "sl_args": args.sl_args,
        "runs": args.runs,
        "warmup": args.warmup,
        "summary": {binary: summarize(values) for binary, values in samples.items()},
        "samples": samples,
    }
    all_hashes = {
        sample["sha256"]
        for values in samples.values()
        for sample in values
    }
    report["output_matches_across_sides"] = len(all_hashes) == 1
    print(json.dumps(report, indent=2))
    if len(all_hashes) != 1:
        raise SystemExit("PTY output hashes differ across sides")


if __name__ == "__main__":
    main()

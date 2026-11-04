#!/usr/bin/env python3
"""Reconstruct terminal grids from asciinema asciicast v2 files recorded from sl.

The sl CLI draws each animation step as a burst of "move cursor to (row, col)"
escape sequences followed by printable text, so full-screen snapshots can be
rebuilt without a complete VT emulator: every printable run is placed at the
current cursor position and later writes simply overwrite earlier ones.

This module is imported by extract-frames.py and check-invariants.py.
Key insight: the asciicast event stream contains exactly one "o" event per
sl animation step (one crossterm flush per step), so event index == step index.
"""

import json


def load_cast(path):
    """Return (header, events) from an asciicast v2 file; events are (delay, text)."""
    events = []
    with open(path, encoding="utf-8") as handle:
        header = json.loads(handle.readline())
        for line in handle:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            if event[1] == "o":
                events.append((event[0], event[2]))
    return header, events


class _Grid:
    """Cursor-tracking grid supporting exactly the escape sequences sl emits."""

    def __init__(self, cols, rows):
        self.cols = cols
        self.rows = rows
        self.cells = [[" "] * cols for _ in range(rows)]
        self.row = 0
        self.col = 0
        self._run = ""
        self._esc = ""  # partial escape sequence held across chunk boundaries

    def _flush(self):
        if not self._run:
            return
        for char in self._run:
            if 0 <= self.row < self.rows and 0 <= self.col < self.cols:
                self.cells[self.row][self.col] = char
            self.col += 1
        self._run = ""

    def feed(self, text):
        if self._esc:
            text = self._esc + text
            self._esc = ""
        index = 0
        while index < len(text):
            char = text[index]
            if char == "\x1b":
                self._flush()
                index = self._escape(text, index)
            elif char == "\r":
                self._flush()
                self.col = 0
                index += 1
            elif char == "\n":
                self._flush()
                self.row = min(self.row + 1, self.rows - 1)
                index += 1
            elif char == "\x08":
                self._flush()
                self.col = max(0, self.col - 1)
                index += 1
            else:
                self._run += char
                index += 1
        self._flush()

    def _escape(self, text, index):
        """Consume the escape sequence at `index`; return the index past it.

        Asciicast chunks split crossterm writes at arbitrary byte boundaries, so a
        sequence can be cut mid-parameters. Incomplete tails are stashed in _esc and
        re-fed with the next chunk instead of leaking into the grid.
        """
        if index + 1 >= len(text):
            self._esc = text[index:]
            return len(text)
        if text[index + 1] != "[":
            end = index + 1
            while end < len(text) and text[end] not in "\x07\x1b":
                end += 1
            if end >= len(text) and text[-1] != "\x07":
                self._esc = text[index:]  # OSC still running at chunk end
                return len(text)
            return min(end + 1, len(text))
        position = index + 2
        params = ""
        while position < len(text) and (text[position].isdigit() or text[position] in ";?<>"):
            params += text[position]
            position += 1
        if position >= len(text):
            self._esc = text[index:]  # CSI cut before its final byte
            return len(text)
        final = text[position]
        position += 1
        if final in "Hf":
            numbers = [int(part) for part in params.split(";") if part]
            self.row = (numbers[0] - 1) if len(numbers) >= 1 else 0
            self.col = (numbers[1] - 1) if len(numbers) >= 2 else 0
        elif final == "J" and params == "2":
            self.cells = [[" "] * self.cols for _ in range(self.rows)]
        # Cursor show/hide, SGR colors, and mode sets do not affect the character grid.
        return position

    def snapshot(self):
        return ["".join(row).rstrip() for row in self.cells]


def grid_from_cast(path, sample_every=1):
    """Return one N x M string frame per sampled event of the cast."""
    header, events = load_cast(path)
    grid = _Grid(header["term"]["cols"], header["term"]["rows"])
    frames = []
    for index, (_delay, data) in enumerate(events):
        grid.feed(data)
        if index % sample_every == 0:
            frames.append(grid.snapshot())
    return frames


def final_frame(path):
    """Return the single grid after the whole recording."""
    return grid_from_cast(path, sample_every=10**9)[-1]


def even_sample(frames, count):
    """Return evenly spread frame indices over the run, always including the last."""
    if count >= len(frames):
        return list(range(len(frames)))
    return sorted({round(step * (len(frames) - 1) / (count - 1)) for step in range(count)})

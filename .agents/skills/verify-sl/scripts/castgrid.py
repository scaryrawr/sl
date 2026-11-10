#!/usr/bin/env python3
"""Reconstruct terminal grids from asciinema asciicast v2 files recorded from sl.

The sl CLI draws each animation step as a burst of "move cursor to (row, col)"
escape sequences followed by printable text, so full-screen snapshots can be
rebuilt without a complete VT emulator: every printable run is placed at the
current cursor position and later writes simply overwrite earlier ones.

This module is imported by extract-frames.py and check-invariants.py.
Snapshots are taken only at synchronized-output end markers emitted by the CLI.
Neither recorder chunks nor the number of terminal writes define a frame.
"""

import json


def load_cast(path):
    """Return normalized terminal dimensions and output from asciicast v2/v3."""
    events = []
    with open(path, encoding="utf-8") as handle:
        header = json.loads(handle.readline())
        if header["version"] == 2:
            header["term"] = {"cols": header["width"], "rows": header["height"]}
        elif header["version"] != 3:
            raise ValueError("unsupported asciicast version")
        for line in handle:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            if event[1] == "o":
                events.append((event[0], event[2]))
            elif event[1] == "r":
                raise ValueError("terminal resized during capture")
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
        self.frames = []
        self.in_frame = False
        self.cleanup_clear = False
        self.finished = False

    def _flush(self):
        if not self._run:
            return
        for char in self._run:
            if 0 <= self.row < self.rows and 0 <= self.col < self.cols:
                self.cells[self.row][self.col] = char
            self.col += 1
        self._run = ""

    def feed(self, text):
        if self.finished and text:
            raise ValueError("output after terminal cleanup")
        if self._esc:
            text = self._esc + text
            self._esc = ""
        index = 0
        while index < len(text):
            if self.finished:
                raise ValueError("output after terminal cleanup")
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
            elif char == "\x00":
                # sl writes NUL-padded 256-byte car buffers; terminals ignore NUL
                # without moving the cursor, so do the same.
                self._flush()
                index += 1
            else:
                if not self.in_frame:
                    raise ValueError("text outside a synchronized frame")
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
        if params == "?2026" and final == "h":
            if self.in_frame:
                raise ValueError("nested synchronized frame")
            self.in_frame = True
            self.cleanup_clear = False
        elif params == "?2026" and final == "l":
            if not self.in_frame:
                raise ValueError("synchronized frame ended without a begin marker")
            self.frames.append(self.snapshot())
            self.in_frame = False
        elif params == "?25" and final == "h":
            if self.in_frame or not self.frames or not self.cleanup_clear:
                raise ValueError("cursor restored without completed frames and cleanup")
            self.finished = True
        elif final in "Hf":
            if not self.in_frame:
                raise ValueError("cursor move outside a synchronized frame")
            numbers = [int(part) for part in params.split(";") if part]
            self.row = (numbers[0] - 1) if len(numbers) >= 1 else 0
            self.col = (numbers[1] - 1) if len(numbers) >= 2 else 0
        elif final == "J" and params == "2":
            self.cells = [[" "] * self.cols for _ in range(self.rows)]
            self.cleanup_clear = not self.in_frame
        # Cursor show/hide, SGR colors, and mode sets do not affect the character grid.
        return position

    def snapshot(self):
        return ["".join(row).rstrip() for row in self.cells]


def completed_frames(path):
    """Return (header, completed animation grids, final grid) or reject truncation."""
    header, events = load_cast(path)
    grid = _Grid(header["term"]["cols"], header["term"]["rows"])
    for _delay, data in events:
        grid.feed(data)
    if grid._esc or grid.in_frame or not grid.frames or not grid.finished:
        raise ValueError("incomplete capture: need completed synchronized frames and terminal cleanup")
    return header, grid.frames, grid.snapshot()

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from castgrid import completed_frames


BEGIN = "\x1b[?2026h"
END = "\x1b[?2026l"
CLEANUP = "\x1b[2J\x1b[?25h"


def frame(text):
    return BEGIN + "\x1b[1;1H" + text + END


class CompletedFramesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.cast = Path(self.directory.name) / "sl.cast"
        self.golden = Path(self.directory.name) / "golden.json"

    def write_cast(self, chunks, version=2):
        header = ({"version": 2, "width": 8, "height": 2} if version == 2 else {
            "version": 3, "term": {"cols": 8, "rows": 2},
        })
        events = [[index / 100, "o", text] for index, text in enumerate(chunks)]
        self.cast.write_text("\n".join(json.dumps(item) for item in [header, *events]) + "\n")
        return completed_frames(self.cast)

    def extract(self, *args):
        return subprocess.run(
            [sys.executable, str(Path(__file__).with_name("extract-frames.py")),
             str(self.cast), "--golden", str(self.golden), *args],
            capture_output=True, text=True,
        )

    def test_only_completed_redraws_are_captured(self):
        _, frames, final = self.write_cast([frame("AB") + frame("CD") + CLEANUP])
        self.assertEqual(frames, [["AB", ""], ["CD", ""]])
        self.assertEqual(final, ["", ""])

    def test_every_transport_split_produces_the_same_frames(self):
        stream = frame("AB") + frame("CD") + CLEANUP
        expected = self.write_cast([stream])
        for split in range(1, len(stream)):
            with self.subTest(split=split):
                self.assertEqual(self.write_cast([stream[:split], stream[split:]]), expected)
        self.assertEqual(self.write_cast(list(stream)), expected)

    def test_v3_and_v2_have_the_same_dimensions_and_frames(self):
        stream = frame("AB") + CLEANUP
        header, frames, final = self.write_cast([stream])
        v3_header, v3_frames, v3_final = self.write_cast([stream], version=3)
        self.assertEqual(header["term"], v3_header["term"])
        self.assertEqual((frames, final), (v3_frames, v3_final))

    def test_truncation_at_every_offset_is_rejected(self):
        stream = frame("AB") + CLEANUP
        for length in range(len(stream)):
            with self.subTest(length=length), self.assertRaises(ValueError):
                self.write_cast([stream[:length]])

    def test_invalid_frame_boundaries_are_rejected(self):
        for stream in [END + CLEANUP, BEGIN + BEGIN + END + CLEANUP,
                       "AB" + CLEANUP, frame("AB") + "\x1b[?25h",
                       frame("AB") + "\x1b[2J", frame("AB") + CLEANUP + BEGIN + END]:
            with self.subTest(stream=stream), self.assertRaises(ValueError):
                self.write_cast([stream])

    def test_golden_ignores_redundant_terminal_writes(self):
        self.write_cast([frame("AB") + frame("CD") + CLEANUP])
        result = self.extract()
        self.assertEqual(result.returncode, 0, result.stderr)
        redundant = "\x1b[2;1H\x00\x1b[1;1HAB"
        self.write_cast(list(frame(redundant) + frame("CD") + CLEANUP))
        result = self.extract()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_golden_detects_art_and_animation_length_changes(self):
        self.write_cast([frame("AB") + frame("CD") + CLEANUP])
        self.assertEqual(self.extract().returncode, 0)
        for stream in [frame("AB") + frame("XX") + CLEANUP,
                       frame("AB") + CLEANUP,
                       frame("AB") + frame("CD") + frame("CD") + CLEANUP]:
            with self.subTest(stream=stream):
                self.write_cast([stream])
                self.assertNotEqual(self.extract().returncode, 0)

    def test_comparison_reuses_baseline_positions(self):
        self.write_cast([frame(str(index)) for index in range(8)] + [CLEANUP])
        self.assertEqual(self.extract("--frames", "3").returncode, 0)
        before = self.golden.read_bytes()
        self.assertEqual(self.extract("--frames", "6").returncode, 0)
        self.assertEqual(self.golden.read_bytes(), before)

    def test_nonpositive_sample_count_is_rejected(self):
        self.write_cast([frame("AB") + CLEANUP])
        self.assertNotEqual(self.extract("--frames", "0").returncode, 0)

    def test_incomplete_capture_cannot_update_a_golden(self):
        self.write_cast([frame("AB") + CLEANUP])
        self.assertEqual(self.extract().returncode, 0)
        before = self.golden.read_bytes()
        self.cast.write_text(self.cast.read_text().rsplit("\n", 2)[0] + "\n")
        self.assertNotEqual(self.extract("--update").returncode, 0)
        self.assertEqual(self.golden.read_bytes(), before)

    def test_legacy_golden_cannot_be_silently_rebaselined(self):
        self.write_cast([frame("AB") + CLEANUP])
        before = b'{"cols": 8, "rows": 2, "output_bytes": 100, "steps": [100], "frames": []}'
        self.golden.write_bytes(before)
        result = self.extract("--update")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("migrate from a trusted baseline", result.stderr)
        self.assertEqual(self.golden.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()

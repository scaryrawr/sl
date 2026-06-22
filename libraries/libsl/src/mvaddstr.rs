//! Screen-coordinate text rendering with clipping.
//!
//! [`mvaddstr`] draws a string at a given `(y, x)` position, automatically clipping
//! graphemes that fall outside the [`crate::ScreenSize`]. It also handles negative `x`
//! by stripping leading graphemes and filling the gap with spaces.

use core::str;

use unicode_segmentation::UnicodeSegmentation;

use crate::{RenderTarget, ScreenSize};

use super::unicode_width::UnicodeWidthStr;

/// Draw `line` at position `(y, x)`, clipping any content that falls outside `screen`.
///
/// Graphemes that extend beyond the right, left, or bottom edges of the screen are
/// stripped. If `x` is negative, leading graphemes are removed and the gap is filled
/// with space characters so the text aligns correctly at column 0.
///
/// # Arguments
///
/// * `y` – Row (line) position.
/// * `x` – Column position (may be negative).
/// * `line` – The string to draw.
/// * `screen` – Dimensions of the drawable area.
/// * `target` – The render destination.
///
/// # Returns
///
/// `Ok(())` on success, or the render target's error if `draw_str` fails.
pub fn mvaddstr<T: RenderTarget>(
    y: i32,
    x: i32,
    line: &str,
    screen: ScreenSize,
    target: &mut T,
) -> Result<(), T::Error> {
    // Vertically off screen
    if y < 0 || y >= screen.lines || x >= screen.columns || screen.columns <= 0 {
        return Ok(());
    }

    let mut line = line;
    let end_position = x + (line.width() as i32);

    // Everything is off screen to the left
    if end_position < 0 {
        return Ok(());
    }

    let mut x = x;
    let leading_spaces = if x < 0 {
        // Remove everything that will be off the screen to the left
        for c in line.graphemes(true) {
            let c_width = c.width() as i32;
            x += c_width;
            line = &line[c.len()..];
            if x >= 0 {
                break;
            }
        }

        let spaces = x;
        x = 0;
        spaces
    } else {
        0
    };

    // Remove everything that would be offscreen to the right
    let mut past_end = end_position - screen.columns;
    if past_end > 0 {
        for c in line.graphemes(true).rev() {
            let c_width = c.width() as i32;
            line = &line[..line.len() - c.len()];
            past_end -= c_width;
            if past_end <= 0 {
                break;
            }
        }
    }

    for _ in 0..leading_spaces {
        target.draw_str(y, x, " ")?;
        x += 1;
    }

    target.draw_str(y, x, line)
}

#[cfg(test)]
mod tests {
    use std::{string::String, vec::Vec};

    use super::*;

    #[derive(Debug, Eq, PartialEq)]
    enum TestError {
        Failed,
    }

    #[derive(Default)]
    struct RecordingTarget {
        writes: Vec<(i32, i32, String)>,
        fail: bool,
    }

    impl RenderTarget for RecordingTarget {
        type Error = TestError;

        fn draw_str(&mut self, line: i32, column: i32, value: &str) -> Result<(), Self::Error> {
            if self.fail {
                return Err(TestError::Failed);
            }

            self.writes.push((line, column, String::from(value)));
            Ok(())
        }
    }

    #[test]
    fn clips_text_off_the_left_edge() {
        let mut target = RecordingTarget::default();

        mvaddstr(1, -2, "abcd", ScreenSize::new(10, 3), &mut target).unwrap();

        assert_eq!(target.writes, [(1, 0, String::from("cd"))]);
    }

    #[test]
    fn clips_text_off_the_right_edge() {
        let mut target = RecordingTarget::default();

        mvaddstr(1, 8, "abcd", ScreenSize::new(10, 3), &mut target).unwrap();

        assert_eq!(target.writes, [(1, 8, String::from("ab"))]);
    }

    #[test]
    fn skips_text_below_the_bottom_edge() {
        let mut target = RecordingTarget::default();

        mvaddstr(3, 0, "abcd", ScreenSize::new(10, 3), &mut target).unwrap();

        assert!(target.writes.is_empty());
    }

    #[test]
    fn propagates_target_errors() {
        let mut target = RecordingTarget {
            fail: true,
            ..RecordingTarget::default()
        };

        assert_eq!(
            mvaddstr(1, 0, "abcd", ScreenSize::new(10, 3), &mut target),
            Err(TestError::Failed)
        );
    }
}

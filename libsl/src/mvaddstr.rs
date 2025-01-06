use core::str;

use unicode_segmentation::UnicodeSegmentation;

use super::unicode_width::UnicodeWidthStr;
use super::{COLS, LINES};

pub fn mvaddstr(y: i32, x: i32, line: &str, add_str: fn(i32, i32, &str)) {
    // Vertically off screen
    if y < 0 || y > unsafe { LINES } || x > unsafe { COLS } {
        return;
    }

    let mut line = line;
    let end_position = x + (line.width() as i32);

    // Everything is off screen to the left
    if end_position < 0 {
        return;
    }

    let mut x = x;
    let leading_spaces = if x < 0 {
        // Remove everything that will be off the screen to the left
        for c in line.graphemes(true) {
            let c_width = c.width() as i32;
            x += c_width;
            line = &line[c.len()..];
            if !(x < 0) {
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
    let mut past_end = end_position - unsafe { COLS };
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
        add_str(y, x, " ");
        x += 1;
    }

    add_str(y, x, line);
}

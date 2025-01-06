use std::{
    io::{stdout, Error},
    vec,
};

use crossterm::{cursor, style::Print, QueueableCommand};
use unicode_segmentation::UnicodeSegmentation;

use super::unicode_width::UnicodeWidthStr;
use super::{COLS, LINES};

pub fn mvaddstr(y: i32, x: i32, str: &str) -> Result<(), Error> {
    // Vertically off screen
    if y < 0 || y > unsafe { LINES } || x > unsafe { COLS } {
        return Ok(());
    }

    // The number of characters is the expected width to take up, but that is possibly incorrect, so we need
    // to make a fitting string.
    let mut buffer: String = str.to_string();
    let mut clusters: Vec<&str> = buffer.graphemes(true).collect();

    let end_position = x + (buffer.width() as i32);

    // Everything is off screen to the left
    if end_position < 0 {
        return Ok(());
    }

    let mut x = x;
    // Remove everything that will be off the screen to the left
    if x < 0 {
        if let Some(position) = clusters.iter().enumerate().find_map(|(i, c)| {
            if x >= 0 {
                return Some(i);
            }

            // we want the beginning of the next character, so we increment after checking x
            let c_width = c.width() as i32;
            x += c_width;
            None
        }) {
            clusters.splice(0..position, std::iter::empty());
        } else {
            return Err(Error::new(
                std::io::ErrorKind::InvalidInput,
                "Out of bounds",
            ));
        }

        if x > 0 {
            // Pad with leading spaces
            let mut temp = vec![" "; x as usize];
            temp.append(&mut clusters);
            clusters = temp;
            x = 0;
        }
    }

    // Remove everything that would be offscreen to the right
    let mut past_end = end_position - unsafe { COLS };
    if past_end > 0 {
        if let Some(position) = clusters.iter().enumerate().rev().find_map(|(i, c)| {
            let c_width = c.width() as i32;
            // We want to get the front of the current character, so decrement before checking past_end
            past_end -= c_width;
            if past_end <= 0 {
                return Some(i);
            }

            None
        }) {
            clusters.splice(position..(clusters.len()), std::iter::empty());
        } else {
            // Unable to fit on screen.
            return Ok(());
        }
    }

    let mut stdout = stdout();
    stdout.queue(cursor::MoveTo(x as u16, y as u16))?;

    buffer = clusters.join("");
    stdout.queue(Print(buffer))?;

    Ok(())
}

use core::{cmp::min, str};

use super::unicode_width::UnicodeWidthStr;
use unicode_segmentation::UnicodeSegmentation;

pub fn print_car(buffer: &mut [u8], format: &str, text: &str, text_display_width: usize) {
    // No format string, just copy text
    if !format.contains("{}") {
        let copy_len = min(format.len(), buffer.len() - 1);
        buffer[0..copy_len].copy_from_slice(format.as_bytes());
        buffer[copy_len] = 0;
        return;
    }

    // Copy the format string up to the first {}
    let mut format_iter = format.split("{}");
    let first = format_iter.next().unwrap();
    let mut end_pos = min(first.len(), buffer.len() - 1);
    buffer[0..end_pos].copy_from_slice(first.as_bytes());

    // Copy the car text
    let car_text = car_text(buffer.len() - (format.len() - 2), text_display_width, text);
    let start_pos = end_pos;
    end_pos = start_pos + car_text.len();
    buffer[start_pos..end_pos].copy_from_slice(car_text.as_bytes());

    // Add spaces for missing width if car_text is less than text_display_width
    if car_text.width() < text_display_width {
        let start_pos = end_pos;
        end_pos = start_pos + text_display_width - car_text.width();
        buffer[start_pos..end_pos].copy_from_slice(" ".repeat(end_pos - start_pos).as_bytes());
    }

    // Copy the rest of the format string
    let last = format_iter.next().unwrap();
    let start_pos = end_pos;
    end_pos = start_pos + last.len();
    buffer[start_pos..end_pos].copy_from_slice(last.as_bytes());
    buffer[end_pos] = 0;
}

fn car_text<'a>(buffer_len: usize, text_display_width: usize, text: &'a str) -> &'a str {
    let mut working_text = text;

    // We need to remove clusters until we will fit in the buffer
    if working_text.width() > text_display_width || working_text.len() > buffer_len {
        for c in text.graphemes(true).rev() {
            working_text = &working_text[0..working_text.len() - c.len()];
            if !(working_text.len() > buffer_len || working_text.width() > text_display_width) {
                break;
            }
        }
    }

    working_text
}

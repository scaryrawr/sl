use crossterm::{cursor, style::Print, QueueableCommand};
use std::ffi::{c_char, CStr, CString};
use std::io::stdout;
use std::vec;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;
mod print_car;
mod unicode_width;

type PCSTR = *const c_char;

#[no_mangle]
pub static mut COLS: i32 = 0;
#[no_mangle]
pub static mut LINES: i32 = 0;

extern "C" {
    pub static mut ACCIDENT: i32;
    pub static mut FLY: i32;

    fn add_D51(current_column: i32, names: *const PCSTR, count: i32) -> i32;
    fn add_C51(current_column: i32, names: *const PCSTR, count: i32) -> i32;
    fn add_sl(current_column: i32, names: *const PCSTR, count: i32) -> i32;
}

pub fn print_d51<'a>(current_column: i32, names: &[&str]) -> i32 {
    let strings: Vec<_> = names.iter().map(|s| CString::new(*s).unwrap()).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_D51(current_column, pointers.as_ptr(), pointers.len() as i32) }
}

pub fn print_sl<'a>(current_column: i32, names: &[&str]) -> i32 {
    let strings: Vec<_> = names.iter().map(|s| CString::new(*s).unwrap()).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_sl(current_column, pointers.as_ptr(), pointers.len() as i32) }
}

pub fn print_c51<'a>(current_column: i32, names: &[&str]) -> i32 {
    let strings: Vec<_> = names.iter().map(|s| CString::new(*s).unwrap()).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_C51(current_column, pointers.as_ptr(), pointers.len() as i32) }
}

const OK: i32 = 0;
const ERR: i32 = -1;

#[no_mangle]
extern "C" fn my_mvaddstr(y: i32, x: i32, str: PCSTR) -> i32 {
    // Vertically off screen
    if y < 0 || y > unsafe { LINES } - 1 {
        return ERR;
    }

    // Everything is off the screen to the right
    if x >= unsafe { COLS } {
        return ERR;
    }

    // The number of characters is the expected width to take up, but that is possibly incorrect, so we need
    // to make a fitting string.
    let mut buffer: String = unsafe { CStr::from_ptr(str) }.to_string_lossy().to_string();
    let mut clusters: Vec<&str> = buffer.graphemes(true).collect();

    let end_position = x + (buffer.width() as i32);

    // Everything is off screen to the left
    if end_position < 0 {
        return ERR;
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
            return ERR;
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
            if past_end < 0 {
                return Some(i);
            }

            None
        }) {
            clusters.splice(position..(clusters.len() - 1), std::iter::empty());
        } else {
            return ERR;
        }
    }

    let mut stdout = stdout();
    match stdout.queue(cursor::MoveTo(x as u16, y as u16)) {
        Err(_) => return ERR,
        _ => {}
    }

    buffer = clusters.join("");
    match stdout.queue(Print(buffer)) {
        Ok(_) => return OK,
        Err(_) => return ERR,
    }
}

use crossterm::{cursor, style::Print, QueueableCommand};
use std::ffi::{c_char, c_int, c_uint, CStr, CString};
use std::io::stdout;
use std::vec;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;
mod unicode_width;

type PCSTR = *const c_char;

#[no_mangle]
pub static mut COLS: i32 = 0;
#[no_mangle]
pub static mut LINES: i32 = 0;

#[link(name = "sl", kind = "static")]
extern "C" {
    pub static mut ACCIDENT: c_int;
    pub static mut FLY: c_int;

    pub fn set_locale();
    fn add_D51(current_column: c_int, names: *const PCSTR, count: c_int) -> c_int;
    fn add_C51(current_column: c_int, names: *const PCSTR, count: c_int) -> c_int;
    fn add_sl(current_column: c_int, names: *const PCSTR, count: c_int) -> c_int;
}

pub fn print_d51<'a>(current_column: c_int, names: &[&str]) -> i32 {
    let strings: Vec<_> = names.iter().map(|s| CString::new(*s).unwrap()).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_D51(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

pub fn print_sl<'a>(current_column: c_int, names: &[&str]) -> i32 {
    let strings: Vec<_> = names.iter().map(|s| CString::new(*s).unwrap()).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_sl(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

pub fn print_c51<'a>(current_column: c_int, names: &[&str]) -> i32 {
    let strings: Vec<_> = names.iter().map(|s| CString::new(*s).unwrap()).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_C51(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

const OK: i32 = 0;
const ERR: i32 = -1;

#[no_mangle]
extern "C" fn print_car(
    buffer: *mut c_char,
    buffer_len: c_uint,
    format: PCSTR,
    text: PCSTR,
    text_display_width: c_uint,
) -> i32 {
    let format = match unsafe { CStr::from_ptr(format) }.to_str() {
        Ok(s) => s,
        Err(_) => return ERR,
    };

    // No format string, just copy text
    if !format.contains("{}") {
        let copy_len = std::cmp::min(format.len(), buffer_len as usize - 1);
        unsafe {
            std::ptr::copy_nonoverlapping(format.as_ptr(), buffer as *mut u8, copy_len);
            *buffer.add(copy_len) = 0;
        }
        return OK;
    }

    let text = match unsafe { CStr::from_ptr(text) }.to_str() {
        Ok(s) => s,
        Err(_) => return ERR,
    };

    let text_display_width = text_display_width as usize;

    let mut text_clusters: Vec<&str> = text.graphemes(true).collect();
    let mut working_text = text.to_string();
    let format_width = format.len() - 2;

    // We need to remove clusters until we will fit in the buffer
    if working_text.width() > text_display_width
        || working_text.len() + (text_display_width - working_text.width()) + format_width
            > buffer_len as usize
    {
        if let Some(start) = (0..text_clusters.len()).rev().find_map(|i| {
            let front_width = text_clusters[0..i].iter().map(|c| c.width()).sum::<usize>();
            if front_width < text_display_width {
                let front_len = text_clusters[0..i].iter().map(|c| c.len()).sum::<usize>();
                let extra_spaces = text_display_width - front_width;
                if front_len + extra_spaces + format_width < buffer_len as usize {
                    return Some(i);
                }
            }

            None
        }) {
            text_clusters.splice(start.., std::iter::empty());
        }

        working_text = text_clusters.join("");
    }

    let spaces = if working_text.width() < text_display_width {
        text_display_width - working_text.width()
    } else {
        0
    };

    working_text += " ".repeat(spaces).as_str();

    let format = format.replace("{}", working_text.as_str());
    let copy_len = std::cmp::min(format.len(), buffer_len as usize - 1);
    unsafe {
        std::ptr::copy_nonoverlapping(format.as_ptr(), buffer as *mut u8, copy_len);
        *buffer.add(copy_len) = 0;
    }
    return OK;
}

#[no_mangle]
extern "C" fn my_mvaddstr(y: c_int, x: c_int, str: PCSTR) -> i32 {
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

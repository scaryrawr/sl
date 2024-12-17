use crossterm::{cursor, style::Print, QueueableCommand};
use std::ffi::c_int;
use std::io::stdout;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};

mod unicode_width;

#[cfg(target_family = "windows")]
type SlChar = u16;
#[cfg(target_family = "unix")]
type SlChar = u32;

type SlStr = *const SlChar;

#[no_mangle]
pub static mut COLS: i32 = 0;
#[no_mangle]
pub static mut LINES: i32 = 0;

#[link(name = "sl", kind = "static")]
extern "C" {
    pub static mut ACCIDENT: c_int;
    pub static mut FLY: c_int;

    pub fn set_locale();
    fn add_D51(current_column: c_int, names: *const SlStr, count: c_int) -> c_int;
    fn add_C51(current_column: c_int, names: *const SlStr, count: c_int) -> c_int;
    fn add_sl(current_column: c_int, names: *const SlStr, count: c_int) -> c_int;
}

#[cfg(target_family = "windows")]
fn create_string(value: &str) -> widestring::U16CString {
    widestring::U16CString::from_str(value).unwrap()
}

#[cfg(target_family = "unix")]
fn create_string(value: &str) -> widestring::U32CString {
    widestring::U32CString::from_str(value).unwrap()
}

pub fn print_d51<'a, StringIterator>(current_column: c_int, names: StringIterator) -> i32
where
    StringIterator: IntoIterator<Item = &'a str>,
{
    let strings: Vec<_> = names.into_iter().map(|s| create_string(s)).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_D51(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

pub fn print_sl<'a, StringIterator>(current_column: c_int, names: StringIterator) -> i32
where
    StringIterator: IntoIterator<Item = &'a str>,
{
    let strings: Vec<_> = names.into_iter().map(|s| create_string(s)).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_sl(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

pub fn print_c51<'a, StringIterator>(current_column: c_int, names: StringIterator) -> i32
where
    StringIterator: IntoIterator<Item = &'a str>,
{
    let strings: Vec<_> = names.into_iter().map(|s| create_string(s)).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_C51(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

const OK: i32 = 0;
const ERR: i32 = -1;

#[cfg(target_family = "windows")]
type CCStr = widestring::U16CStr;
#[cfg(target_family = "unix")]
type CCStr = widestring::U32CStr;

#[no_mangle]
pub extern "C" fn my_mvaddstr(y: c_int, x: c_int, str: *const SlChar) -> i32 {
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
    let mut buffer: String = fit_train_car(unsafe { CCStr::from_ptr_str(str) });
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
            buffer = clusters.join("");
        } else {
            return ERR;
        }

        if x > 0 {
            // Pad with leading spaces
            buffer.insert_str(0, &" ".repeat(x as usize));
            x = 0;
        }
    }

    // Remove everything that would be offscreen to the right
    let mut past_end = end_position - unsafe { COLS };
    if past_end > 0 {
        clusters = buffer.graphemes(true).collect();
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
            buffer = clusters.join("");
        } else {
            return ERR;
        }
    }

    let mut stdout = stdout();
    match stdout.queue(cursor::MoveTo(x as u16, y as u16)) {
        Err(_) => return ERR,
        _ => {}
    }

    match stdout.queue(Print(buffer)) {
        Ok(_) => return OK,
        Err(_) => return ERR,
    }
}

fn fit_train_car(original: &CCStr) -> String {
    let mut characters = original.to_string_lossy().to_string();

    // Remove characters from the end of the string until it fits the screen
    let oversize = if characters.width() > original.len() {
        characters.width() - original.len()
    } else {
        0
    };

    if oversize > 0 {
        let mut clusters: Vec<&str> = characters.graphemes(true).collect();
        if let Some(pos) = clusters
            .iter()
            .rev()
            .position(|c| *c == "|")
            .and_then(|p| Some(clusters.len() - p - 1))
        {
            if pos > 0 {
                let mut removable_width = 0;
                if let Some(start) = clusters.iter().enumerate().rev().find_map(|(i, c)| {
                    if i < pos {
                        let width = c.width();
                        removable_width += width;
                    }

                    if removable_width >= oversize {
                        Some(i)
                    } else {
                        None
                    }
                }) {
                    clusters.splice(start..pos, std::iter::empty());
                    characters = clusters.join("");
                }
            }
        }
    }

    // Add spaces if the a character removed caused us to be at an odd number
    let undersize = original.len() - characters.width();
    if undersize > 0 {
        let pos = characters
            .chars()
            .rev()
            .position(|c| c == '|')
            .and_then(|p| Some(characters.len() - p - 1));

        if let Some(pos) = pos {
            characters.insert_str(pos, " ".repeat(undersize).as_str());
        }
    }

    return characters;
}

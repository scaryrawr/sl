use clap::Parser;
use cli::CliOptions;
use core::time;
use crossterm::event::{poll, read, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, style::Print, terminal, ExecutableCommand, QueueableCommand};
use freopen::reopen_stdout;
use sl::{print_c51, print_d51, print_sl, set_locale};
use std::ffi::c_int;
use std::fs;
use std::io::{stdin, stdout, BufRead, Error, IsTerminal, Stdin, Stdout, Write};
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};

mod cli;
mod freopen;
mod sl;

#[no_mangle]
pub static mut COLS: i32 = 0;
#[no_mangle]
pub static mut LINES: i32 = 0;

#[cfg(target_family = "windows")]
type SlChar = u16;
#[cfg(target_family = "unix")]
type SlChar = u32;

const OK: i32 = 0;
const ERR: i32 = -1;

#[cfg(target_family = "windows")]
type CCStr = widestring::U16CStr;
#[cfg(target_family = "unix")]
type CCStr = widestring::U32CStr;

fn fit_train_car(original: &CCStr) -> String {
    let mut characters = original.to_string_lossy().to_string();
    // Remove characters from the end of the string until it fits the screen
    let oversize = characters.width() - original.len();
    if oversize > 0 {
        if let Some(pos) = characters
            .chars()
            .rev()
            .position(|c| c == '|')
            .and_then(|p| Some(characters.len() - p - 1))
        {
            if pos > 0 {
                characters.remove(pos - 1);
                let mut removable_width = 0;
                if let Some(start) = characters.char_indices().rev().find_map(|(i, c)| {
                    if i < pos {
                        if let Some(width) = c.width() {
                            removable_width += width;
                        }
                    }

                    if removable_width >= oversize {
                        Some(i)
                    } else {
                        None
                    }
                }) {
                    characters.replace_range(start..pos - 1, "");
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

    let end_position = x + (buffer.width() as i32);

    // Everything is off screen to the left
    if end_position < 0 {
        return ERR;
    }

    let mut x = x;
    // Remove everything that will be off the screen to the left
    if x < 0 {
        if let Some(position) = buffer.char_indices().find_map(|(i, c)| {
            if x >= 0 {
                return Some(i);
            }

            // we want the beginning of the next character, so we increment after checking x
            let c_width = c.width().unwrap_or(1) as i32;
            x += c_width;
            None
        }) {
            buffer = buffer[position..].to_string();
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
        if let Some(position) = buffer.char_indices().rev().find_map(|(i, c)| {
            let c_width = c.width().unwrap_or(1) as i32;
            // We want to get the front of the current character, so decrement before checking past_end
            past_end -= c_width;
            if past_end <= 0 {
                return Some(i);
            }

            None
        }) {
            buffer = buffer[..position].to_string();
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

fn main() -> Result<(), Error> {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names: Vec<String> = if !Stdin::is_terminal(&stdin) {
        let names: Vec<String> = stdin
            .lock()
            .lines()
            .filter_map(|l| match l {
                Ok(s) => Some(s),
                Err(_) => None,
            })
            .collect();
        names
    } else if args.files {
        vec![]
    } else {
        let mut files: Vec<String> = fs::read_dir(".")?
            .filter_map(|p| match p {
                Ok(p) => Some(String::from(p.file_name().to_str()?)),
                Err(_) => None,
            })
            .filter(|s| args.accident || !s.starts_with('.'))
            .collect();
        files.sort();
        files
    };

    let mut stdout = stdout();
    if !Stdout::is_terminal(&stdout) {
        names.iter().for_each(|n| println!("{}", n));
        reopen_stdout()?;
    }

    terminal::enable_raw_mode()?;
    stdout.execute(cursor::Hide)?;
    unsafe {
        set_locale();
        update_size()?;

        let mut x = COLS - 1;
        let print_train = if args.logo {
            print_sl
        } else if args.c51 {
            print_c51
        } else {
            print_d51
        };

        if args.accident {
            sl::ACCIDENT = 1;
        }

        if args.fly {
            sl::FLY = 1;
        }

        stdout.queue(Clear(ClearType::All))?;
        while print_train(x, names.iter().map(String::as_ref)) == 0 {
            stdout.flush()?;
            x -= 1;
            if poll(time::Duration::from_micros(40_000))? {
                if let Event::Key(KeyEvent {
                    code: KeyCode::Char('c'),
                    modifiers: KeyModifiers::CONTROL,
                    ..
                }) = read()?
                {
                    break;
                }
            }

            // "handle" resize
            update_size()?;
        }
    }
    stdout.queue(Clear(ClearType::All))?.queue(cursor::Show)?;
    stdout.flush()?;
    terminal::disable_raw_mode()?;

    Ok(())
}

fn update_size() -> Result<(), Error> {
    let (cols, lines) = terminal::size()?;
    unsafe {
        COLS = cols as i32;
        LINES = lines as i32;
    }

    Ok(())
}

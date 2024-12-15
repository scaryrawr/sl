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
#[cfg(target_family = "windows")]
use widestring::u16str as ccstr;
#[cfg(target_family = "unix")]
type SlChar = u32;
#[cfg(target_family = "unix")]
use widestring::u32str as ccstr;

const OK: i32 = 0;
const ERR: i32 = -1;

#[no_mangle]
pub extern "C" fn my_mvaddstr(y: c_int, x: c_int, str: *const SlChar) -> i32 {
    if y < 0 || y > unsafe { LINES } - 1 {
        return ERR;
    }

    let mut x = x;

    #[cfg(target_family = "windows")]
    type CCString = widestring::U16CString;
    #[cfg(target_family = "windows")]
    type CCStr = widestring::U16CStr;
    #[cfg(target_family = "unix")]
    type CCString = widestring::U32CString;
    #[cfg(target_family = "unix")]
    type CCStr = widestring::U32CStr;

    let mut characters = unsafe { CCString::from_ptr_str(str).into_ustring() };
    let original = unsafe { CCStr::from_ptr_str(str) };
    let mut temp: String = characters
        .chars()
        .filter_map(|c| Some(c.unwrap_or(' ')))
        .collect();

    // Remove characters from the end of the string until it fits the screen
    let oversize = temp.width() - original.len();
    if oversize > 0 {
        if let Some(pos) = characters
            .chars()
            .rev()
            .filter_map(|c| Some(c.unwrap_or(' ')))
            .position(|c| c == '|')
            .and_then(|p| Some(characters.len() - p - 1))
        {
            if pos > 0 {
                characters.remove_char(pos - 1);
                let mut removable_width = 0;
                if let Some(start) = characters.char_indices().rev().find_map(|(i, c)| {
                    if i < pos {
                        if let Some(width) = c.unwrap_or(' ').width() {
                            removable_width += width;
                        }
                    }

                    if removable_width >= oversize {
                        Some(i)
                    } else {
                        None
                    }
                }) {
                    characters.replace_range(start..pos - 1, ccstr!(""));
                    temp = characters
                        .chars()
                        .filter_map(|c| Some(c.unwrap_or(' ')))
                        .collect();
                }
            }
        }
    }

    // Add spaces if the a character removed caused us to be at an odd number
    let undersize = original.len() - temp.width();
    if undersize > 0 {
        let pos = characters
            .chars()
            .rev()
            .filter_map(|c| Some(c.unwrap_or(' ')))
            .position(|c| c == '|')
            .and_then(|p| Some(characters.len() - p - 1));
        let spaces = CCString::from_str(" ".repeat(undersize));

        if let Some(pos) = pos {
            if let Ok(spaces) = spaces.as_ref() {
                characters.insert_ustr(pos, spaces.as_ustr());
                temp = characters
                    .chars()
                    .filter_map(|c| Some(c.unwrap_or(' ')))
                    .collect();
            }
        }
    }

    if (x + UnicodeWidthStr::width(temp.as_str()) as i32) < 0 {
        return ERR;
    }

    if let Some(mut location) = temp.char_indices().find_map(|(i, c)| {
        x += c.width().unwrap_or(1) as i32;
        if x < 0 {
            return None;
        }
        if x >= unsafe { COLS } {
            return None;
        } else {
            return Some(i);
        }
    }) {
        let mut stdout = stdout();
        if let Ok(queue) = stdout.queue(cursor::MoveTo(x as u16, y as u16)) {
            let end = std::cmp::min(
                std::cmp::min(temp.len(), (unsafe { COLS } - x) as usize),
                characters.len(),
            );
            location = std::cmp::min(location, end);
            temp = characters[location..end]
                .chars()
                .filter_map(|c| Some(c.unwrap_or(' ')))
                .collect();
            match queue.queue(Print(&temp)) {
                Err(_) => return ERR,
                _ => {}
            }
        } else {
            return ERR;
        }

        return OK;
    }

    ERR
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

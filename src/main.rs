use core::time;
use std::ffi::c_int;
use std::fs;
use std::io::{stdin, stdout, BufRead, IsTerminal, Stdin, Stdout, Write};
use std::thread::sleep;

use clap::{command, Parser};

use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, style::Print, terminal, ExecutableCommand, QueueableCommand};
use freopen::{reopen_stdin, reopen_stdout};
use sl::{print_c51, print_d51, print_sl, set_locale};

mod freopen;
mod sl;

/// sl  cure your bad habit of mistyping
#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// An accident is occurring. People cry for help. Lists all files.
    #[arg(short, long)]
    accident: bool,
    /// Little version.
    #[arg(short, long)]
    logo: bool,
    /// It flies like the galaxy express 999.
    #[arg(short = 'F', long)]
    fly: bool,
    /// C51 appears instead of D51.
    #[arg(short, long)]
    c51: bool,
    /// Disables listing files and directories.
    #[arg(short, long)]
    files: bool,
}

#[no_mangle]
pub static mut COLS: i32 = 0;
#[no_mangle]
pub static mut LINES: i32 = 0;

#[cfg(target_family = "windows")]
type SlChar = u16;
#[cfg(target_family = "unix")]
type SlChar = u32;

#[no_mangle]
pub extern "C" fn my_mvaddstr(y: c_int, x: c_int, str: *const SlChar) -> i32 {
    if y < 0 || y > unsafe { LINES } - 1 {
        return -11;
    }
    let mut x = x;

    #[cfg(target_family = "windows")]
    type CCStr = widestring::U16CStr;
    #[cfg(target_family = "unix")]
    type CCStr = widestring::U32CStr;

    let characters = unsafe { CCStr::from_ptr_str(str) };
    if (x + characters.len() as i32) < 0 {
        return 1;
    }

    let mut stdout = stdout();
    if let Ok(mut queue) = stdout.queue(cursor::MoveTo(0, 0)) {
        for c in characters.chars() {
            x += 1;
            if x < 0 {
                continue;
            }

            if x > unsafe { COLS } - 1 {
                break;
            }

            match queue.queue(cursor::MoveTo(x as u16, y as u16)) {
                Ok(q) => queue = q,
                Err(_) => return 1,
            }

            let c = if let Ok(c) = c { c } else { ' ' };

            match queue.queue(Print(c)) {
                Ok(q) => queue = q,
                Err(_) => return 1,
            }
        }

        match stdout.flush() {
            Ok(_) => 0,
            Err(_) => 1,
        }
    } else {
        return 1;
    }
}

fn main() {
    let args = Args::parse();
    let stdin = stdin();
    let names: Vec<String> = if !Stdin::is_terminal(&stdin) {
        let names: Vec<String> = stdin.lock().lines().map(|l| l.unwrap()).collect();
        reopen_stdin().unwrap();
        names
    } else if args.files {
        vec![]
    } else {
        let mut files: Vec<String> = fs::read_dir(".")
            .unwrap()
            .map(|p| String::from(p.unwrap().file_name().to_str().unwrap()))
            .filter(|s| args.accident || !s.starts_with('.'))
            .collect();
        files.sort();
        files
    };

    let mut stdout = stdout();
    if !Stdout::is_terminal(&stdout) {
        names.iter().for_each(|n| println!("{}", n));
        reopen_stdout().unwrap();
    }

    stdout.execute(cursor::Hide).unwrap();
    unsafe {
        set_locale();
        update_size();

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

        stdout.queue(Clear(ClearType::All)).unwrap();
        while print_train(x, names.iter().map(String::as_ref)) == 0 {
            x -= 1;
            sleep(time::Duration::from_micros(40000));
            update_size();
        }
    }
}

fn update_size() {
    if let Ok((cols, lines)) = terminal::size() {
        unsafe {
            COLS = cols as i32;
            LINES = lines as i32;
        }
    } else {
        eprintln!("Failed to get terminal size");
    }
}

use clap::Parser;
use cli::CliOptions;
use core::time;
use crossterm::event::{read, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, terminal, ExecutableCommand, QueueableCommand};
use filedescriptor::{Error, FileDescriptor};
use sl::{print_c51, print_d51, print_sl, set_locale, COLS, LINES};
use std::fs;
use std::io::{stdin, stdout, BufRead, BufReader, IsTerminal, Stdin, Write};
use std::sync::{Arc, Mutex};

mod cli;
mod sl;

fn main() {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names: Arc<Mutex<Vec<String>>> = if !Stdin::is_terminal(&stdin) {
        let names = Arc::new(Mutex::new(vec![]));
        let thread_names = Arc::clone(&names);
        let stdin_file = FileDescriptor::dup(&stdin.lock()).unwrap();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdin_file);
            reader.lines().for_each(|line| match line {
                Ok(line) => {
                    let mut names = thread_names.lock().unwrap();
                    names.push(line);
                }
                Err(_) => {}
            });
        });
        names
    } else if args.files {
        Arc::new(Mutex::new(vec![]))
    } else {
        let mut files: Vec<String> = fs::read_dir(".")
            .unwrap()
            .filter_map(|p| match p {
                Ok(p) => Some(String::from(p.file_name().to_str().unwrap())),
                Err(_) => None,
            })
            .filter(|s| args.accident || !s.starts_with('.'))
            .collect();
        files.sort();
        Arc::new(Mutex::new(files))
    };

    let mut stdout = stdout();
    terminal::enable_raw_mode().unwrap();
    stdout.execute(cursor::Hide).unwrap();

    unsafe {
        set_locale();
    }

    update_size().unwrap();

    let print_train = if args.logo {
        print_sl
    } else if args.c51 {
        print_c51
    } else {
        print_d51
    };

    if args.accident {
        unsafe {
            sl::ACCIDENT = 1;
        }
    }

    if args.fly {
        unsafe {
            sl::FLY = 1;
        }
    }

    let mut x = unsafe { COLS - 1 };
    stdout.queue(Clear(ClearType::All)).unwrap();
    while print_train(
        x,
        &names
            .lock()
            .unwrap()
            .iter()
            .map(String::as_ref)
            .collect::<Vec<&str>>(),
    ) == 0
    {
        stdout.flush().unwrap();
        x -= 1;

        if crossterm::event::poll(time::Duration::from_micros(40_000)).unwrap() {
            match read().unwrap() {
                Event::Key(KeyEvent {
                    code: KeyCode::Char('c'),
                    modifiers: KeyModifiers::CONTROL,
                    ..
                }) => break,
                Event::Resize(cols, lines) => unsafe {
                    stdout.queue(Clear(ClearType::All)).unwrap();
                    COLS = cols as i32;
                    LINES = lines as i32;
                },
                _ => {}
            }
        }
    }

    stdout
        .queue(Clear(ClearType::All))
        .unwrap()
        .queue(cursor::Show)
        .unwrap();
    stdout.flush().unwrap();
    terminal::disable_raw_mode().unwrap();
}

fn update_size() -> Result<(), Error> {
    let (cols, lines) = terminal::size()?;
    unsafe {
        COLS = cols as i32;
        LINES = lines as i32;
    }

    Ok(())
}

use clap::Parser;
use cli::CliOptions;
use core::time;
use crossterm::event::{read, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, terminal, ExecutableCommand, QueueableCommand};
use filedescriptor::{Error, FileDescriptor};
use sl::{print_c51, print_d51, print_sl, update_locale, COLS, LINES};
use std::fs;
use std::io::{stdin, stdout, BufRead, BufReader, IsTerminal, Stdin, Write};
use std::sync::{Arc, Mutex};

mod cli;
mod sl;

fn main() -> Result<(), Error> {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names = get_car_names(&args, stdin)?;

    terminal::enable_raw_mode()?;

    let mut stdout = stdout();
    stdout.execute(cursor::Hide)?;

    update_locale();
    update_size()?;

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
    stdout.queue(Clear(ClearType::All))?;
    loop {
        match names.lock() {
            Ok(names) => {
                if print_train(x, &names.iter().map(String::as_ref).collect::<Vec<&str>>()) != 0 {
                    break;
                }
            }
            Err(_) => break,
        }

        stdout.flush()?;
        x -= 1;

        if crossterm::event::poll(time::Duration::from_micros(40_000))? {
            match read()? {
                Event::Key(KeyEvent {
                    code: KeyCode::Char('c'),
                    modifiers: KeyModifiers::CONTROL,
                    ..
                }) => break,
                Event::Resize(cols, lines) => unsafe {
                    stdout.queue(Clear(ClearType::All))?;
                    COLS = cols as i32;
                    LINES = lines as i32;
                },
                _ => {}
            }
        }
    }

    stdout.queue(Clear(ClearType::All))?.queue(cursor::Show)?;
    stdout.flush()?;
    terminal::disable_raw_mode()?;

    Ok(())
}

fn get_car_names(args: &CliOptions, stdin: Stdin) -> Result<Arc<Mutex<Vec<String>>>, Error> {
    let names: Arc<Mutex<Vec<String>>> = if !Stdin::is_terminal(&stdin) {
        let names = Arc::new(Mutex::new(vec![]));
        let thread_names = Arc::clone(&names);
        let stdin_file = FileDescriptor::dup(&stdin.lock())?;
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
        let mut files: Vec<String> = fs::read_dir(".")?
            .filter_map(|p| match p {
                Ok(p) => Some(String::from(p.file_name().to_str()?)),
                Err(_) => None,
            })
            .filter(|s| args.accident || !s.starts_with('.'))
            .collect();
        files.sort();
        Arc::new(Mutex::new(files))
    };
    Ok(names)
}

fn update_size() -> Result<(), Error> {
    let (cols, lines) = terminal::size()?;
    unsafe {
        COLS = cols as i32;
        LINES = lines as i32;
    }

    Ok(())
}

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
use std::sync::mpsc::Receiver;

mod cli;
mod sl;

fn main() -> Result<(), Error> {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names_receiver = cars_receiver(&args, stdin)?;

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
    let mut names: Vec<String> = vec![];
    loop {
        match names_receiver.try_recv() {
            Ok(name) => {
                names.push(name);
            }
            Err(_) => {}
        }

        if print_train(x, &names.iter().map(String::as_ref).collect::<Vec<&str>>()) != 0 {
            break;
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

fn cars_receiver(args: &CliOptions, stdin: Stdin) -> Result<Receiver<String>, Error> {
    let (sender, receiver) = std::sync::mpsc::channel();
    if !Stdin::is_terminal(&stdin) {
        let stdin_file = FileDescriptor::dup(&stdin.lock())?;
        std::thread::spawn(move || {
            let reader = BufReader::new(stdin_file);
            reader.lines().for_each(|line| match line {
                Ok(line) => sender.send(line).unwrap(),
                Err(_) => {}
            });
        });
    } else if args.files {
        // Nothing to send
    } else {
        let accident = args.accident;
        std::thread::spawn(move || {
            fs::read_dir(".").unwrap().for_each(|p| {
                let p = p.unwrap();
                let name = p.file_name().to_str().unwrap().to_string();
                if accident || !name.starts_with('.') {
                    sender.send(name).unwrap();
                }
            });
        });
    };

    Ok(receiver)
}

fn update_size() -> Result<(), Error> {
    let (cols, lines) = terminal::size()?;
    unsafe {
        COLS = cols as i32;
        LINES = lines as i32;
    }

    Ok(())
}

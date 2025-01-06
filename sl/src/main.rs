use clap::Parser;
use cli::CliOptions;
use core::time;
use crossterm::event::{read, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, terminal, ExecutableCommand, QueueableCommand};
use filedescriptor::{Error, FileDescriptor};
use libsl::{add_c51, add_d51, add_logo, COLS, LINES};
use std::fs;
use std::io::{stdin, stdout, BufRead, BufReader, IsTerminal, Stdin, Write};
use std::sync::mpsc::Receiver;

mod cli;

fn main() -> Result<(), Error> {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names_receiver = cars_receiver(&args, stdin)?;

    terminal::enable_raw_mode()?;

    let mut stdout = stdout();
    stdout.execute(cursor::Hide)?;

    update_size()?;

    let add_train = if args.logo {
        add_logo
    } else if args.c51 {
        add_c51
    } else {
        add_d51
    };

    if args.accident {
        unsafe {
            libsl::ACCIDENT = 1;
        }
    }

    if args.fly {
        unsafe {
            libsl::FLY = 1;
        }
    }

    let mut x = unsafe { COLS - 1 };
    stdout.queue(Clear(ClearType::All))?;
    let mut names: Vec<String> = vec![];

    let display = libsl::Display {
        add_str: |y, x, s| {
            let mut stdout = std::io::stdout();
            stdout.queue(cursor::MoveTo(x as u16, y as u16)).unwrap();
            stdout.write_all(s.as_bytes()).unwrap();
        },
    };

    loop {
        match names_receiver.try_recv() {
            Ok(name) => {
                names.push(name);
            }
            Err(_) => {}
        }

        if add_train(
            x,
            &names.iter().map(String::as_ref).collect::<Vec<&str>>(),
            &display,
        )
        .is_err()
        {
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

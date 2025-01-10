use clap::Parser;
use cli::CliOptions;
use core::time;
use crossterm::event::{read, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, terminal, ExecutableCommand, QueueableCommand};
use filedescriptor::{Error, FileDescriptor};
use libsl::{add_c51, add_d51, add_logo};
use std::fs;
use std::io::{stdin, stdout, BufRead, BufReader, IsTerminal, Stdin, Write};
use std::sync::mpsc::Receiver;

mod cli;

struct TerminalDisplay {
    cols: i32,
    lines: i32,
}

impl libsl::Display for TerminalDisplay {
    fn add_str(&self, y: i32, x: i32, s: &str) {
        let mut stdout = std::io::stdout();
        stdout.queue(cursor::MoveTo(x as u16, y as u16)).unwrap();
        stdout.write_all(s.as_bytes()).unwrap();
    }

    fn cols(&self) -> i32 {
        self.cols
    }

    fn lines(&self) -> i32 {
        self.lines
    }
}

impl libsl::Options for CliOptions {
    fn accident(&self) -> bool {
        self.accident
    }

    fn fly(&self) -> bool {
        self.fly
    }
}

fn main() -> Result<(), Error> {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names_receiver = cars_receiver(&args, stdin)?;

    terminal::enable_raw_mode()?;

    let mut stdout = stdout();
    stdout.execute(cursor::Hide)?;

    let add_train = if args.logo {
        add_logo
    } else if args.c51 {
        add_c51
    } else {
        add_d51
    };

    stdout.queue(Clear(ClearType::All))?;
    let mut names: Vec<String> = vec![];

    let size = terminal::size()?;
    let mut display = TerminalDisplay {
        cols: size.0 as i32,
        lines: size.1 as i32,
    };

    let mut x = display.cols - 1;

    loop {
        match names_receiver.try_recv() {
            Ok(name) => {
                names.push(name);
            }
            Err(_) => {}
        }

        if add_train(x, &names, &display, &args).is_err() {
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
                Event::Resize(cols, lines) => {
                    stdout.queue(Clear(ClearType::All))?;
                    display.cols = cols as i32;
                    display.lines = lines as i32;
                }
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

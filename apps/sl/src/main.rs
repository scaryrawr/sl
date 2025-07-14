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
use std::sync::Mutex;

mod cli;

static TERMINAL_COLS: Mutex<i32> = Mutex::new(0);
static TERMINAL_LINES: Mutex<i32> = Mutex::new(0);

#[no_mangle]
pub extern "C" fn add_str(line: i32, column: i32, value: *const u8, len: usize) {
    let s = unsafe { std::slice::from_raw_parts(value, len) };
    let string = std::str::from_utf8(s).unwrap();
    
    let mut stdout = std::io::stdout();
    stdout.queue(cursor::MoveTo(column as u16, line as u16)).unwrap();
    stdout.write_all(string.as_bytes()).unwrap();
}

#[no_mangle]
pub extern "C" fn cols() -> i32 {
    *TERMINAL_COLS.lock().unwrap()
}

#[no_mangle]
pub extern "C" fn lines() -> i32 {
    *TERMINAL_LINES.lock().unwrap()
}

impl libsl::Options for CliOptions {
    fn accident(&self) -> bool {
        self.accident
    }

    fn fly(&self) -> bool {
        self.fly
    }

    fn smoke(&self) -> bool {
        true
    }
}

fn set_terminal_size(cols: i32, lines: i32) {
    *TERMINAL_COLS.lock().unwrap() = cols;
    *TERMINAL_LINES.lock().unwrap() = lines;
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
    set_terminal_size(size.0 as i32, size.1 as i32);

    let mut x = cols() - 1;

    loop {
        match names_receiver.try_recv() {
            Ok(name) => {
                names.push(name);
            }
            Err(_) => {}
        }

        if add_train(x, &names, &args).is_err() {
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
                    set_terminal_size(cols as i32, lines as i32);
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

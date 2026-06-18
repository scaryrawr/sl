use clap::Parser;
use cli::CliOptions;
use core::time;
use crossterm::event::{read, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, terminal, ExecutableCommand, QueueableCommand};
use filedescriptor::{Error, FileDescriptor};
use libsl::{add_c51, add_d51, add_logo, RenderError, RenderTarget, ScreenSize, TrainOptions};
use std::fs;
use std::io::{stdin, stdout, BufRead, BufReader, IsTerminal, Stdin, Stdout, Write};
use std::sync::mpsc::Receiver;

mod cli;

struct TerminalRenderer<'a> {
    stdout: &'a mut Stdout,
}

impl RenderTarget for TerminalRenderer<'_> {
    type Error = Error;

    fn draw_str(&mut self, line: i32, column: i32, value: &str) -> Result<(), Self::Error> {
        self.stdout
            .queue(cursor::MoveTo(column as u16, line as u16))?;
        Ok(self.stdout.write_all(value.as_bytes())?)
    }
}

fn main() -> Result<(), Error> {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names_receiver = cars_receiver(&args, stdin)?;

    terminal::enable_raw_mode()?;

    let mut stdout = stdout();
    stdout.execute(cursor::Hide)?;

    stdout.queue(Clear(ClearType::All))?;
    let mut names: Vec<String> = vec![];

    let size = terminal::size()?;
    let mut screen = ScreenSize::new(size.0 as i32, size.1 as i32);
    let options = TrainOptions::new(args.accident, args.fly, true);
    let mut render_error = None;

    let mut x = screen.columns - 1;

    loop {
        match names_receiver.try_recv() {
            Ok(name) => {
                names.push(name);
            }
            Err(_) => {}
        }

        let mut renderer = TerminalRenderer {
            stdout: &mut stdout,
        };
        let result = if args.logo {
            add_logo(x, &names, screen, &mut renderer, &options)
        } else if args.c51 {
            add_c51(x, &names, screen, &mut renderer, &options)
        } else {
            add_d51(x, &names, screen, &mut renderer, &options)
        };

        match result {
            Ok(()) => {}
            Err(RenderError::Offscreen) => break,
            Err(RenderError::Target(error)) => {
                render_error = Some(error);
                break;
            }
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
                    screen = ScreenSize::new(cols as i32, lines as i32);
                }
                _ => {}
            }
        }
    }

    stdout.queue(Clear(ClearType::All))?.queue(cursor::Show)?;
    stdout.flush()?;
    terminal::disable_raw_mode()?;

    if let Some(error) = render_error {
        return Err(error);
    }

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

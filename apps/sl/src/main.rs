//! **sl** – Steam Locomotive CLI application.
//!
//! Renders an animated ASCII-art steam train across the terminal. Supports multiple train
//! types (D51, C51, logo), accident mode, flying mode, and smoke particles.
//!
//! When stdin is not a terminal, piped input is displayed on the train cars. Otherwise,
//! directory listings are used (unless `--files` is set).

use clap::Parser;
use cli::CliOptions;
use core::time;
use crossterm::event::{read, Event, KeyCode, KeyEvent, KeyModifiers};
use crossterm::terminal::{Clear, ClearType};
use crossterm::{cursor, terminal, ExecutableCommand, QueueableCommand};
use filedescriptor::{Error, FileDescriptor};
use libsl::{
    create_c51, create_d51, create_logo, RenderError, RenderTarget, ScreenSize, TrainOptions,
};
use std::fs;
use std::io::{stdin, stdout, BufRead, BufReader, IsTerminal, Stdin, Stdout, Write};
use std::sync::mpsc::Receiver;

mod cli;

/// Delay between animation steps, one column of travel per step.
///
/// 40 ms is the sleep inherited from the original curses `sl`, which paused after each column
/// the train advanced: about 25 columns a second, fast enough to read as motion and slow enough
/// that a terminal can redraw every frame without flicker.
const FRAME_DELAY: time::Duration = time::Duration::from_micros(40_000);

/// The train starts one column past the right edge, fully off screen, and walks left from there.
const START_OFFSCREEN_BY: i32 = 1;

/// Bridges the real terminal (`stdout`) to the [`RenderTarget`] trait so the train
/// can be drawn using crossterm cursor positioning and byte writes.
struct TerminalRenderer {
    stdout: Stdout,
}

impl RenderTarget for TerminalRenderer {
    type Error = Error;

    fn draw_str(&mut self, line: i32, column: i32, value: &str) -> Result<(), Self::Error> {
        self.stdout
            .queue(cursor::MoveTo(column as u16, line as u16))?;
        Ok(self.stdout.write_all(value.as_bytes())?)
    }
}

/// Application entry point.
///
/// Parses CLI arguments, sets up raw terminal mode, and runs the animation loop until
/// the train scrolls off-screen or the user presses `Ctrl+C`.
///
/// # Returns
///
/// `Ok(())` on clean exit, or an error if the terminal I/O fails.
fn main() -> Result<(), Error> {
    let args = CliOptions::parse();
    let stdin = stdin();
    let names_receiver = cars_receiver(&args, stdin)?;

    terminal::enable_raw_mode()?;

    let mut renderer = TerminalRenderer { stdout: stdout() };
    renderer.stdout.execute(cursor::Hide)?;

    renderer.stdout.queue(Clear(ClearType::All))?;
    let mut names: Vec<String> = vec![];

    let size = terminal::size()?;
    let mut screen = ScreenSize::new(size.0 as i32, size.1 as i32);
    let create_train = if args.logo {
        create_logo
    } else if args.c51 {
        create_c51
    } else {
        create_d51
    };
    let mut train = create_train(TrainOptions::new(args.accident, args.fly, true));
    let mut render_error = None;
    let mut x = screen.columns - START_OFFSCREEN_BY;

    loop {
        if let Ok(name) = names_receiver.try_recv() {
            names.push(name);
        }

        renderer.stdout.queue(terminal::BeginSynchronizedUpdate)?;
        let result = train.render(x, &names, screen, &mut renderer);
        renderer.stdout.queue(terminal::EndSynchronizedUpdate)?;

        match result {
            Ok(()) => {}
            Err(RenderError::Offscreen) => break,
            Err(RenderError::Target(error)) => {
                render_error = Some(error);
                break;
            }
        }

        renderer.stdout.flush()?;
        x -= 1;

        if crossterm::event::poll(FRAME_DELAY)? {
            match read()? {
                Event::Key(KeyEvent {
                    code: KeyCode::Char('c'),
                    modifiers: KeyModifiers::CONTROL,
                    ..
                }) => break,
                Event::Resize(cols, lines) => {
                    renderer.stdout.queue(Clear(ClearType::All))?;
                    screen = ScreenSize::new(cols as i32, lines as i32);
                }
                _ => {}
            }
        }
    }

    renderer
        .stdout
        .queue(Clear(ClearType::All))?
        .queue(cursor::Show)?;
    renderer.stdout.flush()?;
    terminal::disable_raw_mode()?;

    if let Some(error) = render_error {
        return Err(error);
    }

    Ok(())
}

/// Spawn a background thread that sends train car labels through a channel.
///
/// - If stdin is **not** a terminal, piped lines are sent as labels.
/// - If `--files` is set, no labels are sent (empty train cars).
/// - Otherwise, directory entries from `.` are sent (skipping dotfiles unless `--accident`).
///
/// # Arguments
///
/// * `args` - Parsed CLI options.
/// * `stdin` - Standard input handle.
///
/// # Returns
///
/// A receiver that yields `String` labels for the train cars.
fn cars_receiver(args: &CliOptions, stdin: Stdin) -> Result<Receiver<String>, Error> {
    let (sender, receiver) = std::sync::mpsc::channel();
    if !Stdin::is_terminal(&stdin) {
        let stdin_file = FileDescriptor::dup(&stdin.lock())?;
        std::thread::spawn(move || {
            let reader = BufReader::new(stdin_file);
            reader.lines().for_each(|line| {
                if let Ok(line) = line {
                    sender.send(line).unwrap()
                }
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
                    sender.send(name).unwrap()
                }
            });
        });
    };

    Ok(receiver)
}

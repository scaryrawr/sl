use core::time;
use std::fs;
use std::io::{stdin, stdout, BufRead, IsTerminal, Stdin, Stdout};
use std::thread::sleep;

use clap::{command, Parser};
use curses::{
    curs_set, endwin, getch, initscr, leaveok, mvcur, nodelay, noecho, refresh, scrollok, stdscr,
    COLS, LINES,
};

use freopen::{reopen_stdin, reopen_stdout};
use sl::{print_c51, print_d51, print_sl, set_locale};

mod curses;
mod sl;

#[cfg_attr(target_family = "unix", path = "freopen_unix.rs")]
#[cfg_attr(target_family = "windows", path = "freopen_windows.rs")]
mod freopen;
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

    let stdout = stdout();
    if !Stdout::is_terminal(&stdout) {
        names.iter().for_each(|n| println!("{}", n));
        reopen_stdout().unwrap();
    }

    unsafe {
        set_locale();
        initscr();
        noecho();
        curs_set(0);
        nodelay(stdscr, 1);
        leaveok(stdscr, 1);
        scrollok(stdscr, 0);

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

        while print_train(x, names.iter().map(String::as_ref)) == 0 {
            x -= 1;
            getch();
            refresh();
            sleep(time::Duration::from_micros(40000));
        }

        mvcur(0, COLS - 1, LINES - 1, 0);
        endwin();
    }
}

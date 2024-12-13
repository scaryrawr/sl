use clap::{Args, Command};
use clap_complete::{generate_to, Shell};
use cmake::Config;

include!("src/cli.rs");

fn main() {
    let dst = Config::new("libsl").build();

    println!("cargo:rerun-if-changed=libsl/sl.c");
    println!("cargo:rerun-if-changed=libsl/sl.h");
    println!("cargo:rustc-link-search=native={}", dst.display());

    let cmd = Command::new("sl");
    let mut cmd = CliOptions::augment_args(cmd);

    let shells = vec![
        Shell::Bash,
        Shell::Fish,
        Shell::Zsh,
        Shell::PowerShell,
        Shell::Elvish,
    ];

    for shell in shells {
        generate_to(shell, &mut cmd, "sl", "completions").unwrap();
    }
}

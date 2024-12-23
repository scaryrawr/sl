use std::{env, io::Error};

use clap::{Args, Command};
use clap_complete::{generate_to, Shell};

include!("src/cli.rs");

fn main() -> Result<(), Error> {
    println!("cargo:rerun-if-changed=libsl/build.zig");
    println!("cargo:rerun-if-changed=libsl/sl.c");
    println!("cargo:rerun-if-changed=libsl/sl.h");
    println!("cargo:rerun-if-changed=libsl/src/sl.zig");

    let dst = zigcli::build("libsl");
    let lib_dir = dst.join("lib");

    println!("cargo:rustc-link-search=native={}", lib_dir.display());
    println!("cargo:rustc-link-lib=static=sl");

    let completion_dir = match env::var_os("COMPLETION_DIR") {
        None => return Ok(()),
        Some(completion_dir) => completion_dir,
    };

    let mut cmd = CliOptions::augment_args(Command::new("sl"));

    let shells = vec![
        Shell::Bash,
        Shell::Fish,
        Shell::Zsh,
        Shell::PowerShell,
        Shell::Elvish,
    ];

    for shell in shells {
        generate_to(shell, &mut cmd, "sl", &completion_dir)?;
    }

    // Modify for man page
    let cmd = cmd.author("Toyoda Masashi (mtoyoda@acm.org)").long_about(
        "sl is a highly advanced animation program for curing your bad habit of mistyping.",
    );

    let man = clap_mangen::Man::new(cmd);
    let mut buffer: Vec<u8> = Default::default();
    man.render(&mut buffer)?;

    let man_path = std::path::PathBuf::from(completion_dir).join("sl.1");
    std::fs::write(man_path, buffer)?;

    Ok(())
}

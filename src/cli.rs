use clap::{command, Parser};

/// sl  cure your bad habit of mistyping
#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
pub struct CliOptions {
    /// An accident is occurring. People cry for help. Lists all files.
    #[arg(short, long)]
    pub accident: bool,
    /// Little version.
    #[arg(short, long)]
    pub logo: bool,
    /// It flies like the galaxy express 999.
    #[arg(short = 'F', long)]
    pub fly: bool,
    /// C51 appears instead of D51.
    #[arg(short, long)]
    pub c51: bool,
    /// Disables listing files and directories.
    #[arg(short, long)]
    pub files: bool,
}

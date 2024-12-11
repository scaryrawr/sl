use std::ffi::CString;
use std::io;

use libc::{fdopen, freopen};

#[cfg(target_family = "unix")]
static CONSOLE_IN: &str = "/dev/tty";
#[cfg(target_family = "unix")]
static CONSOLE_OUT: &str = "/dev/tty";

#[cfg(target_family = "windows")]
static CONSOLE_IN: &str = "CONIN$";
#[cfg(target_family = "windows")]
static CONSOLE_OUT: &str = "CONOUT$";

pub fn reopen_stdin() -> io::Result<()> {
    let console = CString::new(CONSOLE_IN)?;
    let mode: CString = CString::new("r")?;
    unsafe { freopen(console.as_ptr(), mode.as_ptr(), fdopen(0, mode.as_ptr())) };

    Ok(())
}

pub fn reopen_stdout() -> io::Result<()> {
    let console = CString::new(CONSOLE_OUT)?;
    let mode: CString = CString::new("w")?;
    unsafe { freopen(console.as_ptr(), mode.as_ptr(), fdopen(1, mode.as_ptr())) };

    Ok(())
}

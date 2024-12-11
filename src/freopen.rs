use std::fs::File;
use std::io;
use std::os::unix::io::{AsRawFd, RawFd};

extern "C" {
    #[cfg(target_family = "unix")]
    fn dup2(oldfd: RawFd, newfd: RawFd) -> i32;

    #[cfg(target_family = "windows")]
    fn _dup2(oldfd: RawFd, newfd: RawFd) -> i32;
}

#[cfg(target_family = "windows")]
pub unsafe fn dup2(oldfd: RawFd, newfd: RawFd) -> i32 {
    #[cfg(target_family = "windows")]
    return _dup2(oldfd, newfd);
}

#[cfg(target_family = "unix")]
static CONSOLE_IN: &str = "/dev/tty";
#[cfg(target_family = "unix")]
static CONSOLE_OUT: &str = "/dev/tty";

#[cfg(target_family = "windows")]
static CONSOLE_IN: &str = "CONIN$";
#[cfg(target_family = "windows")]
static CONSOLE_OUT: &str = "CONOUT$";

pub fn reopen_stdin() -> io::Result<()> {
    let tty = File::open(CONSOLE_IN)?;
    let tty_fd = tty.as_raw_fd();

    let result = unsafe { dup2(tty_fd, 0) };

    if result == -1 {
        return Err(io::Error::last_os_error());
    }

    Ok(())
}

pub fn reopen_stdout() -> io::Result<()> {
    let tty = File::options().write(true).open(CONSOLE_OUT)?;
    let tty_fd = tty.as_raw_fd();

    let result = unsafe { dup2(tty_fd, 1) };

    if result == -1 {
        return Err(io::Error::last_os_error());
    }

    Ok(())
}

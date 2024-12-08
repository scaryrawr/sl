use std::fs::File;
use std::io;
use std::os::unix::io::{AsRawFd, RawFd};

extern "C" {
    fn dup2(oldfd: RawFd, newfd: RawFd) -> i32;
}

pub fn reopen_stdin() -> io::Result<()> {
    let tty = File::open("/dev/tty")?;
    let tty_fd = tty.as_raw_fd();

    let result = unsafe { dup2(tty_fd, 0) };

    if result == -1 {
        return Err(io::Error::last_os_error());
    }

    Ok(())
}

pub fn reopen_stdout() -> io::Result<()> {
    let tty = File::options().write(true).open("/dev/tty")?;
    let tty_fd = tty.as_raw_fd();

    let result = unsafe { dup2(tty_fd, 1) };

    if result == -1 {
        return Err(io::Error::last_os_error());
    }

    Ok(())
}

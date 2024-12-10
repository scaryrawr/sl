use std::fs::File;
use std::io;
use std::os::windows::io::FromRawHandle;
use windows::core::*;
use windows::Win32::Foundation::{GENERIC_READ, GENERIC_WRITE, HANDLE};
use windows::Win32::Storage::FileSystem::{
    CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_MODE, OPEN_EXISTING,
};
use windows::Win32::System::Console::{SetStdHandle, STD_INPUT_HANDLE, STD_OUTPUT_HANDLE};

pub fn reopen_stdin() -> io::Result<()> {
    // Open the console input
    let handle = unsafe {
        CreateFileW(
            w!("CONIN$"),
            GENERIC_READ.0,
            FILE_SHARE_MODE(0),
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            HANDLE(std::ptr::null_mut()),
        )
        .unwrap()
    };

    if handle.is_invalid() {
        return Err(io::Error::last_os_error());
    }

    // Set the standard input handle
    unsafe {
        SetStdHandle(STD_INPUT_HANDLE, handle).unwrap();
    }

    // Convert the raw handle to a Rust File object
    let _file = unsafe { File::from_raw_handle(handle.0 as *mut _) };

    Ok(())
}

pub fn reopen_stdout() -> io::Result<()> {
    // Open the console input
    let handle = unsafe {
        CreateFileW(
            w!("CONOUT$"),
            GENERIC_WRITE.0,
            FILE_SHARE_MODE(0),
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            HANDLE(std::ptr::null_mut()),
        )
        .unwrap()
    };

    if handle.is_invalid() {
        return Err(io::Error::last_os_error());
    }

    // Set the standard input handle
    unsafe {
        SetStdHandle(STD_OUTPUT_HANDLE, handle).unwrap();
    }

    // Convert the raw handle to a Rust File object
    let _file = unsafe { File::from_raw_handle(handle.0 as *mut _) };

    Ok(())
}

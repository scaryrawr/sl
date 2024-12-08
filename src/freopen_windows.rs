use std::fs::File;
use std::io;
use std::os::windows::io::{AsRawHandle, FromRawHandle};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Storage::FileSystem::CreateFileW;
use windows::Win32::Storage::FileSystem::{FILE_ATTRIBUTE_NORMAL, OPEN_EXISTING};
use windows::Win32::System::Console::{GetStdHandle, SetStdHandle, STD_INPUT_HANDLE};
use windows::Win32::System::SystemServices::GENERIC_READ;

pub fn reopen_stdin() -> io::Result<()> {
    // Open the console input
    let handle = unsafe {
        CreateFileW(
            windows::w!("CONIN$"),
            GENERIC_READ,
            0,
            std::ptr::null_mut(),
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            HANDLE(0),
        )
    };

    if handle.is_invalid() {
        return Err(io::Error::last_os_error());
    }

    // Set the standard input handle
    unsafe {
        if !SetStdHandle(STD_INPUT_HANDLE, handle).as_bool() {
            return Err(io::Error::last_os_error());
        }
    }

    // Convert the raw handle to a Rust File object
    let _file = unsafe { File::from_raw_handle(handle.0 as *mut _) };

    Ok(())
}

pub fn reopen_stdout() -> io::Result<()> {
    // Open the console input
    let handle = unsafe {
        CreateFileW(
            windows::w!("CONOUT$"),
            GENERIC_WRITE,
            0,
            std::ptr::null_mut(),
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            HANDLE(0),
        )
    };

    if handle.is_invalid() {
        return Err(io::Error::last_os_error());
    }

    // Set the standard input handle
    unsafe {
        if !SetStdHandle(STD_OUTPUT_HANDLE, handle).as_bool() {
            return Err(io::Error::last_os_error());
        }
    }

    // Convert the raw handle to a Rust File object
    let _file = unsafe { File::from_raw_handle(handle.0 as *mut _) };

    Ok(())
}

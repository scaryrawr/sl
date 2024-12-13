use libc::wchar_t;
use std::ffi::c_int;

type SlStr = *const wchar_t;

#[link(name = "sl", kind = "static")]
extern "C" {
    pub static mut ACCIDENT: c_int;
    pub static mut FLY: c_int;

    pub fn set_locale();
    fn add_D51(current_column: c_int, names: *const SlStr, count: c_int) -> c_int;
    fn add_C51(current_column: c_int, names: *const SlStr, count: c_int) -> c_int;
    fn add_sl(current_column: c_int, names: *const SlStr, count: c_int) -> c_int;
}

#[cfg(target_family = "windows")]
fn create_string(value: &str) -> widestring::U16CString {
    widestring::U16CString::from_str(value).unwrap()
}

#[cfg(target_family = "unix")]
fn create_string(value: &str) -> widestring::U32CString {
    widestring::U32CString::from_str(value).unwrap()
}

pub fn print_d51<'a, StringIterator>(current_column: c_int, names: StringIterator) -> i32
where
    StringIterator: IntoIterator<Item = &'a str>,
{
    let strings: Vec<_> = names.into_iter().map(|s| create_string(s)).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_D51(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

pub fn print_sl<'a, StringIterator>(current_column: c_int, names: StringIterator) -> i32
where
    StringIterator: IntoIterator<Item = &'a str>,
{
    let strings: Vec<_> = names.into_iter().map(|s| create_string(s)).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_sl(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

pub fn print_c51<'a, StringIterator>(current_column: c_int, names: StringIterator) -> i32
where
    StringIterator: IntoIterator<Item = &'a str>,
{
    let strings: Vec<_> = names.into_iter().map(|s| create_string(s)).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_C51(current_column, pointers.as_ptr(), pointers.len() as c_int) }
}

use std::ffi::{c_char, CString};

mod add_man;
mod mvaddstr;
mod print_car;
mod unicode_width;

#[no_mangle]
pub static mut COLS: i32 = 0;
#[no_mangle]
pub static mut LINES: i32 = 0;

pub type PCSTR = *const c_char;

#[link(name = "sl", kind = "static")]
extern "C" {
    pub static mut ACCIDENT: i32;
    pub static mut FLY: i32;

    fn add_D51(current_column: i32, names: *const PCSTR, count: i32) -> i32;
    fn add_C51(current_column: i32, names: *const PCSTR, count: i32) -> i32;
    fn add_sl(current_column: i32, names: *const PCSTR, count: i32) -> i32;
}

fn add_wrapper(
    current_column: i32,
    names: &[&str],
    add_train: unsafe extern "C" fn(i32, *const PCSTR, i32) -> i32,
) -> i32 {
    let strings: Vec<_> = names.iter().map(|s| CString::new(*s).unwrap()).collect();
    let pointers: Vec<_> = strings.iter().map(|s| s.as_ptr()).collect();
    unsafe { add_train(current_column, pointers.as_ptr(), pointers.len() as i32) }
}

pub fn print_d51(current_column: i32, names: &[&str]) -> i32 {
    add_wrapper(current_column, names, add_D51)
}

pub fn print_sl(current_column: i32, names: &[&str]) -> i32 {
    add_wrapper(current_column, names, add_sl)
}

pub fn print_c51(current_column: i32, names: &[&str]) -> i32 {
    add_wrapper(current_column, names, add_C51)
}

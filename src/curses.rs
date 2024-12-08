use std::ffi::{c_int, c_void};

#[cfg_attr(target_family = "windows", link(name = "pdcurses", kind = "static"))]
#[cfg_attr(target_family = "unix", link(name = "ncursesw", kind = "dylib"))]
extern "C" {
    pub static stdscr: *mut c_void;
    pub static COLS: c_int;
    pub static LINES: c_int;

    pub fn initscr() -> *mut c_void;
    pub fn noecho() -> c_int;
    pub fn curs_set(visibility: c_int) -> c_int;
    pub fn nodelay(window: *mut c_void, bf: c_int) -> c_int;
    pub fn leaveok(window: *mut c_void, bf: c_int) -> c_int;
    pub fn scrollok(window: *mut c_void, bf: c_int) -> c_int;
    pub fn getch() -> c_int;
    pub fn refresh() -> c_int;
    pub fn mvcur(oldrow: c_int, oldcol: c_int, newrow: c_int, newcol: c_int) -> c_int;
    pub fn endwin() -> c_int;
}

#![no_std]

mod add_man;
mod add_smoke;
mod add_train;
mod c51;
mod d51;
mod logo;
mod mvaddstr;
mod print_car;
mod unicode_width;

pub static mut COLS: i32 = 0;
pub static mut LINES: i32 = 0;
pub static mut ACCIDENT: i32 = 0;
pub static mut FLY: i32 = 0;

pub struct Display {
    pub add_str: fn(i32, i32, &str),
}

pub use c51::add_c51;
pub use d51::add_d51;
pub use logo::add_logo;

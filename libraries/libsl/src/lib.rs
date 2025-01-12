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

pub trait Options {
    fn accident(&self) -> bool;
    fn fly(&self) -> bool;
    fn smoke(&self) -> bool;
}

pub trait Display {
    fn add_str(&self, line: i32, column: i32, value: &str);
    fn cols(&self) -> i32;
    fn lines(&self) -> i32;
}

pub use c51::add_c51;
pub use d51::add_d51;
pub use logo::add_logo;

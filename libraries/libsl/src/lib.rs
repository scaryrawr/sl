#![cfg_attr(not(feature = "std"), no_std)]

mod add_man;
mod add_smoke;
mod add_train;
mod c51;
mod d51;
mod logo;
mod mvaddstr;
mod print_car;
mod unicode_width;

/// Options for customizing the display.
pub trait Options {
    /// Returns `true` if the accident option is enabled.
    fn accident(&self) -> bool;
    /// Returns `true` if the fly option is enabled.
    fn fly(&self) -> bool;
    /// Returns `true` if the smoke option is enabled.
    fn smoke(&self) -> bool;
}

/// A trait representing a display.
pub trait Display {
    /// Adds a string to the display at the specified line and column.
    ///
    /// # Arguments
    ///
    /// * `line` - The line number where the string should be added.
    /// * `column` - The column number where the string should be added.
    /// * `value` - The string to be added.
    fn add_str(&self, line: i32, column: i32, value: &str);
    /// Returns the number of columns in the display.
    fn cols(&self) -> i32;
    /// Returns the number of lines in the display.
    fn lines(&self) -> i32;
}

pub use c51::add_c51;
pub use d51::add_d51;
pub use logo::add_logo;

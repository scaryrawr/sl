#![no_std]

#[cfg(test)]
extern crate std;

mod add_man;
mod add_smoke;
mod add_train;
mod c51;
mod d51;
mod logo;
mod mvaddstr;
mod print_car;
mod unicode_width;

/// The drawable area available to the train renderer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ScreenSize {
    /// The number of addressable columns.
    pub columns: i32,
    /// The number of addressable lines.
    pub lines: i32,
}

impl ScreenSize {
    /// Creates a new screen size from a column and line count.
    pub const fn new(columns: i32, lines: i32) -> Self {
        Self { columns, lines }
    }
}

/// Options that control the train animation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TrainOptions {
    /// Whether passengers should fall out of the train.
    pub accident: bool,
    /// Whether the train should fly diagonally.
    pub fly: bool,
    /// Whether smoke should be rendered.
    pub smoke: bool,
}

impl TrainOptions {
    /// Creates train options from explicit flag values.
    pub const fn new(accident: bool, fly: bool, smoke: bool) -> Self {
        Self {
            accident,
            fly,
            smoke,
        }
    }
}

impl Default for TrainOptions {
    fn default() -> Self {
        Self::new(false, false, true)
    }
}

/// A destination that can draw text at a screen coordinate.
pub trait RenderTarget {
    /// The error returned when drawing fails.
    type Error;

    /// Draws `value` with its first grapheme at `line`, `column`.
    fn draw_str(&mut self, line: i32, column: i32, value: &str) -> Result<(), Self::Error>;
}

/// Errors that can stop train rendering.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RenderError<TargetError> {
    /// The train has moved fully off screen.
    Offscreen,
    /// The render target failed while drawing text.
    Target(TargetError),
}

pub use c51::add_c51;
pub use d51::add_d51;
pub use logo::add_logo;

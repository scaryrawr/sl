#![no_std]
//! **libsl** – core rendering library for the SL (Steam Locomotive) animation.
//!
//! This crate provides the data structures and functions needed to render ASCII-art
//! steam locomotives onto any surface that implements [`RenderTarget`]. It is designed
//! to work in both `no_std` environments (e.g., WebAssembly) and standard applications.
//!
//! # Train types
//!
//! Three train variants are available:
//! - [`create_d51`] – the classic D51 steam locomotive
//! - [`create_c51`] – the C51 steam locomotive
//! - [`create_logo`] – a small logo train
//!
//! Choose a factory once, then call [`Train::render`] for each frame. Call
//! [`Train::reset`] before replaying the same train.
//!
//! # Example
//!
//! ```
//! use libsl::{create_d51, RenderTarget, ScreenSize, TrainOptions};
//!
//! struct Terminal;
//! impl RenderTarget for Terminal {
//!     type Error = std::convert::Infallible;
//!     fn draw_str(&mut self, line: i32, column: i32, value: &str) -> Result<(), Self::Error> {
//!         println!("({},{}) {}", line, column, value);
//!         Ok(())
//!     }
//! }
//!
//! let mut term = Terminal;
//! let mut train = create_d51(TrainOptions::default());
//! for x in (0..80).rev() {
//!     train.render(x, &["hello", "world"], ScreenSize::new(80, 24), &mut term).unwrap();
//! }
//! ```

extern crate alloc;

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

pub use c51::create_c51;
pub use d51::create_d51;
pub use logo::create_logo;

use add_smoke::Smoke;
use add_train::RenderContext;

type DrawTrain<T, U> =
    fn(i32, &[T], RenderContext<'_, U>) -> Result<(), RenderError<<U as RenderTarget>::Error>>;

/// One animated train. Its style, options and smoke belong to it across frames.
pub struct Train<T, U: RenderTarget> {
    draw: DrawTrain<T, U>,
    options: TrainOptions,
    smoke: Smoke<U>,
}

impl<T, U: RenderTarget> Train<T, U> {
    fn new(options: TrainOptions, draw: DrawTrain<T, U>) -> Self {
        Self {
            draw,
            options,
            smoke: Smoke::new(options.smoke),
        }
    }

    /// Draws one frame using the current labels and screen size. Returns
    /// [`RenderError::Offscreen`] when the train has left the display, or
    /// [`RenderError::Target`] if drawing fails.
    pub fn render(
        &mut self,
        x: i32,
        names: &[T],
        screen: ScreenSize,
        target: &mut U,
    ) -> Result<(), RenderError<U::Error>> {
        (self.draw)(
            x,
            names,
            RenderContext {
                target,
                screen,
                options: &self.options,
                smoke: &mut self.smoke,
            },
        )
    }

    /// Starts a fresh pass with the same style and options.
    pub fn reset(&mut self) {
        self.smoke.reset();
    }
}

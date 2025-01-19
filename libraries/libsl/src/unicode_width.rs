#[cfg(feature = "std")]
mod std_width;

#[cfg(not(feature = "std"))]
mod no_std_width;

#[cfg(feature = "std")]
pub use std_width::UnicodeWidthStr;

#[cfg(not(feature = "std"))]
pub use no_std_width::UnicodeWidthStr;

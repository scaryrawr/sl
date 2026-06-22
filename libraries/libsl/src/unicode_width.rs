//! Unicode character width utilities.
//!
//! Provides the [`UnicodeWidthStr`] trait which adds a `.width()` method to `str`,
//! returning the display width in terminal character cells (accounting for wide/CJK characters).

use core::str;

/// Extension trait that adds display-width measurement to `str`.
pub trait UnicodeWidthStr {
    /// Return the display width of the string in terminal character cells.
    ///
    /// Wide characters (e.g., CJK ideograms) count as 2 cells; ASCII and most
    /// Latin characters count as 1.
    fn width(&self) -> usize;
}

impl UnicodeWidthStr for str {
    fn width(&self) -> usize {
        unicode_display_width::width(self) as usize
    }
}

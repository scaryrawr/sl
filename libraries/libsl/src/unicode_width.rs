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
        if self
            .as_bytes()
            .iter()
            .all(|byte| byte.is_ascii_graphic() || *byte == b' ')
        {
            return self.len();
        }

        unicode_display_width::width(self) as usize
    }
}

#[cfg(test)]
mod tests {
    use super::UnicodeWidthStr;

    #[test]
    fn printable_ascii_uses_one_cell_per_byte() {
        assert_eq!("SL train |/\\ 123".width(), 16);
    }

    #[test]
    fn non_ascii_keeps_unicode_display_width() {
        assert_eq!("SL \u{56f8}".width(), 5);
    }
}

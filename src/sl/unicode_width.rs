pub trait UnicodeWidthStr {
    fn width(&self) -> usize;
}

impl UnicodeWidthStr for str {
    fn width(&self) -> usize {
        unicode_display_width::width(self) as usize
    }
}

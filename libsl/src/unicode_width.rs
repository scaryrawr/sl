use core::str;

pub trait UnicodeWidthStr {
    fn width(&self) -> usize;
}

impl UnicodeWidthStr for str {
    fn width(&self) -> usize {
        if self.contains('\u{200D}') {
            return unicode_width::UnicodeWidthStr::width(self);
        }

        unicode_display_width::width(self) as usize
    }
}

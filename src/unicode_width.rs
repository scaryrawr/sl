pub trait UnicodeWidthChar {
    fn width(&self) -> Option<usize>;
}

pub trait UnicodeWidthStr {
    fn width(&self) -> usize;
}

impl UnicodeWidthChar for char {
    fn width(&self) -> Option<usize> {
        Some(unicode_display_width::width(self.to_string().as_str()) as usize)
    }
}

impl UnicodeWidthStr for str {
    fn width(&self) -> usize {
        unicode_display_width::width(self) as usize
    }
}

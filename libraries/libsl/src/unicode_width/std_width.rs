use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

pub trait UnicodeWidthStr {
    fn width(&self) -> usize;
}

static CACHE: LazyLock<Mutex<HashMap<String, usize>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

impl UnicodeWidthStr for str {
    fn width(&self) -> usize {
        let mut cache = CACHE.lock().unwrap();
        if let Some(&width) = cache.get(self) {
            return width;
        }
        let width = unicode_display_width::width(self) as usize;
        cache.insert(self.to_string(), width);
        width
    }
}

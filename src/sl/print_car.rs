use super::unicode_width::UnicodeWidthStr;
use std::{
    collections::HashMap,
    sync::{LazyLock, Mutex},
};
use unicode_segmentation::UnicodeSegmentation;

const OK: i32 = 0;

static CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn cached_car(key: &str) -> Option<String> {
    match CACHE.lock() {
        Ok(cache) => cache.get(key).cloned(),
        Err(_) => None,
    }
}

pub fn print_car(
    buffer: *mut u8,
    buffer_len: u32,
    format: &str,
    text: &str,
    text_display_width: u32,
) -> i32 {
    // No format string, just copy text
    if !format.contains("{}") {
        let copy_len = std::cmp::min(format.len(), buffer_len as usize - 1);
        unsafe {
            std::ptr::copy_nonoverlapping(format.as_ptr(), buffer, copy_len);
            *buffer.add(copy_len) = 0;
        }
        return OK;
    }

    let cache_key = format.replace("{}", text);
    let formatted_text = match cached_car(&cache_key) {
        Some(s) => s,
        None => {
            let formatted_text = car_text(buffer_len, text_display_width, format, text);
            match CACHE.lock() {
                Ok(mut cache) => {
                    cache.insert(cache_key, formatted_text.clone());
                }
                Err(_) => {}
            }
            formatted_text
        }
    };

    let copy_len = std::cmp::min(formatted_text.len(), buffer_len as usize - 1);
    unsafe {
        std::ptr::copy_nonoverlapping(formatted_text.as_ptr(), buffer, copy_len);
        *buffer.add(copy_len) = 0;
    }

    return OK;
}

fn car_text(buffer_len: u32, text_display_width: u32, format: &str, text: &str) -> String {
    let text_display_width = text_display_width as usize;

    let mut text_clusters: Vec<&str> = text.graphemes(true).collect();
    let mut working_text = text.to_string();
    let format_width = format.len() - 2;

    // We need to remove clusters until we will fit in the buffer
    if working_text.width() > text_display_width
        || working_text.len() + (text_display_width - working_text.width()) + format_width
            > buffer_len as usize
    {
        if let Some(start) = (0..text_clusters.len()).rev().find_map(|i| {
            let front_width = text_clusters[0..i].iter().map(|c| c.width()).sum::<usize>();
            if front_width < text_display_width {
                let front_len = text_clusters[0..i].iter().map(|c| c.len()).sum::<usize>();
                let extra_spaces = text_display_width - front_width;
                if front_len + extra_spaces + format_width < buffer_len as usize {
                    return Some(i);
                }
            }

            None
        }) {
            text_clusters.splice(start.., std::iter::empty());
        }

        working_text = text_clusters.join("");
    }

    let spaces = if working_text.width() < text_display_width {
        text_display_width - working_text.width()
    } else {
        0
    };

    working_text += " ".repeat(spaces).as_str();

    let format = format.replace("{}", working_text.as_str());
    format
}

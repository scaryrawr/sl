use super::unicode_width::UnicodeWidthStr;
use std::{
    collections::HashMap,
    io::Error,
    sync::{LazyLock, Mutex},
};
use unicode_segmentation::UnicodeSegmentation;

static CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn cached_car(key: &str) -> Option<String> {
    match CACHE.lock() {
        Ok(cache) => cache.get(key).cloned(),
        Err(_) => None,
    }
}

pub fn print_car(
    buffer: &mut [u8],
    format: &str,
    text: &str,
    text_display_width: usize,
) -> Result<(), Error> {
    // No format string, just copy text
    if !format.contains("{}") {
        let copy_len = std::cmp::min(format.len(), buffer.len() - 1);
        buffer[0..copy_len].copy_from_slice(format.as_bytes());
        buffer[copy_len] = 0;
        return Ok(());
    }

    let cache_key = format.replace("{}", text);
    let formatted_text = match cached_car(&cache_key) {
        Some(s) => s,
        None => {
            let formatted_text = car_text(buffer.len(), text_display_width, format, text);
            match CACHE.lock() {
                Ok(mut cache) => {
                    cache.insert(cache_key, formatted_text.clone());
                }
                Err(_) => {}
            }

            formatted_text
        }
    };

    let copy_len = std::cmp::min(formatted_text.len(), buffer.len() - 1);
    buffer[0..copy_len].copy_from_slice(formatted_text.as_bytes());
    buffer[copy_len] = 0;

    Ok(())
}

fn car_text(buffer_len: usize, text_display_width: usize, format: &str, text: &str) -> String {
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

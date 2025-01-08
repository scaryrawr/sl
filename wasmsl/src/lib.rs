mod utils;

use std::str::FromStr;

use js_sys::{Function, JsString};
use wasm_bindgen::prelude::*;
use web_sys::console;

#[wasm_bindgen]
pub struct Display {
    cols: i32,
    lines: i32,
    add_str: Function,
}

#[wasm_bindgen]
impl Display {
    #[wasm_bindgen(constructor)]
    pub fn new(cols: i32, lines: i32, add_str: Function) -> Display {
        Display {
            cols,
            lines,
            add_str,
        }
    }
}

#[wasm_bindgen]
pub fn set_panic_hook() {
    utils::set_panic_hook();
}

#[wasm_bindgen]
pub fn add_d51(x: i32, names: Vec<String>, display: &Display) -> bool {
    match libsl::add_d51(
        x,
        &names,
        &libsl::Display {
            add_str: |y: i32, x: i32, text: &str| {
                display
                    .add_str
                    .call3(
                        &JsValue::NULL,
                        &JsValue::from(y),
                        &JsValue::from(x),
                        &JsString::from_str(text).unwrap(),
                    )
                    .unwrap();
            },
            cols: display.cols,
            lines: display.lines,
        },
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

#[wasm_bindgen]
pub fn add_logo(x: i32, names: Vec<String>, display: &Display) -> bool {
    match libsl::add_logo(
        x,
        &names,
        &libsl::Display {
            add_str: |x: i32, y: i32, text: &str| {
                display
                    .add_str
                    .call3(
                        &JsValue::NULL,
                        &JsValue::from(x),
                        &JsValue::from(y),
                        &JsString::from_str(text).unwrap(),
                    )
                    .unwrap();
            },
            cols: display.cols,
            lines: display.lines,
        },
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

#[wasm_bindgen]
pub fn add_c51(x: i32, names: Vec<String>, display: &Display) -> bool {
    console::log_1(&JsValue::from(x));
    match libsl::add_c51(
        x,
        &names,
        &libsl::Display {
            add_str: |x: i32, y: i32, text: &str| {
                let mut buffer = text.to_string();
                buffer = buffer.replace(" ", "\u{00A0}");

                display
                    .add_str
                    .call3(
                        &JsValue::NULL,
                        &JsValue::from(x),
                        &JsValue::from(y),
                        &JsString::from_str(&buffer).unwrap(),
                    )
                    .unwrap();
            },
            cols: display.cols,
            lines: display.lines,
        },
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

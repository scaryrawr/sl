mod utils;

use std::str::FromStr;

use js_sys::{Array, Function, JsString};
use wasm_bindgen::prelude::*;

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
pub fn add_d51(x: i32, names: &Array, display: &Display) -> bool {
    match libsl::add_d51(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
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

#[wasm_bindgen]
pub fn add_logo(x: i32, names: &Array, display: &Display) -> bool {
    match libsl::add_logo(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
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

#[wasm_bindgen]
pub fn add_c51(x: i32, names: &Array, display: &Display) -> bool {
    match libsl::add_c51(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
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
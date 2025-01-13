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

impl libsl::Display for Display {
    fn add_str(&self, y: i32, x: i32, s: &str) {
        self.add_str
            .call3(
                &JsValue::NULL,
                &JsValue::from(y),
                &JsValue::from(x),
                &JsString::from_str(s).unwrap(),
            )
            .unwrap();
    }

    fn cols(&self) -> i32 {
        self.cols
    }

    fn lines(&self) -> i32 {
        self.lines
    }
}

#[wasm_bindgen]
pub struct Options {
    accident: bool,
    fly: bool,
    smoke: bool,
}

#[wasm_bindgen]
impl Options {
    #[wasm_bindgen(constructor)]
    pub fn new(accident: bool, fly: bool, smoke: bool) -> Options {
        Options {
            accident,
            fly,
            smoke,
        }
    }
}

impl libsl::Options for Options {
    fn accident(&self) -> bool {
        self.accident
    }

    fn fly(&self) -> bool {
        self.fly
    }

    fn smoke(&self) -> bool {
        self.smoke
    }
}

#[wasm_bindgen]
pub fn set_panic_hook() {
    utils::set_panic_hook();
}

#[wasm_bindgen]
pub fn add_d51(x: i32, names: &Array, display: &Display, options: &Options) -> bool {
    match libsl::add_d51(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
        display,
        options,
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

#[wasm_bindgen]
pub fn add_logo(x: i32, names: &Array, display: &Display, options: &Options) -> bool {
    match libsl::add_logo(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
        display,
        options,
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

#[wasm_bindgen]
pub fn add_c51(x: i32, names: &Array, display: &Display, options: &Options) -> bool {
    match libsl::add_c51(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
        display,
        options,
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

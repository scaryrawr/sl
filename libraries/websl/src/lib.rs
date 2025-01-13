mod utils;

use std::str::FromStr;

use js_sys::{Array, Function, JsString};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
/// A struct representing the display where the train animation will be rendered.
pub struct Display {
    cols: i32,
    lines: i32,
    add_str: Function,
}

#[wasm_bindgen]
impl Display {
    #[wasm_bindgen(constructor)]
    /// Creates a new Display representation.
    ///
    /// # Arguments
    ///
    /// * `cols` - The number of columns in the display representation.
    /// * `lines` - The number of lines in the display.
    /// * `add_str` - A JavaScript function to add a string to the display.
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
/// A struct representing the options for the train animation.
pub struct Options {
    accident: bool,
    fly: bool,
    smoke: bool,
}

#[wasm_bindgen]
impl Options {
    #[wasm_bindgen(constructor)]
    /// Creates a new Options.
    ///
    /// # Arguments
    ///
    /// * `accident` - Whether to show an accident.
    /// * `fly` - Whether the train should fly.
    /// * `smoke` - Whether to show smoke.
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
/// Sets the panic hook for better error messages in the console.
pub fn set_panic_hook() {
    utils::set_panic_hook();
}

#[wasm_bindgen]
/// Adds a D51 train to the display.
///
/// # Arguments
///
/// * `x` - The x-coordinate of the train.
/// * `names` - An array of names to display on the train cars.
/// * `display` - The display where the train will be rendered.
/// * `options` - The options for the train animation.
///
/// # Returns
///
/// `true` if the train was added successfully, `false` otherwise.
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
/// Adds a logo train to the display.
///
/// # Arguments
///
/// * `x` - The x-coordinate of the train.
/// * `names` - An array of names to display on the train cars.
/// * `display` - The display where the train will be rendered.
/// * `options` - The options for the train animation.
///
/// # Returns
///
/// `true` if the train was added successfully, `false` otherwise.
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
/// Adds a C51 train to the display.
///
/// # Arguments
///
/// * `x` - The x-coordinate of the train.
/// * `names` - An array of names to display on the train cars.
/// * `display` - The display where the train will be rendered.
/// * `options` - The options for the train animation.
///
/// # Returns
///
/// `true` if the train was added successfully, `false` otherwise.
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

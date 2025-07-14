mod utils;

use std::cell::RefCell;
use std::str::FromStr;

use js_sys::{Array, Function, JsString};
use wasm_bindgen::prelude::*;

thread_local! {
    static DISPLAY_COLS: RefCell<i32> = RefCell::new(0);
    static DISPLAY_LINES: RefCell<i32> = RefCell::new(0);
    static DISPLAY_ADD_STR: RefCell<Option<Function>> = RefCell::new(None);
}

#[no_mangle]
pub extern "C" fn add_str(line: i32, column: i32, value: *const u8, len: usize) {
    let s = unsafe { std::slice::from_raw_parts(value, len) };
    let string = std::str::from_utf8(s).unwrap();
    
    DISPLAY_ADD_STR.with(|f| {
        if let Some(func) = f.borrow().as_ref() {
            func.call3(
                &JsValue::NULL,
                &JsValue::from(line),
                &JsValue::from(column),
                &JsString::from_str(string).unwrap(),
            ).unwrap();
        }
    });
}

#[no_mangle]
pub extern "C" fn cols() -> i32 {
    DISPLAY_COLS.with(|c| *c.borrow())
}

#[no_mangle]
pub extern "C" fn lines() -> i32 {
    DISPLAY_LINES.with(|l| *l.borrow())
}

#[wasm_bindgen]
/// Sets the display parameters for the global extern functions
pub fn set_display(cols: i32, lines: i32, add_str: Function) {
    DISPLAY_COLS.with(|c| *c.borrow_mut() = cols);
    DISPLAY_LINES.with(|l| *l.borrow_mut() = lines);
    DISPLAY_ADD_STR.with(|f| *f.borrow_mut() = Some(add_str));
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
/// * `cols` - The number of columns in the display.
/// * `lines` - The number of lines in the display.
/// * `add_str` - A JavaScript function to add a string to the display.
/// * `options` - The options for the train animation.
///
/// # Returns
///
/// `true` if the train was added successfully, `false` otherwise.
pub fn add_d51(x: i32, names: &Array, cols: i32, lines: i32, add_str: Function, options: &Options) -> bool {
    set_display(cols, lines, add_str);
    match libsl::add_d51(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
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
/// * `cols` - The number of columns in the display.
/// * `lines` - The number of lines in the display.
/// * `add_str` - A JavaScript function to add a string to the display.
/// * `options` - The options for the train animation.
///
/// # Returns
///
/// `true` if the train was added successfully, `false` otherwise.
pub fn add_logo(x: i32, names: &Array, cols: i32, lines: i32, add_str: Function, options: &Options) -> bool {
    set_display(cols, lines, add_str);
    match libsl::add_logo(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
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
/// * `cols` - The number of columns in the display.
/// * `lines` - The number of lines in the display.
/// * `add_str` - A JavaScript function to add a string to the display.
/// * `options` - The options for the train animation.
///
/// # Returns
///
/// `true` if the train was added successfully, `false` otherwise.
pub fn add_c51(x: i32, names: &Array, cols: i32, lines: i32, add_str: Function, options: &Options) -> bool {
    set_display(cols, lines, add_str);
    match libsl::add_c51(
        x,
        &names
            .iter()
            .map(|x| x.as_string().unwrap())
            .collect::<Vec<String>>(),
        options,
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

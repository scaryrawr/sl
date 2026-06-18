mod utils;

use js_sys::{Array, Function};
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

    fn screen_size(&self) -> libsl::ScreenSize {
        libsl::ScreenSize::new(self.cols, self.lines)
    }
}

impl libsl::RenderTarget for Display {
    type Error = JsValue;

    fn draw_str(&mut self, y: i32, x: i32, s: &str) -> Result<(), Self::Error> {
        self.add_str
            .call3(
                &JsValue::NULL,
                &JsValue::from(y),
                &JsValue::from(x),
                &JsValue::from_str(s),
            )
            .map(|_| ())
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

    fn train_options(&self) -> libsl::TrainOptions {
        libsl::TrainOptions::new(self.accident, self.fly, self.smoke)
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
pub fn add_d51(x: i32, names: &Array, display: &mut Display, options: &Options) -> bool {
    let names = names_from_array(names);
    let screen = display.screen_size();
    let options = options.train_options();

    render_result(libsl::add_d51(x, &names, screen, display, &options))
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
pub fn add_logo(x: i32, names: &Array, display: &mut Display, options: &Options) -> bool {
    let names = names_from_array(names);
    let screen = display.screen_size();
    let options = options.train_options();

    render_result(libsl::add_logo(x, &names, screen, display, &options))
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
pub fn add_c51(x: i32, names: &Array, display: &mut Display, options: &Options) -> bool {
    let names = names_from_array(names);
    let screen = display.screen_size();
    let options = options.train_options();

    render_result(libsl::add_c51(x, &names, screen, display, &options))
}

fn names_from_array(names: &Array) -> Vec<String> {
    names
        .iter()
        .map(|x| x.as_string().unwrap())
        .collect::<Vec<String>>()
}

fn render_result(result: Result<(), libsl::RenderError<JsValue>>) -> bool {
    match result {
        Ok(()) => true,
        Err(libsl::RenderError::Offscreen) => false,
        Err(libsl::RenderError::Target(error)) => wasm_bindgen::throw_val(error),
    }
}

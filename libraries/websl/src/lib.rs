mod utils;

use js_sys::Function;
use libsl::{create_c51, create_d51, create_logo, RenderError, TrainOptions};
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
pub enum TrainStyle {
    D51 = "d51",
    C51 = "c51",
    Logo = "logo",
}

#[wasm_bindgen]
/// An animated train with its own renderer and passenger labels.
pub struct Train {
    inner: libsl::Train<String, Display>,
    names: Vec<String>,
}

#[wasm_bindgen]
impl Train {
    #[wasm_bindgen(constructor)]
    /// Selects the renderer and snapshots the car labels for this animation.
    pub fn new(
        style: TrainStyle,
        names: Vec<String>,
        accident: bool,
        fly: bool,
        smoke: bool,
    ) -> Result<Train, JsError> {
        let create_train = match style {
            TrainStyle::D51 => create_d51,
            TrainStyle::C51 => create_c51,
            TrainStyle::Logo => create_logo,
            _ => return Err(JsError::new("Unknown train style")),
        };
        Ok(Self {
            inner: create_train(TrainOptions::new(accident, fly, smoke)),
            names,
        })
    }

    /// Returns false when offscreen; display errors propagate to JavaScript.
    pub fn render(&mut self, x: i32, display: &mut Display) -> Result<bool, JsValue> {
        match self
            .inner
            .render(x, &self.names, display.screen_size(), display)
        {
            Ok(()) => Ok(true),
            Err(RenderError::Offscreen) => Ok(false),
            Err(RenderError::Target(error)) => Err(error),
        }
    }

    /// Starts a fresh pass without rebuilding the train or its labels.
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

#[wasm_bindgen]
/// Sets the panic hook for better error messages in the console.
pub fn set_panic_hook() {
    utils::set_panic_hook();
}

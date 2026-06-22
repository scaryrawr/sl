//! Core train rendering logic shared by all train types (D51, C51, logo).
//!
//! This module contains the generic [`add_train`] function that takes sprite frame
//! buffers and layout offsets, then renders the engine, coal car, passenger cars,
//! optional smoke, and optional accident passengers onto a [`crate::RenderTarget`].

use crate::{RenderError, RenderTarget, ScreenSize, TrainOptions};

use super::add_man::add_man;
use super::add_smoke::add_smoke;
use super::mvaddstr::mvaddstr;
use super::print_car::print_car;
use core::str;

/// Positions and height of window elements on a train car (engine or passenger).
#[derive(Debug)]
pub struct WindowOffsets<const COUNT: usize> {
    /// Number of vertical rows the windows occupy.
    pub height: i32,
    /// Column offsets for each window within the car sprite.
    pub window_positions: [i32; COUNT],
}

/// Layout constants that describe the geometry of a specific train variant.
#[derive(Debug)]
pub struct TrainOffsets<const ENGINE_WINDOWS: usize, const CAR_WINDOWS: usize> {
    /// Column offset of the smoke funnel on the engine.
    pub funnel: i32,
    /// Window layout on the engine.
    pub engine_windows: WindowOffsets<ENGINE_WINDOWS>,
    /// Window layout on each passenger car.
    pub car_windows: WindowOffsets<CAR_WINDOWS>,
    /// Maximum character width for text rendered inside a passenger car.
    pub car_text_width: usize,
}

/// The sprite frame buffers for a train: engine animation frames, coal car, and passenger car.
///
/// * `HEIGHT` – number of rows in each sprite.
/// * `ANIMATIONS` – number of engine animation frames (the train cycles through these as it moves).
pub struct TrainFrames<const HEIGHT: usize, const ANIMATIONS: usize> {
    /// Engine animation frames. Each frame is `HEIGHT` rows of ASCII art.
    pub engine: [[&'static str; HEIGHT]; ANIMATIONS],
    /// Single-frame coal car sprite.
    pub coal: [&'static str; HEIGHT],
    /// Single-frame passenger car sprite (contains `{}` placeholder for text).
    pub car: [&'static str; HEIGHT],
}

/// Render a complete train (engine + coal car + passenger cars) at position `x`.
///
/// The train is drawn using the provided [`TrainFrames`] and [`TrainOffsets`].
/// Passenger car text is taken from `names`. Smoke and accident passengers are
/// controlled by [`TrainOptions`].
///
/// # Arguments
///
/// * `x` – Horizontal position of the train front.
/// * `frames` – Sprite data for the engine, coal car, and passenger car.
/// * `offsets` – Layout constants (window positions, funnel position, text width).
/// * `names` – Text labels to render inside each passenger car.
/// * `screen` – Dimensions of the drawable area.
/// * `target` – The render destination.
/// * `options` – Animation flags (accident, fly, smoke).
///
/// # Returns
///
/// `Ok(())` on success. Returns [`RenderError::Offscreen`] if the train has
/// scrolled entirely past the left edge of the screen.
pub fn add_train<
    const ANIMATIONS: usize,
    const HEIGHT: usize,
    const ENGINE_WINDOWS: usize,
    const CAR_WINDOWS: usize,
    T: AsRef<str>,
    U: RenderTarget,
>(
    x: i32,
    frames: &TrainFrames<HEIGHT, ANIMATIONS>,
    offsets: TrainOffsets<ENGINE_WINDOWS, CAR_WINDOWS>,
    names: &[T],
    screen: ScreenSize,
    target: &mut U,
    options: &TrainOptions,
) -> Result<(), RenderError<U::Error>> {
    if screen.columns <= 0 || screen.lines <= 0 {
        return Err(RenderError::Offscreen);
    }

    let car_length: i32 = (frames.car[0].len() - 1).try_into().unwrap();
    let num_frames: i32 = (ANIMATIONS + 1).try_into().unwrap();
    let count: i32 = names.len().try_into().unwrap();
    let engine_length: i32 = frames.engine[0][0].len().try_into().unwrap();
    let front_length: i32 = engine_length + frames.coal[0].len() as i32;
    let fly_factor = if options.fly { 1 } else { 0 };
    if x < -(front_length + (if count > 0 { count * car_length } else { 0 })) {
        return Err(RenderError::Offscreen);
    }

    let engine_height: i32 = frames.engine.len().try_into().unwrap();
    let mut y = screen.lines / 2 - engine_height / 2;
    let mut dy = 0;
    if options.fly {
        y = (((x / num_frames) + screen.lines) - screen.columns / num_frames) - engine_height;
        // Try to estimate when the train is off screen enough.
        if y < -(engine_height * screen.columns / screen.lines) {
            return Err(RenderError::Offscreen);
        }

        dy = 1;
    }

    for ui in 0..HEIGHT {
        let i: i32 = ui.try_into().unwrap();
        if (front_length + x) > 0 {
            mvaddstr(
                y + i,
                x,
                frames.engine[((x + front_length) % frames.engine.len() as i32) as usize][ui],
                screen,
                target,
            )
            .map_err(RenderError::Target)?;
            mvaddstr(
                (y + i) + dy,
                x + engine_length - 1,
                frames.coal[ui],
                screen,
                target,
            )
            .map_err(RenderError::Target)?;
        }

        for j in 0..count {
            let uj: usize = j.try_into().unwrap();
            let pos = (front_length + x) + (car_length * (j + 1));
            if pos < 0 {
                continue;
            } else if pos > (screen.columns + front_length) {
                break;
            }

            let mut car_name: [u8; 256] = [0; 256];
            print_car(
                car_name.as_mut(),
                frames.car[ui],
                names[uj].as_ref(),
                offsets.car_text_width,
            );
            mvaddstr(
                ((y + i) + (fly_factor * (j + 1))) + dy,
                (x + engine_length - 1) + (car_length * (j + 1)),
                str::from_utf8(&car_name).unwrap(),
                screen,
                target,
            )
            .map_err(RenderError::Target)?;
        }
    }

    if options.accident {
        offsets
            .engine_windows
            .window_positions
            .iter()
            .try_for_each(|offset| {
                add_man(
                    y + offsets.engine_windows.height,
                    x + offset,
                    screen,
                    target,
                )
                .map_err(RenderError::Target)
            })?;

        for uj in 0..count {
            let j = uj;
            let pos = (front_length + x) + (car_length * (j + 1));
            if pos < 0 {
                continue;
            } else if pos > (screen.columns + front_length) {
                break;
            }

            offsets
                .car_windows
                .window_positions
                .iter()
                .try_for_each(|offset| {
                    add_man(
                        (y + offsets.car_windows.height) + (fly_factor * (j + 2)),
                        ((x + front_length) + offset) + (car_length * j),
                        screen,
                        target,
                    )
                    .map_err(RenderError::Target)
                })?;
        }
    }

    if options.smoke {
        add_smoke(y - 1, x + offsets.funnel, screen, target).map_err(RenderError::Target)?;
    }

    Ok(())
}

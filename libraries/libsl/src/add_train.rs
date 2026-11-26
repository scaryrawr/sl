//! Core train rendering logic shared by all train types (D51, C51, logo).
//!
//! This module contains the generic [`add_train`] function that takes sprite frame
//! buffers and layout offsets, then renders the engine, coal car, passenger cars,
//! optional smoke, and optional accident passengers onto a [`crate::RenderTarget`].

use crate::{RenderError, RenderTarget, ScreenSize, Smoke, TrainOptions};

use super::add_man::add_man;
use super::mvaddstr::mvaddstr;
use super::print_car::{print_car, LABEL_MARKER};
use core::str;

/// Columns that two adjacent sprites share.
///
/// Inherited from the original curses `sl`: every sprite is authored one column wider than
/// the space it occupies so its coupling lands on the last column of the sprite in front of
/// it. The engine therefore ends one column before the coal car starts, and each car's
/// length is its sprite width minus this overlap.
const SPRITE_OVERLAP: usize = 1;

/// Bytes reserved for one rendered passenger-car row.
///
/// Inherited from the original curses `sl`, which rendered every car row into a fixed
/// `char car_name[256]`. The row only ever holds one sprite line plus a label, so the size
/// is a generous constant rather than a computed maximum; [`print_car`] truncates the label
/// to whatever is left after the sprite's `{}` placeholder.
const CAR_ROW_BUFFER_BYTES: usize = 256;

/// Character cells a carriage label may fill, derived from the carriage sprite.
///
/// Exactly one row of `car` carries [`LABEL_MARKER`], and that row's art is
/// `prefix + "{}" + suffix`: everything except the marker is fixed carriage metal. Because
/// the finished row has to read as wide as the carriage itself (`car[0]`), the label may fill
/// precisely the columns the marker row leaves over. Deriving the width here, instead of
/// hand-writing it per train, keeps it true whenever a sprite is redrawn.
pub const fn car_label_width<const HEIGHT: usize>(car: &[&str; HEIGHT]) -> usize {
    let body_width = car[0].len();
    let marker = LABEL_MARKER.as_bytes();
    let mut row = 0;
    while row < HEIGHT {
        let line = car[row].as_bytes();
        let mut column = 0;
        while column + marker.len() <= line.len() {
            if line[column] == marker[0] && line[column + 1] == marker[1] {
                return body_width - (line.len() - marker.len());
            }
            column += 1;
        }
        row += 1;
    }
    panic!("a carriage sprite must keep a row holding the label placeholder");
}

/// Positions and height of window elements on a train car (engine or passenger).
#[derive(Debug)]
pub struct WindowOffsets<const COUNT: usize> {
    /// Sprite row, counted from the top of the car, where its windows start. Accident
    /// passengers are drawn from this row down, so their heads appear in the windows.
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

/// Render destination and per-train state for one frame.
pub struct RenderContext<'a, U: RenderTarget> {
    /// The render destination.
    pub target: &'a mut U,
    /// Dimensions of the drawable area.
    pub screen: ScreenSize,
    /// Animation flags (accident, fly, smoke).
    pub options: &'a TrainOptions,
    /// Smoke renderer and particle state owned by this train.
    pub smoke: &'a mut Smoke<U>,
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
/// * `context` – Destination, geometry, animation flags, and smoke state
///   (see [`RenderContext`]).
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
    context: RenderContext<'_, U>,
) -> Result<(), RenderError<U::Error>> {
    let RenderContext {
        screen,
        options,
        target,
        smoke,
    } = context;

    if screen.columns <= 0 || screen.lines <= 0 {
        return Err(RenderError::Offscreen);
    }

    // The car's last column is shared with the sprite in front of it, so it does not add width.
    let car_length: i32 = (frames.car[0].len() - SPRITE_OVERLAP).try_into().unwrap();
    // One wheel-animation step per column, over `ANIMATIONS + 1` columns: the flying train
    // climbs one row per engine cycle so its wheels keep turning in step with the ascent.
    let climb_columns: i32 = (ANIMATIONS + 1).try_into().unwrap();
    let count: i32 = names.len().try_into().unwrap();
    let engine_length: i32 = frames.engine[0][0].len().try_into().unwrap();
    let front_length: i32 = engine_length + frames.coal[0].len() as i32;
    // Rows each successive car drops below the one in front: flying tilts the train into a
    // diagonal, while a grounded train keeps every car on the engine's row.
    let fly_row_drop = if options.fly { 1 } else { 0 };
    if x < -(front_length + (if count > 0 { count * car_length } else { 0 })) {
        return Err(RenderError::Offscreen);
    }

    let engine_height: i32 = frames.engine.len().try_into().unwrap();
    let mut y = screen.lines / 2 - engine_height / 2;
    let mut dy = 0;
    if options.fly {
        y = (((x / climb_columns) + screen.lines) - screen.columns / climb_columns) - engine_height;
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
                x + engine_length - SPRITE_OVERLAP as i32,
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

            let mut car_name: [u8; CAR_ROW_BUFFER_BYTES] = [0; CAR_ROW_BUFFER_BYTES];
            print_car(
                car_name.as_mut(),
                frames.car[ui],
                names[uj].as_ref(),
                offsets.car_text_width,
            );
            mvaddstr(
                ((y + i) + (fly_row_drop * (j + 1))) + dy,
                (x + engine_length - SPRITE_OVERLAP as i32) + (car_length * (j + 1)),
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
                        // One row further down than the car itself: the passenger dangles out
                        // of the window, below the car's own diagonal offset.
                        (y + offsets.car_windows.height) + (fly_row_drop * (j + 2)),
                        ((x + front_length) + offset) + (car_length * j),
                        screen,
                        target,
                    )
                    .map_err(RenderError::Target)
                })?;
        }
    }

    smoke
        .draw(y - 1, x + offsets.funnel, screen, target)
        .map_err(RenderError::Target)
}

#[cfg(test)]
mod tests {
    use core::str;

    use super::{car_label_width, CAR_ROW_BUFFER_BYTES};
    use crate::print_car::print_car;

    /// A carriage small enough to check by hand: the body rows are 8 columns wide and the
    /// marker row leaves `| ` plus ` |` (4 columns) of fixed art, so its label gets 4 cells.
    const SPRITE: [&str; 3] = ["+------+", "| {} |", "+------+"];

    #[test]
    fn label_width_is_what_the_marker_row_leaves_over() {
        assert_eq!(car_label_width(&SPRITE), 4);
    }

    #[test]
    fn a_padded_label_makes_its_row_as_wide_as_the_carriage() {
        let mut buffer = [0; CAR_ROW_BUFFER_BYTES];
        print_car(&mut buffer, SPRITE[1], "abcd", car_label_width(&SPRITE));

        let end = buffer.iter().position(|byte| *byte == 0).unwrap();
        assert_eq!(str::from_utf8(&buffer[..end]).unwrap(), "| abcd |");
        assert_eq!(end, SPRITE[0].len());
    }
}

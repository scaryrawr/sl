//! Accident-mode passenger rendering.
//!
//! When accident mode is enabled, small ASCII people are drawn below train windows,
//! alternating between a standing figure `(O) \O/` and a plea for help.

use crate::{RenderTarget, ScreenSize};

use super::mvaddstr::mvaddstr;

/// Vertical rows a passenger occupies: a head row above a body row.
const ROWS: usize = 2;

/// Frames that each passenger row alternates between.
const FRAMES: usize = 2;

/// Columns the train travels before a passenger switches frame.
///
/// Inherited from the original curses `sl`, whose `add_man` picked the frame with
/// `(abs(x) / 12) % 2`. 12 is roughly the width of one carriage window, so a passenger
/// waves once as each window scrolls past.
const FRAME_TOGGLE_INTERVAL: i32 = 12;

/// Frames per row: the top row hides or shouts, the bottom row stands or waves.
const MAN_FRAMES: [[&str; FRAMES]; ROWS] = [["", "Help!"], ["(O)", "\\O/"]];

/// Draw a person (passenger) at position `(y, x)` for the accident animation.
///
/// Two frames alternate based on the x position: a standing figure and a "Help!" message.
///
/// # Arguments
///
/// * `y` – Row position for the top of the figure.
/// * `x` – Column position.
/// * `screen` – Dimensions of the drawable area.
/// * `target` – The render destination.
///
/// # Returns
///
/// `Ok(())` on success, or the render target's error if drawing fails.
pub fn add_man<T: RenderTarget>(
    y: i32,
    x: i32,
    screen: ScreenSize,
    target: &mut T,
) -> Result<(), T::Error> {
    for (i, row) in MAN_FRAMES.iter().enumerate() {
        let frame = (x.abs() / FRAME_TOGGLE_INTERVAL % FRAMES as i32) as usize;
        mvaddstr(y + i as i32, x, row[frame], screen, target)?;
    }

    Ok(())
}

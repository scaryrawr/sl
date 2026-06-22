//! Accident-mode passenger rendering.
//!
//! When accident mode is enabled, small ASCII people are drawn below train windows,
//! alternating between a standing figure `(O) \O/` and a plea for help.

use crate::{RenderTarget, ScreenSize};

use super::mvaddstr::mvaddstr;

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
    const MAN: [[&str; 2]; 2] = [["", "Help!"], ["(O)", "\\O/"]];
    for (i, row) in MAN.iter().enumerate() {
        let man = row[(x.abs() / 12 % 2) as usize];
        mvaddstr(y + i as i32, x, man, screen, target)?;
    }

    Ok(())
}

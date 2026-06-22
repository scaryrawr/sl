//! Smoke particle animation for the train's funnel.
//!
//! Smoke particles rise and drift from the funnel position, fading from a large
//! shape to a single character and then disappearing. Two visual styles alternate
//! between smoke puffs `()` and `@`-based puffs.

use core::cmp::min;

use crate::{RenderTarget, ScreenSize};

use super::mvaddstr::mvaddstr;

/// Internal state tracked for each smoke particle.
#[derive(Copy, Clone, Debug)]
struct Smokes {
    /// Current row position.
    y: i32,
    /// Current column position.
    x: i32,
    /// Current frame index (0 = largest, 15 = disappeared).
    ptrn: usize,
    /// Visual style: 0 for `()` puffs, 1 for `@` puffs.
    kind: usize,
}

/// Persistent storage for up to 1000 smoke particles.
static mut SMOKES: [Smokes; 1000] = [Smokes {
    y: 0,
    x: 0,
    ptrn: 0,
    kind: 0,
}; 1000];

/// Render smoke particles rising from the train's funnel at position `(y, x)`.
///
/// Smoke is only emitted every 4 frames (`x % 4 == 0`). Each emission advances
/// existing particles upward and to the side, cycling through 16 frames from a
/// large puff down to a single character before disappearing.
///
/// # Arguments
///
/// * `y` – Row of the smoke funnel.
/// * `x` – Column of the smoke funnel.
/// * `screen` – Dimensions of the drawable area.
/// * `target` – The render destination.
///
/// # Returns
///
/// `Ok(())` on success, or the render target's error if drawing fails.
pub fn add_smoke<T: RenderTarget>(
    y: i32,
    x: i32,
    screen: ScreenSize,
    target: &mut T,
) -> Result<(), T::Error> {
    const SMOKE: [[&str; 16]; 2] = [
        [
            "(   )", "(    )", "(    )", "(   )", "(  )", "(  )", "( )", "( )", "()", "()", "O",
            "O", "O", "O", "O", " ",
        ],
        [
            "(@@@)", "(@@@@)", "(@@@@)", "(@@@)", "(@@)", "(@@)", "(@)", "(@)", "@@", "@@", "@",
            "@", "@", "@", "@", " ",
        ],
    ];
    const ERASER: [&str; 16] = [
        "     ", "      ", "      ", "     ", "    ", "    ", "   ", "   ", "  ", "  ", " ", " ",
        " ", " ", " ", " ",
    ];

    const DY: [i32; 16] = [2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const DX: [i32; 16] = [-2, -1, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3];

    if x % 4 == 0 {
        unsafe {
            let sum = (((screen.columns - (min(x, screen.columns))) / 4) % screen.columns) as usize;
            for i in 0..sum {
                mvaddstr(
                    SMOKES[i].y,
                    SMOKES[i].x,
                    ERASER[SMOKES[i].ptrn],
                    screen,
                    target,
                )?;
                SMOKES[i].y -= DY[SMOKES[i].ptrn];
                SMOKES[i].x += DX[SMOKES[i].ptrn];
                SMOKES[i].ptrn += if SMOKES[i].ptrn < 15 { 1 } else { 0 };
                mvaddstr(
                    SMOKES[i].y,
                    SMOKES[i].x,
                    SMOKE[SMOKES[i].kind][SMOKES[i].ptrn],
                    screen,
                    target,
                )?;
            }

            mvaddstr(y, x, SMOKE[sum % 2][0], screen, target)?;
            SMOKES[sum].y = y;
            SMOKES[sum].x = x;
            SMOKES[sum].ptrn = 0;
            SMOKES[sum].kind = sum % 2;
        }
    }

    Ok(())
}

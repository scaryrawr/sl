//! Smoke particle animation for the train's funnel.
//!
//! Smoke particles rise and drift from the funnel position, fading from a large
//! shape to a single character and then disappearing. Two visual styles alternate
//! between smoke puffs `()` and `@`-based puffs.
//!
//! All particle state lives in a caller-owned [`Smoke`] instance, so simultaneous
//! trains (for example, multiple wasm renderings on one page) never share puffs.

use alloc::vec::Vec;

use crate::{RenderTarget, ScreenSize};

use super::mvaddstr::mvaddstr;

/// Upper bound on live particles held by one [`Smoke`] instance.
const MAX_PARTICLES: usize = 1000;

/// Number of animation frames a puff lives before it disappears.
const PATTERN_LEN: usize = 16;

/// Internal state tracked for each smoke particle.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
struct SmokeParticle {
    /// Current row position.
    y: i32,
    /// Current column position.
    x: i32,
    /// Current frame index (0 = largest, 15 = disappeared).
    ptrn: usize,
    /// Visual style: 0 for `()` puffs, 1 for `@` puffs.
    kind: usize,
}

/// Per-train smoke particle state.
///
/// Create one instance per animated train and pass it to every frame of that
/// train's render calls. Two trains sharing a `RenderTarget` but keeping their
/// own `Smoke` never interfere with each other's particles.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Smoke {
    /// Live particles, oldest first. Grows on demand and drains as puffs expire.
    particles: Vec<SmokeParticle>,
}

impl Smoke {
    /// Creates smoke state with no live particles.
    pub fn new() -> Self {
        Self {
            particles: Vec::new(),
        }
    }
}

/// Render smoke particles rising from the train's funnel at position `(y, x)`.
///
/// Every 4 frames (`x % 4 == 0`) each live particle advances one step upward
/// and to the side, cycling through 16 frames from a large puff down to a
/// single character before disappearing. New puffs spawn only while the funnel
/// column `x` is on screen; once it passes the left edge, existing particles
/// keep aging so the trail finishes its lifecycle instead of freezing
/// mid-puff.
///
/// # Arguments
///
/// * `y` – Row of the smoke funnel.
/// * `x` – Column of the smoke funnel.
/// * `screen` – Dimensions of the drawable area.
/// * `target` – The render destination.
/// * `smoke` – Particle state owned by the rendered train.
///
/// # Returns
///
/// `Ok(())` on success, or the render target's error if drawing fails.
pub fn add_smoke<T: RenderTarget>(
    y: i32,
    x: i32,
    screen: ScreenSize,
    target: &mut T,
    smoke: &mut Smoke,
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
        let mut survivors = Vec::with_capacity(smoke.particles.len() + 1);
        for &particle in &smoke.particles {
            mvaddstr(
                particle.y,
                particle.x,
                ERASER[particle.ptrn],
                screen,
                target,
            )?;
            let particle = SmokeParticle {
                y: particle.y - DY[particle.ptrn],
                x: particle.x + DX[particle.ptrn],
                ptrn: particle.ptrn + 1,
                kind: particle.kind,
            };
            if particle.ptrn < PATTERN_LEN {
                mvaddstr(
                    particle.y,
                    particle.x,
                    SMOKE[particle.kind][particle.ptrn],
                    screen,
                    target,
                )?;
                survivors.push(particle);
            }
        }

        if x >= 0 {
            let kind = ((x / 4) % 2) as usize;
            if survivors.len() == MAX_PARTICLES {
                survivors.remove(0);
            }
            survivors.push(SmokeParticle {
                y,
                x,
                ptrn: 0,
                kind,
            });
            mvaddstr(y, x, SMOKE[kind][0], screen, target)?;
        }
        smoke.particles = survivors;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use core::convert::Infallible;

    use super::*;
    use crate::std::string::String;
    use crate::std::vec::Vec;

    struct RecordingTarget {
        draws: Vec<(i32, i32, String)>,
    }

    impl RenderTarget for RecordingTarget {
        type Error = Infallible;

        fn draw_str(&mut self, line: i32, column: i32, value: &str) -> Result<(), Self::Error> {
            self.draws.push((line, column, String::from(value)));
            Ok(())
        }
    }

    /// Visible puff shapes from the SMOKE table. Erasers and the trailing
    /// blank frame draw spaces or nothing, so they are excluded here.
    fn is_puff(value: &str) -> bool {
        matches!(
            value,
            "(   )"
                | "(    )"
                | "(  )"
                | "( )"
                | "()"
                | "(@@@)"
                | "(@@@@)"
                | "(@@)"
                | "(@)"
                | "@@"
                | "@"
                | "O"
        )
    }

    #[test]
    fn puffs_finish_their_lifecycle_after_the_funnel_exits_left() {
        let screen = ScreenSize::new(80, 24);
        let mut smoke = Smoke::new();
        let mut target = RecordingTarget { draws: Vec::new() };

        // Walk the funnel from column 16 down past the left edge. Puffs may
        // spawn only at x >= 0, but every live puff must keep aging at each
        // negative emission instead of freezing mid-pattern on screen.
        let mut puffs_per_emission = Vec::new();
        let mut offscreen_draws: Vec<(i32, i32, String)> = Vec::new();
        let mut x = 16;
        while x >= -64 {
            target.draws.clear();
            add_smoke(10, x, screen, &mut target, &mut smoke).expect("draw");
            puffs_per_emission.push(target.draws.iter().filter(|d| is_puff(&d.2)).count());
            if x < 0 {
                offscreen_draws.extend(target.draws.iter().cloned());
            }
            x -= 4;
        }

        // Spawn phase (x = 16, 12, 8, 4, 0): visible puffs exist.
        assert!(
            puffs_per_emission[..5].iter().all(|&n| n > 0),
            "on-screen emissions should draw puffs, got {puffs_per_emission:?}"
        );

        // Off-screen phase (x < 0): the trail must keep aging. A frozen
        // trail (an `x >= 0` gate on the whole emission) would draw nothing
        // at all here, so the first emissions after the funnel exits still
        // draw puffs, while the pattern's 16-step lifetime then empties it.
        let after_exit = &puffs_per_emission[5..];
        assert!(
            after_exit[..4].iter().all(|&n| n > 0),
            "puffs should keep aging (redrawing) after the funnel exits: {puffs_per_emission:?}"
        );
        assert!(
            after_exit.contains(&0),
            "every puff should expire after the funnel exits: {puffs_per_emission:?}"
        );

        // No new spawns off screen. A spawn is the only puff-shaped draw on
        // the funnel row; aged puffs rise, and space runs on that row are
        // just the final eraser clearing the last on-screen spawn.
        assert!(
            !offscreen_draws.iter().any(|d| d.0 == 10 && is_puff(&d.2)),
            "no puff should spawn once the funnel is off screen: {offscreen_draws:?}"
        );
    }

    #[test]
    fn no_panic_when_funnel_column_goes_negative() {
        // Regression: the slot scheme indexed a static array with a negative
        // funnel column (usize::MAX). The particle list must accept any x.
        let screen = ScreenSize::new(80, 24);
        let mut smoke = Smoke::new();
        let mut target = RecordingTarget { draws: Vec::new() };
        let mut x = 4;
        while x >= -400 {
            add_smoke(10, x, screen, &mut target, &mut smoke).expect("draw");
            x -= 4;
        }
    }
}

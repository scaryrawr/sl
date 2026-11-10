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

    if x >= 0 && x % 4 == 0 {
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
        smoke.particles = survivors;
    }

    Ok(())
}

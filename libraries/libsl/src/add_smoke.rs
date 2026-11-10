//! Smoke particle animation for the train's funnel.
//!
//! Smoke particles rise and drift from the funnel position, fading from a large
//! shape to a single character and then disappearing. Two visual styles alternate
//! between smoke puffs `()` and `@`-based puffs.
//!
//! All particle state lives in a caller-owned [`Smoke`] instance, so simultaneous
//! trains (for example, multiple wasm renderings on one page) never share puffs.

use core::cmp::min;

use crate::{RenderTarget, ScreenSize};

use super::mvaddstr::mvaddstr;

/// Number of particle slots tracked by one [`Smoke`] instance.
const MAX_PARTICLES: usize = 1000;

/// Internal state tracked for each smoke particle.
#[derive(Copy, Clone, Debug)]
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

const IDLE_PARTICLE: SmokeParticle = SmokeParticle {
    y: 0,
    x: 0,
    ptrn: 0,
    kind: 0,
};

/// Per-train smoke particle state.
///
/// Create one instance per animated train and pass it to every frame of that
/// train's render calls. Two trains sharing a `RenderTarget` but keeping their
/// own `Smoke` never interfere with each other's particles.
#[derive(Clone)]
pub struct Smoke {
    particles: [SmokeParticle; MAX_PARTICLES],
}

impl Smoke {
    /// Creates smoke state with no live particles.
    pub fn new() -> Self {
        Self {
            particles: [IDLE_PARTICLE; MAX_PARTICLES],
        }
    }
}

impl Default for Smoke {
    fn default() -> Self {
        Self::new()
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

    if x % 4 == 0 {
        let particles = &mut smoke.particles;
        let sum = (((screen.columns - (min(x, screen.columns))) / 4) % screen.columns) as usize;
        for particle in &mut particles[..sum] {
            mvaddstr(
                particle.y,
                particle.x,
                ERASER[particle.ptrn],
                screen,
                target,
            )?;
            particle.y -= DY[particle.ptrn];
            particle.x += DX[particle.ptrn];
            particle.ptrn += if particle.ptrn < 15 { 1 } else { 0 };
            mvaddstr(
                particle.y,
                particle.x,
                SMOKE[particle.kind][particle.ptrn],
                screen,
                target,
            )?;
        }

        mvaddstr(y, x, SMOKE[sum % 2][0], screen, target)?;
        particles[sum] = SmokeParticle {
            y,
            x,
            ptrn: 0,
            kind: sum % 2,
        };
    }

    Ok(())
}

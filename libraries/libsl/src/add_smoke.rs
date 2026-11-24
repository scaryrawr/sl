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

/// Number of animation frames a puff lives before it disappears.
///
/// Also the length of every per-frame pattern table below ([`SMOKE`], [`ERASER`], [`DY`],
/// [`DX`]), so a puff's art, its eraser, and its drift all step forward once per frame.
const PATTERN_LEN: usize = 16;

/// Puff shapes, one table per style, indexed by the puff's age in frames.
const SMOKE: [[&str; PATTERN_LEN]; STYLES] = [
    [
        "(   )", "(    )", "(    )", "(   )", "(  )", "(  )", "( )", "( )", "()", "()", "O", "O",
        "O", "O", "O", " ",
    ],
    [
        "(@@@)", "(@@@@)", "(@@@@)", "(@@@)", "(@@)", "(@@)", "(@)", "(@)", "@@", "@@", "@", "@",
        "@", "@", "@", " ",
    ],
];

/// Blank overwrites as wide as the puff frame at the same age, so each age step erases
/// exactly the art it drew last time. Both styles share these widths, which the test below
/// pins back to [`SMOKE`].
const ERASER: [&str; PATTERN_LEN] = [
    "     ", "      ", "      ", "     ", "    ", "    ", "   ", "   ", "  ", "  ", " ", " ", " ",
    " ", " ", " ",
];

/// Rows a puff rises per frame: the first step lifts two rows, the next three lift one,
/// after which the puff only spreads sideways.
const DY: [i32; PATTERN_LEN] = [2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/// Columns a puff shifts per frame, in screen coordinates: it lurches left while forming,
/// then drifts right as it dissipates behind the train.
const DX: [i32; PATTERN_LEN] = [-2, -1, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3];

/// Train columns (one per animation frame) between smoke puffs.
///
/// Inherited from the original curses `sl`, which emitted a puff on every fourth column
/// (`x % 4 == 0`) so the trail is sparse enough to read as puffs rather than a solid plume.
const EMISSION_INTERVAL: i32 = 4;

/// Puff styles that alternate along the trail: `()` puffs and `@`-filled puffs.
const STYLES: usize = 2;

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
/// Keep one instance per animated train and reuse it across frames.
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
/// single character before disappearing. New puffs spawn before the funnel
/// passes the right edge of the screen. Puffs emitted beyond the left edge are
/// initially clipped, but can drift back into view as the smoke trail follows
/// the train. All particles expire after 16 steps.
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
    if x % EMISSION_INTERVAL == 0 {
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

        // A funnel that has just passed the left edge keeps emitting for one puff lifetime:
        // a puff drifts 21 columns rightward across its PATTERN_LEN frames, so a window that
        // wide always brings the trail back on screen.
        if x >= -(PATTERN_LEN as i32) && x <= screen.columns {
            // Screen-relative phase: one puff is emitted per EMISSION_INTERVAL columns, so
            // dividing the distance the funnel has travelled by that interval counts puffs.
            // Taking it modulo STYLES flips the shape every other puff (every 8 columns).
            let puff_index = (screen.columns - x) / EMISSION_INTERVAL;
            let kind = puff_index.rem_euclid(STYLES as i32) as usize;
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

    #[test]
    fn every_eraser_is_as_wide_as_the_puff_it_clears() {
        for (style, frames) in SMOKE.iter().enumerate() {
            for (age, puff) in frames.iter().enumerate() {
                assert_eq!(
                    ERASER[age].len(),
                    puff.len(),
                    "eraser does not cover style {style} at age {age}"
                );
            }
        }
    }

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
    fn puff_style_keeps_its_screen_relative_phase() {
        for (columns, x, expected) in [
            (84, 76, "(   )"),
            (84, 80, "(@@@"),
            (85, 76, "(   )"),
            (85, 80, "(@@@)"),
            (88, 80, "(   )"),
            (88, 84, "(@@@"),
        ] {
            let mut target = RecordingTarget { draws: Vec::new() };
            add_smoke(
                10,
                x,
                ScreenSize::new(columns, 24),
                &mut target,
                &mut Smoke::new(),
            )
            .unwrap();
            assert_eq!(
                target.draws,
                [(10, x, String::from(expected))],
                "smoke style at column {x} on a {columns}-column screen"
            );
        }
    }

    #[test]
    fn pre_entry_emissions_do_not_add_visible_puffs() {
        for columns in [86, 88] {
            let screen = ScreenSize::new(columns, 24);
            let mut smoke = Smoke::new();
            let mut control_smoke = Smoke::new();
            let mut target = RecordingTarget { draws: Vec::new() };
            let mut control = RecordingTarget { draws: Vec::new() };

            for x in [96, 92, 88, 84, 80, 76] {
                target.draws.clear();
                control.draws.clear();
                add_smoke(10, x, screen, &mut target, &mut smoke).unwrap();
                if x <= columns {
                    add_smoke(10, x, screen, &mut control, &mut control_smoke).unwrap();
                    assert_eq!(
                        target.draws, control.draws,
                        "pre-entry smoke changed the frame at column {x} on a {columns}-column screen"
                    );
                    if columns == 88 && x == 84 {
                        assert!(
                            target.draws.iter().any(|draw| draw.0 == 8 && draw.1 == 86),
                            "the puff emitted at the screen boundary must drift into view"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn puffs_finish_their_lifecycle_after_the_funnel_exits_left() {
        let screen = ScreenSize::new(80, 24);
        let mut smoke = Smoke::new();
        let mut target = RecordingTarget { draws: Vec::new() };

        let mut puffs_per_emission = Vec::new();
        let mut offscreen_draws: Vec<(i32, i32, String)> = Vec::new();
        let mut x = 16;
        while x >= -96 {
            target.draws.clear();
            add_smoke(10, x, screen, &mut target, &mut smoke).expect("draw");
            puffs_per_emission.push(target.draws.iter().filter(|d| is_puff(&d.2)).count());
            if x < 0 {
                offscreen_draws.extend(target.draws.iter().cloned());
            }
            x -= 4;
        }

        assert!(
            puffs_per_emission[..5].iter().all(|&n| n > 0),
            "on-screen emissions should draw puffs, got {puffs_per_emission:?}"
        );

        // An offscreen funnel must stop spawning without freezing existing puffs.
        let after_exit = &puffs_per_emission[5..];
        assert!(
            after_exit[..4].iter().all(|&n| n > 0),
            "puffs should keep aging (redrawing) after the funnel exits: {puffs_per_emission:?}"
        );
        assert!(
            after_exit.contains(&0),
            "every puff should expire after the funnel exits: {puffs_per_emission:?}"
        );

        assert!(
            offscreen_draws.iter().any(|d| d.0 < 10 && is_puff(&d.2)),
            "offscreen emissions should drift back into view: {offscreen_draws:?}"
        );
    }

    #[test]
    fn offscreen_emission_drifts_into_view_from_empty_state() {
        let screen = ScreenSize::new(80, 24);
        let mut smoke = Smoke::new();
        let mut target = RecordingTarget { draws: Vec::new() };
        let mut visible_puffs = Vec::new();

        for emission in 0..=16 {
            let x = -4 - emission * 4;
            target.draws.clear();
            add_smoke(10, x, screen, &mut target, &mut smoke).expect("draw");
            visible_puffs.extend(
                target
                    .draws
                    .iter()
                    .filter(|draw| draw.1 >= 0 && draw.0 < 10 && is_puff(&draw.2))
                    .cloned(),
            );
        }

        assert!(
            !visible_puffs.is_empty(),
            "an empty smoke state must emit offscreen puffs that drift into view"
        );
    }

    #[test]
    fn no_panic_when_funnel_column_goes_negative() {
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

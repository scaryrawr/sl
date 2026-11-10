use crate::{
    add_train::{add_train, RenderContext, TrainFrames, TrainOffsets, WindowOffsets},
    RenderError, RenderTarget, ScreenSize, Smoke, TrainOptions,
};

/// Adds a D51 train to the display.
///
/// # Arguments
///
/// * `x` - The x-coordinate where the train should be added.
/// * `names` - A slice of strings representing the names to be displayed.
/// * `screen` - The drawable area available to the train.
/// * `target` - The destination where train text will be drawn.
/// * `options` - Options for customizing the train.
/// * `smoke` - Particle state for this train's smoke animation.
///
/// # Returns
///
/// * `Result<(), RenderError<_>>` - Returns `Ok(())` if successful.
pub fn add_d51<T: AsRef<str>, U: RenderTarget>(
    x: i32,
    names: &[T],
    screen: ScreenSize,
    target: &mut U,
    options: &TrainOptions,
    smoke: &mut Smoke,
) -> Result<(), RenderError<U::Error>> {
    const ENGINE: [[&str; 11]; 6] = [
        [
            "      ====        ________                ___________ ",
            "  _D _|  |_______/        \\__I_I_____===__|_________| ",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
            "   /     |  |   H  |  |     |   |         ||_| |_||   ",
            "  |      |  |   H  |__--------------------| [___] |   ",
            "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
            "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
            " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
            "  \\_/      \\O=====O=====O=====O_/      \\_/            ",
            "                                                      ",
        ],
        [
            "      ====        ________                ___________ ",
            "  _D _|  |_______/        \\__I_I_____===__|_________| ",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
            "   /     |  |   H  |  |     |   |         ||_| |_||   ",
            "  |      |  |   H  |__--------------------| [___] |   ",
            "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
            "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
            " |/-=|___|=O=====O=====O=====O   |_____/~\\___/        ",
            "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ",
            "                                                      ",
        ],
        [
            "      ====        ________                ___________ ",
            "  _D _|  |_______/        \\__I_I_____===__|_________| ",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
            "   /     |  |   H  |  |     |   |         ||_| |_||   ",
            "  |      |  |   H  |__--------------------| [___] |   ",
            "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
            "__/ =| o |=-O=====O=====O=====O \\ ____Y___________|__ ",
            " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
            "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ",
            "                                                      ",
        ],
        [
            "      ====        ________                ___________ ",
            "  _D _|  |_______/        \\__I_I_____===__|_________| ",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
            "   /     |  |   H  |  |     |   |         ||_| |_||   ",
            "  |      |  |   H  |__--------------------| [___] |   ",
            "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
            "__/ =| o |=-~O=====O=====O=====O\\ ____Y___________|__ ",
            " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
            "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ",
            "                                                      ",
        ],
        [
            "      ====        ________                ___________ ",
            "  _D _|  |_______/        \\__I_I_____===__|_________| ",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
            "   /     |  |   H  |  |     |   |         ||_| |_||   ",
            "  |      |  |   H  |__--------------------| [___] |   ",
            "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
            "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
            " |/-=|___|=   O=====O=====O=====O|_____/~\\___/        ",
            "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ",
            "                                                      ",
        ],
        [
            "      ====        ________                ___________ ",
            "  _D _|  |_______/        \\__I_I_____===__|_________| ",
            "   |(_)---  |   H\\________/ |   |        =|___ ___|   ",
            "   /     |  |   H  |  |     |   |         ||_| |_||   ",
            "  |      |  |   H  |__--------------------| [___] |   ",
            "  | ________|___H__/__|_____/[][]~\\_______|       |   ",
            "  |/ |   |-----------I_____I [][] []  D   |=======|__ ",
            "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ",
            " |/-=|___|=    ||    ||    ||    |_____/~\\___/        ",
            "  \\_/      \\_O=====O=====O=====O/      \\_/            ",
            "                                                      ",
        ],
    ];

    const COAL: [&str; 11] = [
        "                              ",
        "                              ",
        "    _________________         ",
        "   _|                \\_____A  ",
        " =|                        |  ",
        " -|                        |  ",
        "__|________________________|_ ",
        "|__________________________|_ ",
        "   |_D__D__D_|  |_D__D__D_|   ",
        "    \\_/   \\_/    \\_/   \\_/    ",
        "                              ",
    ];

    const CAR: [&str; 11] = [
        "  __________________________  ",
        "  |   ___  ___  ___  ___   |   ",
        "  |   | |  | |  | |  | |   |  ",
        "  |   |_|  |_|  |_|  |_|   |  ",
        "  |                        |  ",
        "  | {} |  ",
        "__|________________________|_ ",
        "|__________________________|_ ",
        "   |_D__D__D_|  |_D__D__D_|   ",
        "    \\_/   \\_/    \\_/   \\_/  ",
        "                              ",
    ];

    const FRAMES: TrainFrames<11, 6> = TrainFrames {
        engine: ENGINE,
        coal: COAL,
        car: CAR,
    };

    const OFFSETS: TrainOffsets<2, 4> = TrainOffsets {
        funnel: 7,
        engine_windows: WindowOffsets {
            height: 2,
            window_positions: [43, 47],
        },
        car_windows: WindowOffsets {
            height: 1,
            window_positions: [4, 9, 14, 19],
        },
        car_text_width: 22,
    };

    add_train(
        x,
        &FRAMES,
        OFFSETS,
        names,
        RenderContext {
            target,
            screen,
            options,
            smoke,
        },
    )
}

#[cfg(test)]
mod tests {
    use core::convert::Infallible;

    use super::*;
    use crate::std::string::String;
    use crate::std::vec::Vec;

    struct NoopTarget;

    impl RenderTarget for NoopTarget {
        type Error = Infallible;

        fn draw_str(&mut self, _line: i32, _column: i32, _value: &str) -> Result<(), Self::Error> {
            Ok(())
        }
    }

    const SCREEN: ScreenSize = ScreenSize::new(200, 24);

    /// D51 funnel offset, from `TrainOffsets::funnel`.
    const D51_FUNNEL: i32 = 7;

    /// Records every draw so tests can compare what a caller actually sees.
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

    fn run_frames<const N: usize>(
        xs: [i32; N],
        target: &mut RecordingTarget,
        options: &TrainOptions,
        smoke: &mut Smoke,
    ) {
        for x in xs {
            let _ = add_d51(x, &[] as &[&str], SCREEN, target, options, smoke);
        }
    }

    /// Puff strings from the module docs, both the `()` and `@` styles.
    /// Train sprites never contain parentheses or `@` characters.
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

    /// Puffs plus the space erasers that clear them. Erasers are pure spaces
    /// of at most 6 columns; clipped train art can only produce a space
    /// padding run of 6 at the engine's top row (row 6 on this screen).
    fn is_smoke_draw(row: i32, value: &str) -> bool {
        is_puff(value) || (row < 6 && value.chars().all(|c| c == ' ') && value.len() <= 6)
    }

    fn smoke_draws(target: &RecordingTarget) -> Vec<(i32, i32, String)> {
        target
            .draws
            .iter()
            .filter(|draw| is_smoke_draw(draw.0, &draw.2))
            .cloned()
            .collect()
    }

    #[test]
    fn returns_offscreen_when_train_has_passed_the_left_edge() {
        let mut target = NoopTarget;

        assert_eq!(
            add_d51(
                -400,
                &[] as &[&str],
                SCREEN,
                &mut target,
                &TrainOptions::default(),
                &mut Smoke::new()
            ),
            Err(RenderError::Offscreen)
        );
    }

    #[test]
    fn smoke_puffs_expire_within_16_emissions_behind_the_engine() {
        let options = TrainOptions::default();

        let mut target = RecordingTarget { draws: Vec::new() };
        run_frames([181], &mut target, &options, &mut Smoke::new());
        let first = smoke_draws(&target);
        assert!(
            first.iter().any(|draw| is_puff(&draw.2)),
            "the first frame should already emit a puff, got {first:?}"
        );

        // Keep the first puff's rightward drift on screen. After its lifetime,
        // the final frame must match a run that never emitted that first puff.
        let screen = ScreenSize::new(400, 24);
        let mut smoke = Smoke::new();
        let mut target = RecordingTarget { draws: Vec::new() };
        let mut control_smoke = Smoke::new();
        let mut control = RecordingTarget { draws: Vec::new() };
        for emission in 0..18 {
            let x = 181 - emission * 4;
            target.draws.clear();
            control.draws.clear();
            add_d51(x, &[] as &[&str], screen, &mut target, &options, &mut smoke).unwrap();
            if emission > 0 {
                add_d51(
                    x,
                    &[] as &[&str],
                    screen,
                    &mut control,
                    &options,
                    &mut control_smoke,
                )
                .unwrap();
            }
        }
        let late = smoke_draws(&target);
        assert_eq!(
            late,
            smoke_draws(&control),
            "expired puff still draws or erases"
        );
        let funnel_column = 181 - 17 * 4 + D51_FUNNEL;
        assert!(
            late.iter()
                .any(|draw| is_puff(&draw.2) && draw.1 == funnel_column),
            "fresh puffs near the funnel should still be visible: {late:?}"
        );
    }

    #[test]
    fn a_train_with_its_own_smoke_is_unaffected_by_another_train() {
        let options = TrainOptions::default();

        let mut solo = RecordingTarget { draws: Vec::new() };
        run_frames([181, 177, 173], &mut solo, &options, &mut Smoke::new());
        let expected = smoke_draws(&solo);
        assert!(
            expected.iter().any(|draw| is_puff(&draw.2)),
            "baseline frames should emit a smoke puff, got {expected:?}"
        );

        let mut b_smoke = Smoke::new();
        let mut mixed = RecordingTarget { draws: Vec::new() };
        let mut b_target = RecordingTarget { draws: Vec::new() };
        let xs_a = [181, 177, 173];
        let xs_b = [169, 165, 161];
        let mut a_smoke = Smoke::new();
        for i in 0..xs_a.len() {
            let _ = add_d51(
                xs_a[i],
                &[] as &[&str],
                SCREEN,
                &mut mixed,
                &options,
                &mut a_smoke,
            );
            let _ = add_d51(
                xs_b[i],
                &[] as &[&str],
                SCREEN,
                &mut b_target,
                &options,
                &mut b_smoke,
            );
        }

        assert_eq!(smoke_draws(&mixed), expected);
    }

    #[test]
    fn trains_sharing_one_smoke_instance_interfere() {
        let options = TrainOptions::default();

        let mut solo = RecordingTarget { draws: Vec::new() };
        run_frames([181, 177, 173], &mut solo, &options, &mut Smoke::new());
        let expected = smoke_draws(&solo);

        let mut shared = Smoke::new();
        let mut both = RecordingTarget { draws: Vec::new() };
        let mut b_target = RecordingTarget { draws: Vec::new() };
        for (xa, xb) in [(181, 169), (177, 165), (173, 161)] {
            let _ = add_d51(xa, &[] as &[&str], SCREEN, &mut both, &options, &mut shared);
            let _ = add_d51(
                xb,
                &[] as &[&str],
                SCREEN,
                &mut b_target,
                &options,
                &mut shared,
            );
        }

        assert_ne!(smoke_draws(&both), expected);
    }

    #[test]
    fn one_smoke_instance_replays_the_same_frames_identically() {
        let options = TrainOptions::default();

        let mut first = RecordingTarget { draws: Vec::new() };
        run_frames(
            [181, 177, 173, 169],
            &mut first,
            &options,
            &mut Smoke::new(),
        );

        let mut second = RecordingTarget { draws: Vec::new() };
        run_frames(
            [181, 177, 173, 169],
            &mut second,
            &options,
            &mut Smoke::new(),
        );

        assert_eq!(first.draws, second.draws);
        assert!(
            smoke_draws(&first).len() > 1,
            "replay should contain several smoke draws"
        );
    }
}

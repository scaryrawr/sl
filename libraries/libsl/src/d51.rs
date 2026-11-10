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

    /// True when `value` is one of the smoke puff or eraser strings.
    ///
    /// Train sprites never contain spaces, so a drawn string with spaces can
    /// only come from the smoke renderer.
    fn is_smoke_draw(value: &str) -> bool {
        value.contains(' ')
    }

    fn smoke_draws(target: &RecordingTarget) -> Vec<(i32, i32, String)> {
        target
            .draws
            .iter()
            .filter(|draw| is_smoke_draw(&draw.2))
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
    fn a_train_with_its_own_smoke_is_unaffected_by_another_train() {
        let options = TrainOptions::default();

        let mut solo = RecordingTarget { draws: Vec::new() };
        run_frames([180, 176, 172], &mut solo, &options, &mut Smoke::new());
        let expected = smoke_draws(&solo);
        assert!(
            expected.iter().any(|draw| draw.2.contains('(')),
            "baseline frames should emit a smoke puff, got {expected:?}"
        );

        let mut b_smoke = Smoke::new();
        let mut mixed = RecordingTarget { draws: Vec::new() };
        let xs_a = [180, 176, 172];
        let xs_b = [168, 164, 160];
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
                &mut mixed,
                &options,
                &mut b_smoke,
            );
        }

        // B renders at the same rows and shares the target, so its own smoke
        // and art draws are present too; A's draws must still match its solo run.
        let a_draws: Vec<(i32, i32, String)> = mixed
            .draws
            .into_iter()
            .filter(|draw| expected.contains(draw))
            .collect();
        assert_eq!(a_draws, expected);
    }

    #[test]
    fn trains_sharing_one_smoke_instance_interfere() {
        let options = TrainOptions::default();

        let mut solo = RecordingTarget { draws: Vec::new() };
        run_frames([180, 176, 172], &mut solo, &options, &mut Smoke::new());
        let expected = smoke_draws(&solo);

        let shared = Smoke::new();
        let mut both = RecordingTarget { draws: Vec::new() };
        let mut a_smoke = shared.clone();
        let mut b_smoke = shared;
        for (xa, xb) in [(180, 168), (176, 164), (172, 160)] {
            let _ = add_d51(
                xa,
                &[] as &[&str],
                SCREEN,
                &mut both,
                &options,
                &mut a_smoke,
            );
            let _ = add_d51(
                xb,
                &[] as &[&str],
                SCREEN,
                &mut both,
                &options,
                &mut b_smoke,
            );
        }

        assert_ne!(smoke_draws(&both), expected);
    }

    #[test]
    fn one_smoke_instance_replays_the_same_frames_identically() {
        let options = TrainOptions::default();

        let mut first = RecordingTarget { draws: Vec::new() };
        run_frames(
            [180, 176, 172, 168],
            &mut first,
            &options,
            &mut Smoke::new(),
        );

        let mut second = RecordingTarget { draws: Vec::new() };
        run_frames(
            [180, 176, 172, 168],
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

use super::add_train::{add_train, TrainFrames, TrainOffsets, WindowOffsets};
use crate::{RenderError, RenderTarget, ScreenSize, TrainOptions};

/// Adds a logo to the display.
///
/// # Arguments
///
/// * `x` - The x-coordinate where the logo should be added.
/// * `names` - A slice of strings representing the names to be displayed.
/// * `screen` - The drawable area available to the train.
/// * `target` - The destination where train text will be drawn.
/// * `options` - Options for customizing the train.
///
/// # Returns
///
/// * `Result<(), RenderError<_>>` - Returns `Ok(())` if successful.
pub fn add_logo<T: AsRef<str>, U: RenderTarget>(
    x: i32,
    names: &[T],
    screen: ScreenSize,
    target: &mut U,
    options: &TrainOptions,
) -> Result<(), RenderError<U::Error>> {
    const ENGINE: [[&str; 7]; 6] = [
        [
            "     ++      +------ ",
            "     ||      |+-+ |  ",
            "   /---------|| | |  ",
            "  + ========  +-+ |  ",
            " _|--O========O~\\-+  ",
            "//// \\_/      \\_/    ",
            "                     ",
        ],
        [
            "     ++      +------ ",
            "     ||      |+-+ |  ",
            "   /---------|| | |  ",
            "  + ========  +-+ |  ",
            " _|--/O========O\\-+  ",
            "//// \\_/      \\_/    ",
            "                     ",
        ],
        [
            "     ++      +------ ",
            "     ||      |+-+ |  ",
            "   /---------|| | |  ",
            "  + ========  +-+ |  ",
            " _|--/~O========O-+  ",
            "//// \\_/      \\_/    ",
            "                     ",
        ],
        [
            "     ++      +------ ",
            "     ||      |+-+ |  ",
            "   /---------|| | |  ",
            "  + ========  +-+ |  ",
            " _|--/~\\------/~\\-+  ",
            "//// \\_O========O    ",
            "                     ",
        ],
        [
            "     ++      +------ ",
            "     ||      |+-+ |  ",
            "   /---------|| | |  ",
            "  + ========  +-+ |  ",
            " _|--/~\\------/~\\-+  ",
            "//// \\O========O/    ",
            "                     ",
        ],
        [
            "     ++      +------ ",
            "     ||      |+-+ |  ",
            "   /---------|| | |  ",
            "  + ========  +-+ |  ",
            " _|--/~\\------/~\\-+  ",
            "//// O========O_/    ",
            "                     ",
        ],
    ];
    const COAL: [&str; 7] = [
        "____                 ",
        "|   \\@@@@@@@@@@@     ",
        "|    \\@@@@@@@@@@@@@_ ",
        "|                  | ",
        "|__________________| ",
        "   (O)       (O)     ",
        "                     ",
    ];

    const CAR: [&str; 7] = [
        " ____________________ ",
        " |  ___ ___ ___ ___ | ",
        " |  |_| |_| |_| |_| | ",
        "_| {} | ",
        "_|__________________| ",
        "    (O)        (O)    ",
        "                      ",
    ];

    const FRAMES: TrainFrames<7, 6> = TrainFrames {
        engine: ENGINE,
        coal: COAL,
        car: CAR,
    };

    const OFFSETS: TrainOffsets<1, 4> = TrainOffsets {
        funnel: 4,
        engine_windows: WindowOffsets {
            height: 1,
            window_positions: [14],
        },
        car_windows: WindowOffsets {
            height: 1,
            window_positions: [3, 7, 11, 15],
        },
        car_text_width: 16,
    };

    add_train(
        x, &FRAMES, OFFSETS, names, screen, target, options,
    )
}

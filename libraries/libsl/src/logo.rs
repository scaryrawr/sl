use super::add_train::{add_train, car_label_width, TrainFrames, TrainOffsets, WindowOffsets};
use crate::{RenderTarget, Train, TrainOptions};

/// Rows in every sprite of this train: engine frames, coal car, and carriage all stand this
/// tall, and it is the `HEIGHT` the shared renderer is instantiated with.
const HEIGHT: usize = 7;

/// Wheel-animation frames the engine cycles through as it travels.
const ANIMATIONS: usize = 6;

/// Windows on the engine cab, and windows on each carriage.
const ENGINE_WINDOWS: usize = 1;
const CAR_WINDOWS: usize = 4;

/// Column of the funnel that smoke rises from.
///
/// The logo engine's stack is the `++` at columns 4..5 of its top row, so smoke starts on the
/// stack's own column.
const FUNNEL: i32 = 4;

/// Engine sprite row holding the cab window (`+-+` in row 1); accident passengers are drawn
/// from this row down.
const ENGINE_WINDOW_ROW: i32 = 1;

/// Cab-window columns of the engine sprite; the logo cab has a single window.
const ENGINE_WINDOW_COLUMNS: [i32; ENGINE_WINDOWS] = [14];

/// Carriage sprite row holding the window bays (`___` in row 1); passengers are drawn from
/// this row down.
const CAR_WINDOW_ROW: i32 = 1;

/// Carriage window columns, one per bay, spaced 4 columns apart to match the sprite.
///
/// Each column sits one cell left of its `___` bay so the 3-cell `(O)` head covers the bay.
const CAR_WINDOW_COLUMNS: [i32; CAR_WINDOWS] = [3, 7, 11, 15];

/// Creates a small logo train with its own animation state.
pub fn create_logo<T: AsRef<str>, U: RenderTarget>(options: TrainOptions) -> Train<T, U> {
    const ENGINE: [[&str; HEIGHT]; ANIMATIONS] = [
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
    const COAL: [&str; HEIGHT] = [
        "____                 ",
        "|   \\@@@@@@@@@@@     ",
        "|    \\@@@@@@@@@@@@@_ ",
        "|                  | ",
        "|__________________| ",
        "   (O)       (O)     ",
        "                     ",
    ];

    const CAR: [&str; HEIGHT] = [
        " ____________________ ",
        " |  ___ ___ ___ ___ | ",
        " |  |_| |_| |_| |_| | ",
        "_| {} | ",
        "_|__________________| ",
        "    (O)        (O)    ",
        "                      ",
    ];

    const FRAMES: TrainFrames<HEIGHT, ANIMATIONS> = TrainFrames {
        engine: ENGINE,
        coal: COAL,
        car: CAR,
    };

    const OFFSETS: TrainOffsets<ENGINE_WINDOWS, CAR_WINDOWS> = TrainOffsets {
        funnel: FUNNEL,
        engine_windows: WindowOffsets {
            height: ENGINE_WINDOW_ROW,
            window_positions: ENGINE_WINDOW_COLUMNS,
        },
        car_windows: WindowOffsets {
            height: CAR_WINDOW_ROW,
            window_positions: CAR_WINDOW_COLUMNS,
        },
        car_text_width: car_label_width(&CAR),
    };

    Train::new(options, |x, names, context| {
        add_train(x, &FRAMES, OFFSETS, names, context)
    })
}

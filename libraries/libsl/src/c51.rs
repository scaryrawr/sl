use crate::{RenderError, RenderTarget, ScreenSize, Smoke, TrainOptions};

use super::add_train::{
    add_train, car_label_width, RenderContext, TrainFrames, TrainOffsets, WindowOffsets,
};

/// Rows in every sprite of this train: engine frames, coal car, and carriage all stand this
/// tall, and it is the `HEIGHT` the shared renderer is instantiated with.
const HEIGHT: usize = 12;

/// Wheel-animation frames the engine cycles through as it travels.
const ANIMATIONS: usize = 6;

/// Windows on the engine cab, and windows on each carriage.
const ENGINE_WINDOWS: usize = 2;
const CAR_WINDOWS: usize = 4;

/// Column of the funnel that smoke rises from, at the base of the engine's stack.
///
/// The C51 stack crown is the `___` spanning columns 8..10 of the engine's top row, so smoke
/// starts one column to its left, where the stack meets the boiler.
const FUNNEL: i32 = 7;

/// Engine sprite row holding the cab windows (`___ ___` in row 3); accident passengers are
/// drawn from this row down so their heads appear in the cab.
const ENGINE_WINDOW_ROW: i32 = 3;

/// Cab-window columns of the engine sprite, one per window, spaced 4 columns apart.
const ENGINE_WINDOW_COLUMNS: [i32; ENGINE_WINDOWS] = [45, 49];

/// Carriage sprite row holding the window bays (`___` in row 2); passengers are drawn from
/// this row down. The C51 carriage art sits one row lower than the D51's.
const CAR_WINDOW_ROW: i32 = 2;

/// Carriage window columns, one per bay, spaced 5 columns apart to match the sprite.
///
/// Each column sits two cells left of its `___` bay so the 3-cell `(O)` head and the 5-cell
/// `Help!` line both land on the bay instead of beside it.
const CAR_WINDOW_COLUMNS: [i32; CAR_WINDOWS] = [4, 9, 14, 19];

/// Adds a C51 train to the display.
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
pub fn add_c51<T: AsRef<str>, U: RenderTarget>(
    x: i32,
    names: &[T],
    screen: ScreenSize,
    target: &mut U,
    options: &TrainOptions,
    smoke: &mut Smoke,
) -> Result<(), RenderError<U::Error>> {
    const ENGINE: [[&str; HEIGHT]; ANIMATIONS] = [
        [
            "        ___                                            ",
            "       _|_|_  _     __       __             ___________",
            "    D__/   \\_(_)___|  |__H__|  |_____I_Ii_()|_________|",
            "     | `---'   |:: `--'  H  `--'         |  |___ ___|  ",
            "    +|~~~~~~~~++::~~~~~~~H~~+=====+~~~~~~|~~||_| |_||  ",
            "    ||        | ::       H  +=====+      |  |::  ...|  ",
            "|    | _______|_::-----------------[][]-----|       |  ",
            "| /~~ ||   |-----/~~~~\\  /[I_____I][][] --|||_______|__",
            "------'|oOo|=[]=-      ||      ||      |  ||=======_|__",
            "/~\\____|___|/~\\_|  O=======O=======O   |__|+-/~\\_|     ",
            "\\_/         \\_/  \\____/  \\____/  \\____/      \\_/       ",
            "                                                       ",
        ],
        [
            "        ___                                            ",
            "       _|_|_  _     __       __             ___________",
            "    D__/   \\_(_)___|  |__H__|  |_____I_Ii_()|_________|",
            "     | `---'   |:: `--'  H  `--'         |  |___ ___|  ",
            "    +|~~~~~~~~++::~~~~~~~H~~+=====+~~~~~~|~~||_| |_||  ",
            "    ||        | ::       H  +=====+      |  |::  ...|  ",
            "|    | _______|_::-----------------[][]-----|       |  ",
            "| /~~ ||   |-----/~~~~\\  /[I_____I][][] --|||_______|__",
            "------'|oOo|=[]=- O=======O=======O    |  ||=======_|__",
            "/~\\____|___|/~\\_|      ||      ||      |__|+-/~\\_|     ",
            "\\_/         \\_/  \\____/  \\____/  \\____/      \\_/       ",
            "                                                       ",
        ],
        [
            "        ___                                            ",
            "       _|_|_  _     __       __             ___________",
            "    D__/   \\_(_)___|  |__H__|  |_____I_Ii_()|_________|",
            "     | `---'   |:: `--'  H  `--'         |  |___ ___|  ",
            "    +|~~~~~~~~++::~~~~~~~H~~+=====+~~~~~~|~~||_| |_||  ",
            "    ||        | ::       H  +=====+      |  |::  ...|  ",
            "|    | _______|_::-----------------[][]-----|       |  ",
            "| /~~ ||   |-----/~~~~\\  /[I_____I][][] --|||_______|__",
            "------'|oOo|==[]=- O=======O=======O   |  ||=======_|__",
            "/~\\____|___|/~\\_|      ||      ||      |__|+-/~\\_|     ",
            "\\_/         \\_/  \\____/  \\____/  \\____/      \\_/       ",
            "                                                       ",
        ],
        [
            "        ___                                            ",
            "       _|_|_  _     __       __             ___________",
            "    D__/   \\_(_)___|  |__H__|  |_____I_Ii_()|_________|",
            "     | `---'   |:: `--'  H  `--'         |  |___ ___|  ",
            "    +|~~~~~~~~++::~~~~~~~H~~+=====+~~~~~~|~~||_| |_||  ",
            "    ||        | ::       H  +=====+      |  |::  ...|  ",
            "|    | _______|_::-----------------[][]-----|       |  ",
            "| /~~ ||   |-----/~~~~\\  /[I_____I][][] --|||_______|__",
            "------'|oOo|===[]=- O=======O=======O  |  ||=======_|__",
            "/~\\____|___|/~\\_|      ||      ||      |__|+-/~\\_|     ",
            "\\_/         \\_/  \\____/  \\____/  \\____/      \\_/       ",
            "                                                       ",
        ],
        [
            "        ___                                            ",
            "       _|_|_  _     __       __             ___________",
            "    D__/   \\_(_)___|  |__H__|  |_____I_Ii_()|_________|",
            "     | `---'   |:: `--'  H  `--'         |  |___ ___|  ",
            "    +|~~~~~~~~++::~~~~~~~H~~+=====+~~~~~~|~~||_| |_||  ",
            "    ||        | ::       H  +=====+      |  |::  ...|  ",
            "|    | _______|_::-----------------[][]-----|       |  ",
            "| /~~ ||   |-----/~~~~\\  /[I_____I][][] --|||_______|__",
            "------'|oOo|===[]=-    ||      ||      |  ||=======_|__",
            "/~\\____|___|/~\\_|    O=======O=======O |__|+-/~\\_|     ",
            "\\_/         \\_/  \\____/  \\____/  \\____/      \\_/       ",
            "                                                       ",
        ],
        [
            "        ___                                            ",
            "       _|_|_  _     __       __             ___________",
            "    D__/   \\_(_)___|  |__H__|  |_____I_Ii_()|_________|",
            "     | `---'   |:: `--'  H  `--'         |  |___ ___|  ",
            "    +|~~~~~~~~++::~~~~~~~H~~+=====+~~~~~~|~~||_| |_||  ",
            "    ||        | ::       H  +=====+      |  |::  ...|  ",
            "|    | _______|_::-----------------[][]-----|       |  ",
            "| /~~ ||   |-----/~~~~\\  /[I_____I][][] --|||_______|__",
            "------'|oOo|==[]=-     ||      ||      |  ||=======_|__",
            "/~\\____|___|/~\\_|   O=======O=======O  |__|+-/~\\_|     ",
            "\\_/         \\_/  \\____/  \\____/  \\____/      \\_/       ",
            "                                                       ",
        ],
    ];

    const COAL: [&str; HEIGHT] = [
        "                              ",
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

    const CAR: [&str; HEIGHT] = [
        "                              ",
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

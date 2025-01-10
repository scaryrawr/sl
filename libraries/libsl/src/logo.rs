use crate::{add_train::Error, Display, Options};

use super::add_train::{add_train, TrainOffsets, WindowOffsets};

pub fn add_logo<T: AsRef<str>, U: Display, V: Options>(
    x: i32,
    names: &[T],
    display: &U,
    options: &V,
) -> Result<(), Error> {
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

    add_train(x, &ENGINE, &COAL, &CAR, OFFSETS, names, display, options)
}

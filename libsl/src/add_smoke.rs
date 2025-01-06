use crate::Display;

use super::mvaddstr::mvaddstr;

#[derive(Copy, Clone, Debug)]
struct Smokes {
    y: i32,
    x: i32,
    ptrn: usize,
    kind: usize,
}

static mut SMOKES: [Smokes; 1000] = [Smokes {
    y: 0,
    x: 0,
    ptrn: 0,
    kind: 0,
}; 1000];

static mut SUM: usize = 0;

pub fn add_smoke(y: i32, x: i32, display: &Display) {
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
        unsafe {
            if SUM < SMOKES.len() {
                for i in 0..SUM {
                    _ = mvaddstr(
                        SMOKES[i].y,
                        SMOKES[i].x,
                        ERASER[SMOKES[i].ptrn],
                        display.add_str,
                    );
                    SMOKES[i].y -= DY[SMOKES[i].ptrn];
                    SMOKES[i].x += DX[SMOKES[i].ptrn];
                    SMOKES[i].ptrn += if SMOKES[i].ptrn < 15 { 1 } else { 0 };
                    _ = mvaddstr(
                        SMOKES[i].y,
                        SMOKES[i].x,
                        SMOKE[SMOKES[i].kind][SMOKES[i].ptrn],
                        display.add_str,
                    );
                }

                _ = mvaddstr(y, x, SMOKE[SUM % 2][0], display.add_str);
                SMOKES[SUM].y = y;
                SMOKES[SUM].x = x;
                SMOKES[SUM].ptrn = 0;
                SMOKES[SUM].kind = SUM % 2;
                SUM += 1;
            }
        }
    }
}

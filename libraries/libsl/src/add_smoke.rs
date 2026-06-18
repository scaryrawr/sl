use core::cmp::min;

use crate::{RenderTarget, ScreenSize};

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

pub fn add_smoke<T: RenderTarget>(
    y: i32,
    x: i32,
    screen: ScreenSize,
    target: &mut T,
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
        unsafe {
            let sum = (((screen.columns - (min(x, screen.columns))) / 4) % screen.columns) as usize;
            for i in 0..sum {
                mvaddstr(
                    SMOKES[i].y,
                    SMOKES[i].x,
                    ERASER[SMOKES[i].ptrn],
                    screen,
                    target,
                )?;
                SMOKES[i].y -= DY[SMOKES[i].ptrn];
                SMOKES[i].x += DX[SMOKES[i].ptrn];
                SMOKES[i].ptrn += if SMOKES[i].ptrn < 15 { 1 } else { 0 };
                mvaddstr(
                    SMOKES[i].y,
                    SMOKES[i].x,
                    SMOKE[SMOKES[i].kind][SMOKES[i].ptrn],
                    screen,
                    target,
                )?;
            }

            mvaddstr(y, x, SMOKE[sum % 2][0], screen, target)?;
            SMOKES[sum].y = y;
            SMOKES[sum].x = x;
            SMOKES[sum].ptrn = 0;
            SMOKES[sum].kind = sum % 2;
        }
    }

    Ok(())
}

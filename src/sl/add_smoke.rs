use super::mvaddstr::mvaddstr;

#[derive(Copy, Clone, Debug)]
struct Smokes {
    y: i32,
    x: i32,
    ptrn: usize,
    kind: usize,
}

use std::sync::LazyLock;
use std::sync::Mutex;

static SMOKES: LazyLock<Mutex<[Smokes; 1000]>> = LazyLock::new(|| {
    Mutex::new(
        [Smokes {
            y: 0,
            x: 0,
            ptrn: 0,
            kind: 0,
        }; 1000],
    )
});

static SUM: LazyLock<Mutex<usize>> = LazyLock::new(|| Mutex::new(0));

pub fn add_smoke(y: i32, x: i32) {
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
        let mut smokes = SMOKES.lock().unwrap();
        let mut sum = SUM.lock().unwrap();

        if *sum < smokes.len() {
            for i in 0..*sum {
                _ = mvaddstr(smokes[i].y, smokes[i].x, ERASER[smokes[i].ptrn]);
                smokes[i].y -= DY[smokes[i].ptrn];
                smokes[i].x += DX[smokes[i].ptrn];
                smokes[i].ptrn += if smokes[i].ptrn < 15 { 1 } else { 0 };
                _ = mvaddstr(
                    smokes[i].y,
                    smokes[i].x,
                    SMOKE[smokes[i].kind][smokes[i].ptrn],
                );
            }

            _ = mvaddstr(y, x, SMOKE[*sum % 2][0]);
            smokes[*sum].y = y;
            smokes[*sum].x = x;
            smokes[*sum].ptrn = 0;
            smokes[*sum].kind = *sum % 2;
            *sum += 1;
        }
    }
}

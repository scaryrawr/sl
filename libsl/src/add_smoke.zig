const mvaddstr = @import("shared.zig").mvaddstr;

pub fn add_smoke(y: i32, x: i32) void {
    const struct_smokes = struct {
        y: i32,
        x: i32,
        ptrn: u32,
        kind: u32,
    };

    const static = struct {
        var smokes: [1000]struct_smokes = undefined;
        var sum: u32 = 0;
    };

    const Smoke = [2][16][:0]const u8{ [_][:0]const u8{
        "(   )",
        "(    )",
        "(    )",
        "(   )",
        "(  )",
        "(  )",
        "( )",
        "( )",
        "()",
        "()",
        "O",
        "O",
        "O",
        "O",
        "O",
        " ",
    }, [_][:0]const u8{
        "(@@@)",
        "(@@@@)",
        "(@@@@)",
        "(@@@)",
        "(@@)",
        "(@@)",
        "(@)",
        "(@)",
        "@@",
        "@@",
        "@",
        "@",
        "@",
        "@",
        "@",
        " ",
    } };
    const Eraser = [16][:0]const u8{
        "     ",
        "      ",
        "      ",
        "     ",
        "    ",
        "    ",
        "   ",
        "   ",
        "  ",
        "  ",
        " ",
        " ",
        " ",
        " ",
        " ",
        " ",
    };
    const dy = [16]i32{
        2,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
    };
    const dx = [16]i32{
        -2,
        -1,
        0,
        1,
        1,
        1,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        3,
        3,
        3,
    };

    if (@mod(x, 4) == 0 and static.sum < static.smokes.len) {
        for (0..static.sum) |i| {
            _ = mvaddstr(static.smokes[i].y, static.smokes[i].x, Eraser[static.smokes[i].ptrn]);
            static.smokes[i].y -= dy[static.smokes[i].ptrn];
            static.smokes[i].x += dx[static.smokes[i].ptrn];
            static.smokes[i].ptrn += if (static.smokes[i].ptrn < 15) 1 else 0;
            _ = mvaddstr(static.smokes[i].y, static.smokes[i].x, Smoke[static.smokes[i].kind][static.smokes[i].ptrn]);
        }

        _ = mvaddstr(y, x, Smoke[@mod(static.sum, 2)][0]);
        static.smokes[static.sum].y = y;
        static.smokes[static.sum].x = x;
        static.smokes[static.sum].ptrn = 0;
        static.smokes[static.sum].kind = @mod(static.sum, 2);
        static.sum += 1;
    }
}

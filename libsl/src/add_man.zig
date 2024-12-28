const sl = @cImport(@cInclude("sl.h"));

extern fn my_mvaddstr(y: i32, x: i32, str: [*:0]const u8) i32;

pub fn add_man(y: i32, x: i32) void {
    const man = [2][2][*:0]const u8{ [_][*:0]const u8{ "Help!", "" }, [_][*:0]const u8{ "\\O/", "(O)" } };
    for (man, 0..) |line, i| {
        if (my_mvaddstr(y + @as(i32, @intCast(i)), x, line[@as(usize, @intCast(@mod(@divTrunc(sl.LOGOLENGTH + x, 12), 2)))]) != 0) {
            break;
        }
    }
}

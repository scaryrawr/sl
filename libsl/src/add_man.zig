const mvaddstr = @import("shared.zig").mvaddstr;

pub fn add_man(y: i32, x: i32) void {
    const man = [2][2][:0]const u8{ [_][:0]const u8{ "Help!", "" }, [_][:0]const u8{ "\\O/", "(O)" } };
    for (man, 0..) |line, i| {
        _ = mvaddstr(y + @as(i32, @intCast(i)), x, line[@as(usize, @intCast(@mod(@divTrunc(84 + x, 12), 2)))]);
    }
}

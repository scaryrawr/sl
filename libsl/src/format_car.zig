const std = @import("std");
const DisplayWidth = @import("DisplayWidth");
const grapheme = @import("grapheme");

const Allocator = std.mem.Allocator;

fn trim_text(allocator: Allocator, text: []const u8, desired_width: u32) ![]u8 {
    const gd = try grapheme.GraphemeData.init(allocator);
    defer gd.deinit();

    var iter = grapheme.Iterator.init(text, &gd);

    const dwd = try DisplayWidth.DisplayWidthData.init(allocator);
    defer dwd.deinit();

    const display_width = DisplayWidth{ .data = &dwd };

    var width: usize = 0;
    var pos: usize = 0;
    while (iter.next()) |g| {
        const value = g.bytes(text);
        const segment_width = display_width.strWidth(value);
        if (width + segment_width > desired_width) {
            break;
        }

        width += segment_width;
        pos = g.offset + g.len;
    }

    return allocator.dupe(u8, text[0..pos]);
}

pub fn format_car(allocator: Allocator, fmt: []const u8, text: []const u8, desired_width: u32) ![]u8 {
    if (std.mem.count(u8, fmt, "{}") == 0) {
        return allocator.dupe(u8, fmt);
    }

    const dwd = try DisplayWidth.DisplayWidthData.init(allocator);
    defer dwd.deinit();

    // The `DisplayWidth` structure takes a pointer to the data.
    const dw = DisplayWidth{ .data = &dwd };
    const text_width = dw.strWidth(text);
    const value = if (text_width < desired_width)
        try dw.padRight(allocator, text, desired_width, " ")
    else if (text_width > desired_width)
        try trim_text(allocator, text, desired_width)
    else
        try allocator.dupe(u8, text);

    defer allocator.free(value);

    const size = std.mem.replacementSize(u8, fmt, "{}", value);
    const buf = try allocator.alloc(u8, size);
    errdefer allocator.free(buf);

    _ = std.mem.replace(u8, fmt, "{}", value, buf);
    return buf;
}

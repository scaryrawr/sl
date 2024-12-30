const c51 = @import("c51.zig");
const d51 = @import("d51.zig");
const logo = @import("logo.zig");

export fn add_C51(x: i32, namelist: [*][*:0]const u8, count: i32) i32 {
    return c51.add_C51(x, namelist[0..@as(usize, @intCast(count))]);
}

export fn add_D51(x: i32, namelist: [*][*:0]const u8, count: i32) i32 {
    return d51.add_D51(x, namelist[0..@as(usize, @intCast(count))]);
}

export fn add_sl(x: i32, namelist: [*][*:0]const u8, count: i32) i32 {
    return logo.add_logo(x, namelist[0..@as(usize, @intCast(count))]);
}

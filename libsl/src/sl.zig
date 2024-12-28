const smoke = @import("add_smoke.zig");
const man = @import("add_man.zig");

export fn add_smoke(y: i32, x: i32) void {
    smoke.add_smoke(y, x);
}

export fn add_man(y: i32, x: i32) void {
    man.add_man(y, x);
}

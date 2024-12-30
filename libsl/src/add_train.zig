const shared = @import("shared.zig");

const add_man = @import("add_man.zig").add_man;
const add_smoke = @import("add_smoke.zig").add_smoke;

const mvaddstr = shared.mvaddstr;
const print_car = shared.print_car;

pub const WindowOffsets = struct { height: i32, offsets: []const i32 };
pub const TrainOffsets = struct { funnel: i32, engine_windows: WindowOffsets, car_windows: WindowOffsets, car_text_width: u32 };

pub fn add_train(x: i32, comptime animations: usize, comptime height: usize, engine: [animations][height][:0]const u8, coal: [height][:0]const u8, car: [height][:0]const u8, offsets: TrainOffsets, namelist: [][*:0]const u8) i32 {
    const car_length = @as(i32, @intCast(car[0].len)) - 1;
    const frames = @as(i32, @intCast(animations)) + 1;
    const count = namelist.len;
    const engine_length = @as(i32, @intCast(engine[0][0].len));
    const front_length = engine_length + @as(i32, @intCast(coal[0].len));
    if (x < -(front_length + (if (count > 0) @as(i32, @intCast(count)) * car_length else 0))) {
        return -1;
    }

    const engine_height = @as(i32, @intCast(engine.len));
    var y = @divTrunc(shared.LINES, 2) - @divTrunc(engine_height, 2);
    var dy: i32 = 0;
    if (shared.FLY == 1) {
        y = ((@divTrunc(x, frames) + shared.LINES) - @divTrunc(shared.COLS, frames)) - engine_height;
        // Try to estimate when the train is off screen enough.
        if (y < -(engine_height * @divTrunc(shared.COLS, shared.LINES))) {
            return -1;
        }

        dy = 1;
    }

    for (0..coal.len) |ui| {
        const i = @as(i32, @intCast(ui));
        if ((front_length + x) > 0) {
            _ = mvaddstr(y + i, x, engine[@as(usize, @intCast(@mod(x + front_length, @as(i32, @intCast(engine.len)))))][ui]);
            _ = mvaddstr((y + i) + dy, x + engine_length - 1, coal[ui]);
        }
        {
            for (0..count) |uj| {
                const j = @as(i32, @intCast(uj));
                const pos = (front_length + x) + (car_length * (j + 1));
                if (pos < 0) {
                    continue;
                } else if (pos > (shared.COLS + front_length)) {
                    break;
                }

                var carName: [256:0]u8 = undefined;
                _ = print_car(&carName, carName.len, car[ui], namelist[uj], offsets.car_text_width);
                _ = mvaddstr(((y + i) + (shared.FLY * (j + 1))) + dy, (x + engine_length - 1) + (car_length * (j + 1)), &carName);
            }
        }
    }

    if (shared.ACCIDENT == 1) {
        for (offsets.engine_windows.offsets) |offset| {
            add_man(y + offsets.engine_windows.height, x + offset);
        }

        for (0..count) |uj| {
            const j = @as(i32, @intCast(uj));
            const pos = (front_length + x) + (car_length * (j + 1));
            if (pos < 0) {
                continue;
            } else if (pos > (shared.COLS + front_length)) {
                break;
            }

            for (offsets.car_windows.offsets) |offset| {
                add_man((y + offsets.car_windows.height) + (shared.FLY * (j + 2)), ((x + front_length) + offset) + (car_length * j));
            }
        }
    }

    add_smoke(y - 1, x + offsets.funnel);
    return 0;
}

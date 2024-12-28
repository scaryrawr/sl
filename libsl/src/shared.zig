pub export var ACCIDENT: i32 = 0;
pub export var FLY: i32 = 0;

pub extern var COLS: i32;
pub extern var LINES: i32;

extern fn my_mvaddstr(y: i32, x: i32, str: [*:0]const u8) i32;

pub extern fn print_car(buffer: [*:0]u8, buffer_length: u32, fmt: [*:0]const u8, text: [*:0]const u8, text_display_width: u32) i32;
pub const mvaddstr = my_mvaddstr;

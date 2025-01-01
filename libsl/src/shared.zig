pub export var ACCIDENT: i32 = 0;
pub export var FLY: i32 = 0;

pub extern var COLS: i32;
pub extern var LINES: i32;

extern fn my_mvaddstr(y: i32, x: i32, str: [*c]const u8) i32;

pub const mvaddstr = my_mvaddstr;

use crate::sl::my_mvaddstr;
use std::ffi::CStr;

#[no_mangle]
pub fn add_man(y: i32, x: i32) {
    const MAN: [[&CStr; 2]; 2] = [[c"", c"Help!"], [c"(O)", c"\\O/"]];
    MAN.iter().enumerate().for_each(|(i, row)| {
        let man = row[(x.abs() / 12 % 2) as usize];
        my_mvaddstr(y + i as i32, x, man.as_ptr());
    });
}

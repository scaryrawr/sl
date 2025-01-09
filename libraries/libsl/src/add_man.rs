use crate::Display;

use super::mvaddstr::mvaddstr;

pub fn add_man<FAddStr: Fn(i32, i32, &str)>(y: i32, x: i32, display: &Display<FAddStr>) {
    const MAN: [[&str; 2]; 2] = [["", "Help!"], ["(O)", "\\O/"]];
    MAN.iter().enumerate().for_each(|(i, row)| {
        let man = row[(x.abs() / 12 % 2) as usize];
        _ = mvaddstr(y + i as i32, x, man, &display);
    });
}

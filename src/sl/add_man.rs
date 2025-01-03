use super::mvaddstr::mvaddstr;
use std::io::Error;

#[no_mangle]
pub fn add_man(y: i32, x: i32) -> Result<(), Error> {
    const MAN: [[&str; 2]; 2] = [["", "Help!"], ["(O)", "\\O/"]];
    match MAN.iter().enumerate().all(|(i, row)| {
        let man = row[(x.abs() / 12 % 2) as usize];
        mvaddstr(y + i as i32, x, man).is_ok()
    }) {
        true => Ok(()),
        false => Err(Error::new(
            std::io::ErrorKind::InvalidInput,
            "Out of bounds",
        )),
    }
}

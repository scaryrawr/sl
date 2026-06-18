use crate::{RenderTarget, ScreenSize};

use super::mvaddstr::mvaddstr;

pub fn add_man<T: RenderTarget>(
    y: i32,
    x: i32,
    screen: ScreenSize,
    target: &mut T,
) -> Result<(), T::Error> {
    const MAN: [[&str; 2]; 2] = [["", "Help!"], ["(O)", "\\O/"]];
    for (i, row) in MAN.iter().enumerate() {
        let man = row[(x.abs() / 12 % 2) as usize];
        mvaddstr(y + i as i32, x, man, screen, target)?;
    }

    Ok(())
}

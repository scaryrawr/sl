use std::io::Error;
use std::io::ErrorKind;
use std::str;

use super::add_man::add_man;
use super::add_smoke::add_smoke;
use super::mvaddstr::mvaddstr;
use super::print_car::print_car;
use super::ACCIDENT;
use super::COLS;
use super::FLY;
use super::LINES;

#[derive(Debug)]
pub struct WindowOffsets<const COUNT: usize> {
    pub height: i32,
    pub window_positions: [i32; COUNT],
}

#[derive(Debug)]
pub struct TrainOffsets<const ENGINE_WINDOWS: usize, const CAR_WINDOWS: usize> {
    pub funnel: i32,
    pub engine_windows: WindowOffsets<ENGINE_WINDOWS>,
    pub car_windows: WindowOffsets<CAR_WINDOWS>,
    pub car_text_width: u32,
}

pub fn add_train<
    const ANIMATIONS: usize,
    const HEIGHT: usize,
    const ENGINE_WINDOWS: usize,
    const CAR_WINDOWS: usize,
>(
    x: i32,
    engine: &[[&str; HEIGHT]; ANIMATIONS],
    coal: &[&str; HEIGHT],
    car: &[&str; HEIGHT],
    offsets: TrainOffsets<ENGINE_WINDOWS, CAR_WINDOWS>,
    namelist: &[&str],
) -> Result<(), Error> {
    let car_length: i32 = (car[0].len() - 1).try_into().unwrap();
    let frames: i32 = (ANIMATIONS + 1).try_into().unwrap();
    let count: i32 = namelist.len().try_into().unwrap();
    let engine_length: i32 = engine[0][0].len().try_into().unwrap();
    let front_length: i32 = engine_length + coal[0].len() as i32;
    if x < -(front_length + (if count > 0 { count * car_length } else { 0 })) {
        return Err(Error::new(ErrorKind::Other, "Train is off screen"));
    }

    let engine_height: i32 = engine.len().try_into().unwrap();
    let mut y = unsafe { LINES } / 2 - engine_height / 2;
    let mut dy = 0;
    if (unsafe { FLY } == 1) {
        y = (((x / frames) + unsafe { LINES }) - unsafe { COLS } / frames) - engine_height;
        // Try to estimate when the train is off screen enough.
        if y < -(engine_height * unsafe { COLS } / unsafe { LINES }) {
            return Err(Error::new(ErrorKind::Other, "Train is off screen"));
        }

        dy = 1;
    }

    for ui in 0..HEIGHT {
        let i: i32 = ui.try_into().unwrap();
        if (front_length + x) > 0 {
            _ = mvaddstr(
                y + i,
                x,
                engine[((x + front_length) % engine.len() as i32) as usize][ui],
            );
            _ = mvaddstr((y + i) + dy, x + engine_length - 1, coal[ui]);
        }

        for j in 0..count {
            let uj: usize = j.try_into().unwrap();
            let pos = (front_length + x) + (car_length * (j + 1));
            if pos < 0 {
                continue;
            } else if pos > (unsafe { COLS } + front_length) {
                break;
            }

            let mut car_name: [u8; 256] = [0; 256];
            _ = print_car(
                car_name.as_mut_ptr(),
                car_name.len().try_into().unwrap(),
                car[ui],
                namelist[uj],
                offsets.car_text_width,
            );
            _ = mvaddstr(
                ((y + i) + (unsafe { FLY } * (j + 1))) + dy,
                (x + engine_length - 1) + (car_length * (j + 1)),
                str::from_utf8(&car_name).unwrap(),
            );
        }
    }

    if (unsafe { ACCIDENT } == 1) {
        offsets
            .engine_windows
            .window_positions
            .iter()
            .for_each(|offset| {
                add_man(y + offsets.engine_windows.height, x + offset);
            });

        for uj in 0..count {
            let j = uj;
            let pos = (front_length + x) + (car_length * (j + 1));
            if pos < 0 {
                continue;
            } else if pos > (unsafe { COLS } + front_length) {
                break;
            }

            offsets
                .car_windows
                .window_positions
                .iter()
                .for_each(|offset| {
                    add_man(
                        (y + offsets.car_windows.height) + (unsafe { FLY } * (j + 2)),
                        ((x + front_length) + offset) + (car_length * j),
                    );
                });
        }
    }

    add_smoke(y - 1, x + offsets.funnel);

    Ok(())
}

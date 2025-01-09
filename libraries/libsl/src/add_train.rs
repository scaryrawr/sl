use crate::Display;

use super::add_man::add_man;
use super::add_smoke::add_smoke;
use super::mvaddstr::mvaddstr;
use super::print_car::print_car;
use super::ACCIDENT;
use super::FLY;
use core::str;

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
    pub car_text_width: usize,
}

pub enum Error {
    Offscreen,
}

pub fn add_train<
    const ANIMATIONS: usize,
    const HEIGHT: usize,
    const ENGINE_WINDOWS: usize,
    const CAR_WINDOWS: usize,
    TStr: AsRef<str>,
    FAddStr: Fn(i32, i32, &str),
>(
    x: i32,
    engine: &[[&str; HEIGHT]; ANIMATIONS],
    coal: &[&str; HEIGHT],
    car: &[&str; HEIGHT],
    offsets: TrainOffsets<ENGINE_WINDOWS, CAR_WINDOWS>,
    names: &[TStr],
    display: &Display<FAddStr>,
) -> Result<(), Error> {
    let car_length: i32 = (car[0].len() - 1).try_into().unwrap();
    let frames: i32 = (ANIMATIONS + 1).try_into().unwrap();
    let count: i32 = names.len().try_into().unwrap();
    let engine_length: i32 = engine[0][0].len().try_into().unwrap();
    let front_length: i32 = engine_length + coal[0].len() as i32;
    if x < -(front_length + (if count > 0 { count * car_length } else { 0 })) {
        return Err(Error::Offscreen);
    }

    let engine_height: i32 = engine.len().try_into().unwrap();
    let mut y = display.lines / 2 - engine_height / 2;
    let mut dy = 0;
    if (unsafe { FLY } == 1) {
        y = (((x / frames) + display.lines) - display.cols / frames) - engine_height;
        // Try to estimate when the train is off screen enough.
        if y < -(engine_height * display.cols / display.lines) {
            return Err(Error::Offscreen);
        }

        dy = 1;
    }

    for ui in 0..HEIGHT {
        let i: i32 = ui.try_into().unwrap();
        if (front_length + x) > 0 {
            mvaddstr(
                y + i,
                x,
                engine[((x + front_length) % engine.len() as i32) as usize][ui],
                &display,
            );
            mvaddstr((y + i) + dy, x + engine_length - 1, coal[ui], &display);
        }

        for j in 0..count {
            let uj: usize = j.try_into().unwrap();
            let pos = (front_length + x) + (car_length * (j + 1));
            if pos < 0 {
                continue;
            } else if pos > (display.cols + front_length) {
                break;
            }

            let mut car_name: [u8; 256] = [0; 256];
            print_car(
                car_name.as_mut(),
                car[ui],
                names[uj].as_ref(),
                offsets.car_text_width,
            );
            mvaddstr(
                ((y + i) + (unsafe { FLY } * (j + 1))) + dy,
                (x + engine_length - 1) + (car_length * (j + 1)),
                str::from_utf8(&car_name).unwrap(),
                &display,
            );
        }
    }

    if (unsafe { ACCIDENT } == 1) {
        offsets
            .engine_windows
            .window_positions
            .iter()
            .for_each(|offset| {
                add_man(y + offsets.engine_windows.height, x + offset, display);
            });

        for uj in 0..count {
            let j = uj;
            let pos = (front_length + x) + (car_length * (j + 1));
            if pos < 0 {
                continue;
            } else if pos > (display.cols + front_length) {
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
                        display,
                    );
                });
        }
    }

    add_smoke(y - 1, x + offsets.funnel, display);

    Ok(())
}

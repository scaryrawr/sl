extern crate cmake;
use cmake::Config;

fn main() {
    let dst = Config::new("libsl").build();

    println!("cargo:rerun-if-changed=libsl/sl.c");
    println!("cargo:rerun-if-changed=libsl/sl.h");
    println!("cargo:rustc-link-search=native={}", dst.display());
}

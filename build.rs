extern crate cmake;
use std::{env, path::{Path, PathBuf}};

use cmake::Config;

fn main()
{
    let vcpkg_root_env = env::var("VCPKG_ROOT").unwrap();
    let vcpkg_root = Path::new(&vcpkg_root_env);
    let mut toolchain = PathBuf::from(vcpkg_root);
    toolchain.push("scripts/buildsystems/vcpkg.cmake");

    let dst = Config::new("libsl")
    .define("CMAKE_TOOLCHAIN_FILE", toolchain.to_str().unwrap())
    .build();

    println!("cargo:rustc-link-search=native={}", dst.display());
}
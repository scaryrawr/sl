$env:VCPKG_ROOT="$(pwd)\vcpkg"
$env:VCPKGRS_DYNAMIC="1"
cargo install cargo-vcpkg
cargo vcpkg build
cargo build --release
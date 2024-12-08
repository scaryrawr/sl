#!/usr/bin/env bash

sudo dnf install -y cmake ninja-build vcpkg dnf-plugins-core cargo @c-development @rpm-development-tools rpkg ncurses-devel
git clone https://github.com/microsoft/vcpkg $VCPKG_ROOT
ln -s `which vcpkg` $VCPKG_ROOT/vcpkg
rustup-init -qy
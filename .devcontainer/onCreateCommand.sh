#!/usr/bin/env bash

sudo dnf install -y cmake ninja-build vcpkg ncurses-devel dnf-plugins-core rpmdevtools rpkg
git clone https://github.com/microsoft/vcpkg $VCPKG_ROOT
ln -s `which vcpkg` $VCPKG_ROOT/vcpkg
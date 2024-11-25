# SL(1): Cure your bad habit of mistyping

SL (Steam Locomotive) runs across your terminal when you type "sl" as
you meant to type "ls". It's just a joke command.

Copyright 1993,1998,2014 Toyoda Masashi (<mtoyoda@acm.org>)

![Terminal Demo](cars.gif)

## Installation

Using [homebrew](https://brew.sh) on macos/linux:

```sh
brew install scaryrawr/formulae/sl
```

Using [copr](https://copr.fedorainfracloud.org/coprs/scaryrawr/sl/) on fedora:

```sh
sudo dnf copr enable scaryrawr/sl
sudo dnf install sl
```

Windows users can download the latest release from the [releases page](https://github.com/scaryrawr/sl/releases/latest/).

From source:

```sh
git clone https://github.com/scaryrawr/sl
cd sl
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
sudo cmake --install .
```

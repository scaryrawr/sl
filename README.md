# SL(1): Cure your bad habit of mistyping

SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls". It's just a joke command.

Copyright 1993,1998,2014 Toyoda Masashi (<mtoyoda@acm.org>)

![Terminal Demo](cars.gif)

## Usage

```txt
Usage: sl [OPTIONS]

Options:
  -a, --accident  An accident is occurring. People cry for help. Lists all files
  -l, --logo      Little version
  -F, --fly       It flies like the galaxy express 999
  -c, --c51       C51 appears instead of D51
  -f, --files     Disables listing files and directories
  -h, --help      Print help
  -V, --version   Print version
```

### Piping

SL supports piping contents into it for printing things to the train car.

```sh
echo "Hello\nworld!" | sl
```

You can also pipe long/slow (only so slow though, if the train finishes before it gets a new line things are boring)
running processes into it:

```sh
# Print package names as they are built as train cars!
cargo build 2>&1 | awk -F' ' '/Compiling/ {print $2}' | sl
```

## Embed

You can embed the SL terminal in your own pages using query parameters:

```txt
https://scaryrawr.github.io/sl/#embed?accident=true&fly=false&smoke=true&trainType=d51&messages=["hello","world"]
```

Supported query parameters:

- `accident`: true or false
- `fly`: true or false
- `smoke`: true or false
- `trainType`: d51, c51, or logo
- `messages`: URL encoded JSON array of messages

## Installation

### macOS and x64 Linux

Using [homebrew](https://brew.sh):

```sh
brew install scaryrawr/formulae/sl
```

### Fedora Linux

Using [copr](https://copr.fedorainfracloud.org/coprs/scaryrawr/sl/):

```sh
sudo dnf copr enable scaryrawr/sl
sudo dnf install sl
```

### Windows

Download the [latest release](https://github.com/scaryrawr/sl/releases/latest) or using winget (winget may be a few
versions behind):

```pwsh
winget install scaryrawr.sl
# Override sl alias which was (Set-Location)
echo 'Set-Alias -Name sl -Value "C:\Program Files\sl\bin\sl.exe" -Force' >> $profile
Set-Alias -Name sl -Value "C:\Program Files\sl\bin\sl.exe" -Force
```

Using cargo:

```sh
cargo install --git https://github.com/scaryrawr/sl
```

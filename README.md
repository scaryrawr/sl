# SL(1): Cure your bad habit of mistyping

SL (Steam Locomotive) runs across your terminal when you type "sl" as
you meant to type "ls". It's just a joke command.

Copyright 1993,1998,2014 Toyoda Masashi (<mtoyoda@acm.org>)

![Terminal Demo](cars.gif)

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

Using winget:

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

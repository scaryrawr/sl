Name:       sl
Version:    5.06
Release:    %autorelease
Summary:    SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls".

License:    SL
URL:        https://github.com/scaryrawr/sl
Source0:    https://github.com/scaryrawr/sl/archive/refs/tags/%{version}.tar.gz
Source1:    LICENSE

BuildRequires:  gcc
BuildRequires:  cmake
BuildRequires:  pkgconfig
BuildRequires:  pkgconfig(ncurses)

%description
SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls".

%files
%{_bindir}/%{name}
%license LICENSE

%prep
%autosetup

%build
%cmake
%cmake_build

%install
%cmake_install

%changelog
%autochangelog
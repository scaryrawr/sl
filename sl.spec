Name:       {{{ git_dir_name }}}
Version:    {{{ git_dir_version }}}
Release:    1%{?dist}
Summary:    SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls".

License:    SL
URL:        https://github.com/scaryrawr/sl
VCS:        {{{ git_dir_vcs }}}

Source:    {{{ git_dir_pack }}}

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
{{{ git_dir_setup_macro }}}

%build
%cmake
%cmake_build

%install
%cmake_install

%changelog
{{{ git_dir_changelog }}}
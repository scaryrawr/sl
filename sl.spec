Name:       {{{ git_dir_name }}}
Version:    {{{ git_dir_version lead=6 }}}
Release:    1%{?dist}
Summary:    SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls".

License:    SL
URL:        https://github.com/scaryrawr/sl
VCS:        {{{ git_dir_vcs }}}

Source:    {{{ git_dir_pack }}}

BuildRequires:  gcc
BuildRequires:  cmake
BuildRequires:  cargo
BuildRequires:  rust

%description
SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls".

%files
%{_bindir}/%{name}
%{_mandir}/man1/%{name}.1*
%license LICENSE

%prep
{{{ git_dir_setup_macro }}}

%build
COMPLETION_DIR="completions" cargo build --release

%install
install -D -p -m 755 target/release/sl %{buildroot}%{_bindir}/sl
install -D -p -m 644 completions/sl.1 %{buildroot}%{_mandir}/man1/sl.1
install -D -p -m 644 sl.1.ja %{buildroot}%{_mandir}/man1/sl.1.ja

%changelog
{{{ git_dir_changelog }}}

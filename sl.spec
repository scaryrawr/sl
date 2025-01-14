Name:       {{{ git_dir_name }}}
Version:    {{{ git_dir_version lead=6 }}}
Release:    1%{?dist}
Summary:    SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls".

License:    SL
URL:        https://github.com/scaryrawr/sl
VCS:        {{{ git_dir_vcs }}}

Source:    {{{ git_dir_pack }}}

BuildRequires:  cargo
BuildRequires:  rust

%description
SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls".

%files
%{_bindir}/%{name}
%{_mandir}/man1/%{name}.1*
%license LICENSE
%{bash_completions_dir}/sl.bash
%{fish_completions_dir}/sl.fish
%{zsh_completions_dir}/_sl

%prep
{{{ git_dir_setup_macro }}}

%build
COMPLETION_DIR=$(pwd)/completions cargo build --release

%install
install -Dpm 0755 target/release/sl     %{buildroot}%{_bindir}/sl
install -Dpm 0644 completions/sl.1      %{buildroot}%{_mandir}/man1/sl.1
install -Dpm 0644 sl.1.ja               %{buildroot}%{_mandir}/man1/sl.1.ja
install -Dpm 0644 completions/sl.bash   %{buildroot}%{bash_completions_dir}
install -Dpm 0644 completions/sl.fish   %{buildroot}%{fish_completions_dir}
install -Dpm 0644 completions/_sl       %{buildroot}%{zsh_completions_dir}

%changelog
{{{ git_dir_changelog }}}

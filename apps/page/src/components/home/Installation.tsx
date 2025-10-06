const Installation = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <h1>Installation</h1>
    <h2>macOS and x64 Linux</h2>
    <p>
      Using <a href="https://brew.sh">homebrew</a>:
    </p>
    <pre>{`brew install scaryrawr/formulae/sl`}</pre>
    <h2>Fedora Linux</h2>
    <p>
      Using <a href="https://copr.fedorainfracloud.org/coprs/scaryrawr/sl/">copr</a>:
    </p>
    <pre>
      {`sudo dnf copr enable scaryrawr/sl
sudo dnf install sl`}
    </pre>
    <h2>Windows</h2>
    <p>
      Download the <a href="https://github.com/scaryrawr/sl/releases/latest">latest release</a> or using winget:
    </p>
    <pre>
      {`winget install scaryrawr.sl
# Override sl alias which was (Set-Location)
echo 'Set-Alias -Name sl -Value "C:\\Program Files\\sl\\bin\\sl.exe" -Force' >> $profile
Set-Alias -Name sl -Value "C:\\Program Files\\sl\\bin\\sl.exe" -Force`}
    </pre>
    <p>Using cargo:</p>
    <pre>{`cargo install --git https://github.com/scaryrawr/sl`}</pre>
  </div>
);

export default Installation;

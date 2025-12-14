const Installation = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <h2>Installation</h2>
    <h3>macOS and x64 Linux</h3>
    <p>
      Using{' '}
      <a 
        href="https://brew.sh" 
        target="_blank" 
        rel="noopener noreferrer"
        aria-label="Homebrew (opens in new tab)"
      >
        homebrew
      </a>
      :
    </p>
    <pre>{`brew install scaryrawr/formulae/sl`}</pre>
    <h3>Fedora Linux</h3>
    <p>
      Using{' '}
      <a 
        href="https://copr.fedorainfracloud.org/coprs/scaryrawr/sl/" 
        target="_blank" 
        rel="noopener noreferrer"
        aria-label="Copr (opens in new tab)"
      >
        copr
      </a>
      :
    </p>
    <pre>
      {`sudo dnf copr enable scaryrawr/sl
sudo dnf install sl`}
    </pre>
    <h3>Windows</h3>
    <p>
      Download the{' '}
      <a 
        href="https://github.com/scaryrawr/sl/releases/latest" 
        target="_blank" 
        rel="noopener noreferrer"
        aria-label="Latest release (opens in new tab)"
      >
        latest release
      </a>{' '}
      or using winget:
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

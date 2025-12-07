const Usage = () => (
  <div>
    <h2>Usage</h2>
    <pre>
      <code>
        {/* prettier-ignore */}
        {`Usage: sl [OPTIONS]

Options:
  -a, --accident  An accident is occurring. People cry for help. Lists all files
  -l, --logo      Little version
  -F, --fly       It flies like the galaxy express 999
  -c, --c51       C51 appears instead of D51
  -f, --files     Disables listing files and directories
  -h, --help      Print help
  -V, --version   Print version`}
      </code>
    </pre>
  </div>
);

export default Usage;

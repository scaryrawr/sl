const Piping = () => (
  <div>
    <h2>Piping</h2>
    <p>SL supports piping contents into it for printing things to the train car.</p>
    <pre>
      <code>{`echo "Hello\\nworld!" | sl`}</code>
    </pre>
    <p>You can also pipe long/slow running processes into it:</p>
    <pre>
      <code>
        {/* prettier-ignore */}
        {`# Print package names as they are built as train cars!
cargo build 2>&1 | awk -F' ' '/Compiling/ {print $2}' | sl`}
      </code>
    </pre>
  </div>
);

export default Piping;

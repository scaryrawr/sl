const Embed = () => (
  <div>
    <h2>Embed</h2>
    <p>You can embed the SL terminal in your own pages using query parameters:</p>
    <pre>
      <code>
        {`https://scaryrawr.github.io/sl/embed?accident=true&fly=false&smoke=true&trainType=d51&messages=["hello","world"]`}
      </code>
    </pre>
    <p>Supported query parameters:</p>
    <ul>
      <li>
        <code>accident</code>: true or false
      </li>
      <li>
        <code>fly</code>: true or false
      </li>
      <li>
        <code>smoke</code>: true or false
      </li>
      <li>
        <code>trainType</code>: d51, c51, or logo
      </li>
      <li>
        <code>messages</code>: URL encoded JSON array of messages
      </li>
    </ul>
  </div>
);

export default Embed;

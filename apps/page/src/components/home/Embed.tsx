/**
 * Documentation section explaining how to embed the SL terminal in external pages.
 * Lists supported query parameters and provides a URL example.
 */
const Embed = () => (
  <div>
    <h2>Embed</h2>
    <p>You can embed the SL terminal in your own pages using query parameters:</p>
    <pre>
      <code>
        {`https://scaryrawr.github.io/sl/embed.html?accident=true&fly=false&smoke=true&trainType=d51&messages=["hello","world"]`}
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
      <li>
        <code>fontColor</code>: CSS color for the terminal text (default: <code>#0f0</code>)
      </li>
      <li>
        <code>backgroundColor</code>: CSS color for the terminal and page background (default: <code>#000</code>)
      </li>
    </ul>
    <p>
      The terminal fills the entire embed viewport and the page background matches <code>backgroundColor</code>, so an
      embed blends into your page without letterboxing or scrollbars.
    </p>
  </div>
);

export default Embed;

import Embed from './Embed';
import Installation from './Installation';
import Piping from './Piping';
import { DEMO_ID } from './showcases';
import Trains from './Trains';
import Usage from './Usage';

const Home = () => (
  <main id="main-content" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
    <h1>Welcome to the SL Project</h1>
    <p>
      SL (Steam Locomotive) runs across your terminal when you type &ldquo;sl&rdquo; as you meant to type
      &ldquo;ls&rdquo;. It&rsquo;s just a joke command.
    </p>
    <p>
      Visit our{' '}
      <a
        href="https://github.com/scaryrawr/sl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository (opens in new tab)"
      >
        GitHub repository
      </a>{' '}
      for more information.
    </p>
    <hr />
    <h2>Demo</h2>
    <noscript>
      <p>The live demos need JavaScript. The train descriptions and instructions below are available without it.</p>
    </noscript>
    <div id={DEMO_ID} />
    <Trains />
    <Usage />
    <Piping />
    <Embed />
    <Installation />
  </main>
);

export default Home;

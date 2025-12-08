import type { ComponentType } from 'preact';
import Router from 'preact-router';
import { lazy, Suspense } from 'preact/compat';

type RouteProps = { path: string };

const Home = lazy(() => import('./home/Home')) as ComponentType<RouteProps>;
const EmbedPage = lazy(() => import('./embed/EmbedPage')) as ComponentType<RouteProps>;

const App = () => (
  <Suspense fallback={<div />}>
    <Router>
      <Home path="/" />
      <EmbedPage path="/embed" />
    </Router>
  </Suspense>
);

export default App;

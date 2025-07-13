import { Suspense, lazy } from 'react';
import { Route, HashRouter as Router, Routes } from 'react-router-dom';

const Home = lazy(() => import('./home/Home.jsx'));
const EmbedPage = lazy(() => import('./embed/EmbedPage.jsx'));

const App = () => (
  <Router>
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/embed" element={<EmbedPage />} />
      </Routes>
    </Suspense>
  </Router>
);

export default App;

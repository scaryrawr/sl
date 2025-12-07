import { Suspense, lazy } from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';

const Home = lazy(() => import('./home/Home'));
const EmbedPage = lazy(() => import('./embed/EmbedPage'));

const App = () => (
  <Router>
    <Suspense fallback={<div />}> 
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/embed" element={<EmbedPage />} />
      </Routes>
    </Suspense>
  </Router>
);

export default App;

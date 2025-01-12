import { Route, HashRouter as Router, Routes } from 'react-router-dom';
import EmbedPage from './embed/EmbedPage.jsx';
import Home from './home/Home.jsx';

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/embed" element={<EmbedPage />} />
    </Routes>
  </Router>
);

export default App;

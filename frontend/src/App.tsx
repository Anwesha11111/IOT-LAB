import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard  from './pages/Dashboard';
import Vitals     from './pages/Vitals';
import Alerts     from './pages/Alerts';
import Analytics  from './pages/Analytics';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"          element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vitals"    element={<Vitals />} />
        <Route path="/alerts"    element={<Alerts />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Router>
  );
}

export default App;

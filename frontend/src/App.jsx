import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AgentDashboard from './pages/AgentDashboard';
import JoinRoom from './pages/JoinRoom';
import CallRoom from './pages/CallRoom';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AgentDashboard />} />
        <Route path="/join/:sessionId" element={<JoinRoom />} />
        <Route path="/call/:sessionId" element={<CallRoom />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, LogIn } from 'lucide-react';

export default function JoinRoom() {
  const { sessionId } = useParams();
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    navigate(`/call/${sessionId}?role=CUSTOMER&name=${encodeURIComponent(name)}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', marginBottom: '24px' }}>
          <User size={48} />
        </div>
        
        <h1 style={{ fontSize: '28px', marginBottom: '8px', fontWeight: '600' }}>Join Support Session</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>An agent is waiting to assist you</p>

        <form onSubmit={handleJoin}>
          <div style={{ marginBottom: '24px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '14px' }}>Your Name</label>
            <input 
              type="text" 
              className="input-glass" 
              placeholder="e.g. John Doe" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px' }} disabled={!name.trim()}>
            <LogIn size={20} />
            Join Call
          </button>
        </form>
      </div>
    </div>
  );
}

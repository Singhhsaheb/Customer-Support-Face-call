import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Copy, CheckCircle2 } from 'lucide-react';

export default function AgentDashboard() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/api/agents')
      .then(res => res.json())
      .then(data => {
        setAgents(data);
        if (data.length > 0) setSelectedAgent(data[0].id);
      });
  }, []);

  const createSession = async () => {
    const res = await fetch('http://localhost:3001/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: selectedAgent })
    });
    const data = await res.json();
    setSessionId(data.sessionId);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/join/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const joinSession = () => {
    const agent = agents.find(a => a.id === selectedAgent);
    navigate(`/call/${sessionId}?role=AGENT&name=${encodeURIComponent(agent.name)}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '100%', maxWidth: '500px', textAlign: 'center' }}>
        
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--primary)', marginBottom: '24px' }}>
          <Video size={48} />
        </div>
        
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontWeight: '600' }}>AtomQuest Support</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Agent Portal - Create secure video support sessions</p>

        <div style={{ marginBottom: '24px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '14px' }}>Select Agent Profile</label>
          <select 
            className="input-glass"
            value={selectedAgent} 
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            {agents.map(a => (
              <option key={a.id} value={a.id} style={{color: 'black'}}>{a.name}</option>
            ))}
          </select>
        </div>

        {!sessionId ? (
          <button className="btn btn-primary" style={{ width: '100%', padding: '16px' }} onClick={createSession}>
            <Video size={20} />
            Generate Support Link
          </button>
        ) : (
          <div className="animate-fade-in">
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-glass)' }}>
              <span style={{ color: 'var(--primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {window.location.origin}/join/{sessionId}
              </span>
              <button className="btn btn-glass btn-icon" onClick={copyLink} title="Copy Link">
                {copied ? <CheckCircle2 size={18} color="var(--success)" /> : <Copy size={18} />}
              </button>
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%', padding: '16px' }} onClick={joinSession}>
              Join Session as Agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
